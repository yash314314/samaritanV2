import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromQuery = req.query.token as string;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : tokenFromQuery;

  if (!token) {
    return res.status(401).json({ error: "Authentication token missing" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromQuery = req.query.token as string;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : tokenFromQuery;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = payload;
    } catch {
      // Ignore token verification errors in optional auth
    }
  }
  next();
}
