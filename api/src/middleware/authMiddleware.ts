import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";
import { currentTokenVersion } from "../services/authService";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Verifies an access token and that it has not been revoked (user deleted,
 * password changed, logged out everywhere). Resolves the payload or null.
 */
export async function authenticateToken(token: string | null): Promise<TokenPayload | null> {
  if (!token) return null;
  let payload: TokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  const version = await currentTokenVersion(payload.userId);
  if (version === null || version !== payload.tokenVersion) return null;
  return payload;
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
