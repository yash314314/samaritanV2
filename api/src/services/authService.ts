import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { User } from "@prisma/client";
import { prisma } from "../prisma";
import { authConfig } from "../config/auth";
import { accessTokenExpiry, generateAccessToken } from "../utils/jwt";

// Sessions: a short-lived JWT access token plus an opaque refresh token.
// Only the SHA-256 of a refresh token is stored. Every refresh rotates it;
// presenting an already-rotated token means it was copied, so the whole
// family (every token descended from that login) is revoked.

export type ClientKind = "web" | "desktop";

export interface ClientContext {
  client: ClientKind;
  deviceId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

export interface PublicUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
  avatarUrl: string | null;
}

export interface IssuedSession {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresAt: Date;
  /** Absent when a concurrent refresh already rotated the token (see ROTATION_GRACE_MS). */
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  familyId: string;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Two tabs that reload together both present the same refresh cookie. The
// loser of that race is answered with an access token only (its cookie jar
// already holds the winner's new token) instead of being treated as a replay.
const ROTATION_GRACE_MS = 30_000;
const TOKEN_VERSION_CACHE_MS = 5_000;
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function newRawToken(): string {
  return randomBytes(32).toString("base64url");
}

function refreshTtlMs(client: ClientKind): number {
  return (client === "desktop" ? authConfig.deviceRefreshTtlDays : authConfig.refreshTtlDays) * DAY_MS;
}

function clip(value: string | null | undefined, max: number): string | null {
  return value ? value.slice(0, max) : null;
}

export function toPublicUser(user: Pick<User, "id" | "email" | "name" | "role" | "avatarUrl">): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl };
}

function accessFor(user: Pick<User, "id" | "email" | "role" | "tokenVersion">, now: Date) {
  return {
    accessToken: generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    }),
    accessTokenExpiresAt: accessTokenExpiry(now),
  };
}

/** Starts a new login (a new token family) for `user`. */
export async function createSession(user: User, context: ClientContext): Promise<IssuedSession> {
  const now = new Date();
  const refreshToken = newRawToken();
  const familyId = randomUUID();
  const refreshTokenExpiresAt = new Date(now.getTime() + refreshTtlMs(context.client));
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashToken(refreshToken),
      familyId,
      client: context.client,
      deviceId: clip(context.deviceId, 128),
      userAgent: clip(context.userAgent, 300),
      createdByIp: clip(context.ip, 64),
      expiresAt: refreshTokenExpiresAt,
      lastUsedAt: now,
    },
  });
  return { user: toPublicUser(user), ...accessFor(user, now), refreshToken, refreshTokenExpiresAt, familyId };
}

export async function rotateRefreshToken(raw: string, context: Omit<ClientContext, "client">): Promise<IssuedSession> {
  const now = new Date();
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(raw) }, include: { user: true } });
  if (!stored) throw new AuthError(401, "Invalid or expired refresh token");

  if (stored.revokedAt) {
    const withinGrace =
      stored.revokedReason === "rotated" && now.getTime() - stored.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (withinGrace && (await familyIsLive(stored.familyId, now))) {
      return { user: toPublicUser(stored.user), ...accessFor(stored.user, now), familyId: stored.familyId };
    }
    if (stored.revokedReason === "rotated") {
      await revokeFamily(stored.familyId, "reuse");
      console.warn(`[Auth] Rotated refresh token replayed; family ${stored.familyId} revoked (user ${stored.userId})`);
    }
    throw new AuthError(401, "Invalid or expired refresh token");
  }
  if (stored.expiresAt <= now) throw new AuthError(401, "Invalid or expired refresh token");

  const replacementId = randomUUID();
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: now, revokedReason: "rotated", replacedById: replacementId, lastUsedAt: now },
  });
  if (claimed.count === 0) {
    // Lost a race with a concurrent refresh of the same token.
    if (await familyIsLive(stored.familyId, now)) {
      return { user: toPublicUser(stored.user), ...accessFor(stored.user, now), familyId: stored.familyId };
    }
    throw new AuthError(401, "Invalid or expired refresh token");
  }

  const refreshToken = newRawToken();
  const client = stored.client === "desktop" ? "desktop" : "web";
  const refreshTokenExpiresAt = new Date(now.getTime() + refreshTtlMs(client));
  await prisma.refreshToken.create({
    data: {
      id: replacementId,
      userId: stored.userId,
      token: hashToken(refreshToken),
      familyId: stored.familyId,
      client,
      deviceId: stored.deviceId,
      userAgent: clip(context.userAgent, 300) ?? stored.userAgent,
      createdByIp: clip(context.ip, 64),
      expiresAt: refreshTokenExpiresAt,
      lastUsedAt: now,
    },
  });
  return {
    user: toPublicUser(stored.user),
    ...accessFor(stored.user, now),
    refreshToken,
    refreshTokenExpiresAt,
    familyId: stored.familyId,
  };
}

async function familyIsLive(familyId: string, now: Date): Promise<boolean> {
  const live = await prisma.refreshToken.count({ where: { familyId, revokedAt: null, expiresAt: { gt: now } } });
  return live > 0;
}

export async function revokeFamily(familyId: string, reason: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

/** Ends the login a refresh token belongs to. Unknown tokens are ignored. */
export async function revokeByRefreshToken(raw: string, reason = "logout"): Promise<void> {
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(raw) }, select: { familyId: true } });
  if (stored) await revokeFamily(stored.familyId, reason);
}

/** Ends every login of a user and invalidates their outstanding access tokens. */
export async function revokeAllSessions(userId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } }),
    prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
  ]);
  tokenVersionCache.delete(userId);
}

export interface SessionSummary {
  id: string;
  client: string;
  userAgent: string | null;
  deviceId: string | null;
  startedAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  current: boolean;
}

/** Live logins of a user, one row per token family. */
export async function listSessions(userId: string, currentFamilyId?: string | null): Promise<SessionSummary[]> {
  const now = new Date();
  const live = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { lastUsedAt: "desc" },
  });
  const starts = await prisma.refreshToken.groupBy({
    by: ["familyId"],
    where: { familyId: { in: live.map((token) => token.familyId) } },
    _min: { createdAt: true },
  });
  const startedAt = new Map(starts.map((row) => [row.familyId, row._min.createdAt]));
  return live.map((token) => ({
    id: token.familyId,
    client: token.client,
    userAgent: token.userAgent,
    deviceId: token.deviceId,
    startedAt: startedAt.get(token.familyId) ?? token.createdAt,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    current: token.familyId === currentFamilyId,
  }));
}

export async function revokeSession(userId: string, familyId: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "logout" },
  });
  return result.count > 0;
}

export async function familyOfRefreshToken(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(raw) }, select: { familyId: true } });
  return stored?.familyId ?? null;
}

// ─── Access-token revocation ───────────────────────────────────────────

const tokenVersionCache = new Map<string, { version: number | null; at: number }>();

/** Current token version of a user, or null when the user no longer exists. */
export async function currentTokenVersion(userId: string): Promise<number | null> {
  const cached = tokenVersionCache.get(userId);
  if (cached && Date.now() - cached.at < TOKEN_VERSION_CACHE_MS) return cached.version;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  const version = user ? user.tokenVersion : null;
  tokenVersionCache.set(userId, { version, at: Date.now() });
  return version;
}

export function forgetTokenVersion(userId: string) {
  tokenVersionCache.delete(userId);
}

/** Deletes refresh tokens that expired or were revoked more than 30 days ago. */
export async function pruneRefreshTokens(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PRUNE_AFTER_MS);
  const result = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
  return result.count;
}

// ─── Local device enrollment ───────────────────────────────────────────

let enrollmentKey: Buffer | null = null;

/**
 * Creates (or reads) the key file the desktop tracker on this machine uses to
 * enroll without a login. The file is readable by the OS user only; anyone
 * who can read it could already read the tracker's own data.
 */
export async function ensureEnrollmentKey(): Promise<string | null> {
  if (!authConfig.localDeviceEnrollment) return null;
  const file = authConfig.enrollmentKeyFile;
  try {
    const existing = (await fs.readFile(file, "utf8")).trim();
    if (/^[A-Za-z0-9_-]{43,}$/.test(existing)) {
      enrollmentKey = Buffer.from(existing);
      await fs.chmod(file, 0o600).catch(() => undefined);
      return file;
    }
  } catch {
    // Missing or unreadable: create a fresh one below.
  }
  try {
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const key = randomBytes(32).toString("base64url");
    await fs.writeFile(file, `${key}\n`, { mode: 0o600 });
    await fs.chmod(file, 0o600);
    enrollmentKey = Buffer.from(key);
    return file;
  } catch (error) {
    console.warn(`[Auth] Local device enrollment disabled: cannot write ${file}:`, (error as Error).message);
    enrollmentKey = null;
    return null;
  }
}

export function enrollmentKeyMatches(candidate: unknown): boolean {
  if (!enrollmentKey || typeof candidate !== "string") return false;
  const given = Buffer.from(candidate.trim());
  return given.length === enrollmentKey.length && timingSafeEqual(given, enrollmentKey);
}

/** The account a locally enrolled desktop tracks for: the configured owner, else the first admin, else the first user. */
export async function localOwner(): Promise<User | null> {
  if (authConfig.localOwnerUserId) return prisma.user.findUnique({ where: { id: authConfig.localOwnerUserId } });
  return (
    (await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }))
  );
}
