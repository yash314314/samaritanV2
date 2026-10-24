import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma";
import { authConfig } from "../config/auth";
import { hashPassword, comparePassword, passwordProblem } from "../utils/password";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { clientIp, createRateLimiter } from "../utils/rateLimit";
import { isCredentialOrigin } from "../utils/origin";
import {
  AuthError,
  createSession,
  enrollmentKeyMatches,
  familyOfRefreshToken,
  listSessions,
  localOwner,
  revokeAllSessions,
  revokeByRefreshToken,
  revokeSession,
  rotateRefreshToken,
  type ClientContext,
  type ClientKind,
  type IssuedSession,
} from "../services/authService";
import { disconnectUser } from "../websocket/manager";

// Browsers keep the refresh token in an HttpOnly, SameSite=Strict cookie and
// the access token in memory only. The desktop tracker has no cookie jar: it
// identifies itself with `X-Samaritan-Client: desktop` and receives the
// refresh token in the response body instead.

const router = Router();

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;
const COOKIE_PATH = process.env.AUTH_COOKIE_PATH || "/api/auth";
const LOOPBACK_ADDRESS = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${clientIp(req)}|${normalizeEmail(req.body?.email) ?? ""}`,
  message: "Too many sign-in attempts. Try again in a few minutes.",
});
const loginIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50, key: clientIp });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, key: clientIp });
const refreshLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 120, key: clientIp });
const enrollLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, key: clientIp });
const passwordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => (req as AuthenticatedRequest).user?.userId ?? clientIp(req),
});

export function resetAuthRateLimits() {
  for (const limiter of [loginLimiter, loginIpLimiter, registerLimiter, refreshLimiter, enrollLimiter, passwordLimiter]) {
    limiter.resetAll();
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function clientKind(req: Request): ClientKind {
  return String(req.headers["x-samaritan-client"] || "").toLowerCase() === "desktop" ? "desktop" : "web";
}

function contextOf(req: Request, client: ClientKind): ClientContext {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;
  return { client, deviceId, userAgent: req.get("user-agent") ?? null, ip: clientIp(req) };
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: authConfig.cookieSecure,
    sameSite: "strict" as const,
    path: COOKIE_PATH,
    ...(expires ? { expires } : {}),
  };
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(authConfig.cookieName, cookieOptions());
}

/**
 * Cookie-bearing requests must come from the dashboard itself. A desktop
 * client never runs in a browser, so a desktop request with an Origin is a
 * web page pretending.
 */
function originProblem(req: Request, client: ClientKind, requireOrigin: boolean): string | null {
  const origin = req.headers.origin;
  if (client === "desktop") return origin ? "Desktop clients do not send an Origin" : null;
  if (!origin) return requireOrigin ? "Origin header required" : null;
  return isCredentialOrigin(origin) ? null : "Origin not allowed";
}

function sendSession(res: Response, session: IssuedSession, client: ClientKind, status = 200) {
  res.setHeader("Cache-Control", "no-store");
  if (client === "web" && session.refreshToken) {
    res.cookie(authConfig.cookieName, session.refreshToken, cookieOptions(session.refreshTokenExpiresAt));
  }
  return res.status(status).json({
    user: session.user,
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
    ...(client === "desktop" && session.refreshToken
      ? { refreshToken: session.refreshToken, refreshTokenExpiresAt: session.refreshTokenExpiresAt?.toISOString() }
      : {}),
  });
}

function sendAuthError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    if (error.status === 401) clearRefreshCookie(res);
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`[Auth] ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

// What the sign-in page needs to know before anyone is signed in.
router.get("/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ registrationOpen: authConfig.allowRegistration });
});

// Register a new account. Disabled unless ALLOW_REGISTRATION (default: on for the global database only).
router.post("/register", registerLimiter, async (req, res) => {
  const client = clientKind(req);
  const blocked = originProblem(req, client, false);
  if (blocked) return res.status(403).json({ error: blocked });
  if (!authConfig.allowRegistration) return res.status(403).json({ error: "Registration is disabled on this server" });

  const email = normalizeEmail(req.body?.email);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const problem = passwordProblem(req.body?.password);
  if (!email) return res.status(400).json({ error: "A valid email is required" });
  if (!name || name.length > 80) return res.status(400).json({ error: "Name must be 1 to 80 characters" });
  if (problem) return res.status(400).json({ error: problem });

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });
    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(req.body.password), role: "user", lastLoginAt: new Date() },
    });
    return sendSession(res, await createSession(user, contextOf(req, client)), client, 201);
  } catch (error) {
    return sendAuthError(res, error, "Registration failed");
  }
});

router.post("/login", loginIpLimiter, loginLimiter, async (req, res) => {
  const client = clientKind(req);
  const blocked = originProblem(req, client, false);
  if (blocked) return res.status(403).json({ error: blocked });

  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await comparePassword(password, user?.passwordHash);
    if (!user || !valid) return res.status(401).json({ error: "Invalid email or password" });

    loginLimiter.reset(`${clientIp(req)}|${email}`);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return sendSession(res, await createSession(updated, contextOf(req, client)), client);
  } catch (error) {
    return sendAuthError(res, error, "Login failed");
  }
});

// Exchange a refresh token for a new access token; the refresh token rotates.
router.post("/refresh", refreshLimiter, async (req, res) => {
  const client = clientKind(req);
  const blocked = originProblem(req, client, client === "web");
  if (blocked) return res.status(403).json({ error: blocked });

  const raw = client === "desktop" ? req.body?.refreshToken : readCookie(req, authConfig.cookieName);
  if (typeof raw !== "string" || !raw) {
    // A browser without the cookie simply has no session yet: not an error.
    if (client === "web") return res.status(204).setHeader("Cache-Control", "no-store").end();
    return res.status(401).json({ error: "No refresh token" });
  }
  try {
    const session = await rotateRefreshToken(raw, { userAgent: req.get("user-agent") ?? null, ip: clientIp(req) });
    return sendSession(res, session, client);
  } catch (error) {
    return sendAuthError(res, error, "Token refresh failed");
  }
});

// Ends this login. Needs no access token: an expired one must not keep a session alive.
router.post("/logout", async (req, res) => {
  const client = clientKind(req);
  const blocked = originProblem(req, client, false);
  if (blocked) return res.status(403).json({ error: blocked });

  const raw = client === "desktop" ? req.body?.refreshToken : readCookie(req, authConfig.cookieName);
  try {
    if (typeof raw === "string" && raw) await revokeByRefreshToken(raw, "logout");
    clearRefreshCookie(res);
    return res.json({ message: "Logged out" });
  } catch (error) {
    return sendAuthError(res, error, "Logout failed");
  }
});

router.post("/logout-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    await revokeAllSessions(req.user!.userId, "logout_all");
    disconnectUser(req.user!.userId, "Signed out everywhere");
    clearRefreshCookie(res);
    return res.json({ message: "Signed out on every device" });
  } catch (error) {
    return sendAuthError(res, error, "Logout failed");
  }
});

router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true, lastLoginAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ user });
  } catch (error) {
    return sendAuthError(res, error, "Failed to fetch user profile");
  }
});

// Change password: every other login ends, and the caller gets a fresh session.
router.post("/password", authMiddleware, passwordLimiter, async (req: AuthenticatedRequest, res) => {
  const client = clientKind(req);
  const blocked = originProblem(req, client, false);
  if (blocked) return res.status(403).json({ error: blocked });

  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const problem = passwordProblem(req.body?.newPassword);
  if (problem) return res.status(400).json({ error: problem });
  if (req.body.newPassword === currentPassword) return res.status(400).json({ error: "The new password must differ from the current one" });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
    await revokeAllSessions(user.id, "password");
    disconnectUser(user.id, "Password changed");
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return sendSession(res, await createSession(fresh, contextOf(req, client)), client);
  } catch (error) {
    return sendAuthError(res, error, "Password change failed");
  }
});

// Issue a long-lived desktop credential to the signed-in user (the dashboard hands it to Electron).
router.post("/device", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(401).json({ error: "User not found" });
    return sendSession(res, await createSession(user, contextOf(req, "desktop")), "desktop", 201);
  } catch (error) {
    return sendAuthError(res, error, "Device link failed");
  }
});

// The desktop tracker on this machine enrolls with the key file the API wrote. Local database only.
router.post("/device/local", enrollLimiter, async (req, res) => {
  if (!authConfig.localDeviceEnrollment) return res.status(404).json({ error: "Not found" });
  const remote = req.socket.remoteAddress || "";
  if (!LOOPBACK_ADDRESS.test(remote) || req.headers.origin || req.headers["x-forwarded-for"]) {
    return res.status(403).json({ error: "Local enrollment is only available to native clients on this machine" });
  }
  if (!enrollmentKeyMatches(req.body?.enrollmentKey)) return res.status(401).json({ error: "Invalid enrollment key" });
  try {
    const owner = await localOwner();
    if (!owner) return res.status(409).json({ error: "No local user exists yet" });
    return sendSession(res, await createSession(owner, contextOf(req, "desktop")), "desktop", 201);
  } catch (error) {
    return sendAuthError(res, error, "Device enrollment failed");
  }
});

router.get("/sessions", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const current = await familyOfRefreshToken(readCookie(req, authConfig.cookieName));
    res.setHeader("Cache-Control", "no-store");
    return res.json({ sessions: await listSessions(req.user!.userId, current) });
  } catch (error) {
    return sendAuthError(res, error, "Failed to list sessions");
  }
});

router.delete("/sessions/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const revoked = await revokeSession(req.user!.userId, String(req.params.id));
    if (!revoked) return res.status(404).json({ error: "Session not found" });
    return res.json({ message: "Session ended" });
  } catch (error) {
    return sendAuthError(res, error, "Failed to end session");
  }
});

export default router;
