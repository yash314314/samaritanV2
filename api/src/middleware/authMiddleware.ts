import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload, VerifiedToken } from "../utils/jwt";
import { currentTokenVersion, familyIsActive } from "../services/authService";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Verifies an access token and that it has not been revoked: the user still
 * exists, no password change or "sign out everywhere" happened since
 * (tokenVersion), and its own login was not signed out (familyId).
 * Resolves the payload or null.
 */
export async function authenticateToken(token: string | null): Promise<VerifiedToken | null> {
  if (!token) return null;
  let payload: VerifiedToken;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  return (await tokenStillValid(payload)) ? payload : null;
}

/** Revocation checks for an already-verified token (also re-run for open sockets). */
export async function tokenStillValid(payload: TokenPayload): Promise<boolean> {
  const version = await currentTokenVersion(payload.userId);
  if (version === null || version !== payload.tokenVersion) return false;
  return familyIsActive(payload.familyId, payload.userId);
}

/** Rejects the request with 401 unless it carries a valid `Authorization: Bearer` access token. */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="samaritan"');
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = await authenticateToken(token);
    if (!payload) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="samaritan", error="invalid_token"');
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

export const requireAuth = authMiddleware;

function claimedUserIds(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Pins every request to the authenticated user. Routes still read `userId`
 * from the query string or body; a `userId` naming anyone else is refused,
 * and a missing one is filled in, so no handler can be steered at another
 * user's data.
 */
export function enforceUserScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : null;
  const claimed = [...claimedUserIds((req.query as Record<string, unknown>).userId), ...claimedUserIds(body?.userId)];
  if (claimed.some((value) => value !== userId)) {
    return res.status(403).json({ error: "userId does not match the authenticated user" });
  }

  // Express 5 exposes req.query as a getter; shadow it with the scoped copy.
  Object.defineProperty(req, "query", {
    value: { ...(req.query as Record<string, unknown>), userId },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  if (body) body.userId = userId;
  else if (req.body === undefined) req.body = { userId };
  next();
}

export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}
