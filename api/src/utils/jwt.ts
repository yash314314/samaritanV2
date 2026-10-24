import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { authConfig } from "../config/auth";

// Short-lived access tokens only. Refresh tokens are opaque random strings
// kept (hashed) in the database, see services/authService.ts.

export interface TokenPayload {
  userId: string;
  email: string | null;
  role: string;
  /** Must match User.tokenVersion; a password change or "log out everywhere" bumps it. */
  tokenVersion: number;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { email: payload.email, role: payload.role, tv: payload.tokenVersion, typ: "access" },
    authConfig.accessSecret,
    {
      algorithm: "HS256",
      subject: payload.userId,
      expiresIn: authConfig.accessTtlSeconds,
      issuer: authConfig.issuer,
      audience: authConfig.audience,
      jwtid: randomUUID(),
    }
  );
}

export function accessTokenExpiry(from = new Date()): Date {
  return new Date(from.getTime() + authConfig.accessTtlSeconds * 1000);
}

/** Verifies signature, algorithm, issuer, audience and expiry. Throws on any failure. */
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, authConfig.accessSecret, {
    algorithms: ["HS256"],
    issuer: authConfig.issuer,
    audience: authConfig.audience,
  });
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || decoded.typ !== "access") {
    throw new jwt.JsonWebTokenError("Malformed access token");
  }
  return {
    userId: decoded.sub,
    email: typeof decoded.email === "string" ? decoded.email : null,
    role: typeof decoded.role === "string" ? decoded.role : "user",
    tokenVersion: typeof decoded.tv === "number" ? decoded.tv : -1,
  };
}
