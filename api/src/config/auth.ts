import "dotenv/config"; // authConfig below is computed at import time
import { randomBytes } from "crypto";
import path from "path";
import { resolveDatabaseConfig } from "./database";

// Authentication settings, read once at startup. A weak or missing signing
// secret is fatal wherever the API can be reached by more than its owner:
// in production and whenever it serves the shared (global) database.

export interface AuthConfig {
  accessSecret: string;
  /** True when no JWT_SECRET was configured and a per-process secret is in use. */
  ephemeralSecret: boolean;
  accessTtlSeconds: number;
  refreshTtlDays: number;
  deviceRefreshTtlDays: number;
  issuer: string;
  audience: string;
  allowRegistration: boolean;
  cookieName: string;
  cookieSecure: boolean;
  /** Lets the desktop tracker on the same machine enroll with a key file instead of a login. */
  localDeviceEnrollment: boolean;
  enrollmentKeyFile: string;
  localOwnerUserId: string | null;
}

const MIN_SECRET_LENGTH = 32;
const KNOWN_WEAK_SECRETS = new Set([
  "samaritan_super_secret_jwt_key_2026",
  "samaritan_super_secret_refresh_key_2026",
  "change-me",
  "changeme",
  "secret",
  "jwt_secret",
]);

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Expected a boolean, got "${value}"`);
}

function positiveNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const production = env.NODE_ENV === "production";
  const target = resolveDatabaseConfig(env).target;
  const strict = production || target === "global";

  const configuredSecret = env.JWT_SECRET?.trim() || "";
  if (configuredSecret && (configuredSecret.length < MIN_SECRET_LENGTH || KNOWN_WEAK_SECRETS.has(configuredSecret))) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} random characters and not a published default`);
  }
  if (!configuredSecret && strict) {
    throw new Error(
      `JWT_SECRET is required when NODE_ENV=production or DATABASE_TARGET=global. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }

  return {
    accessSecret: configuredSecret || randomBytes(48).toString("base64url"),
    ephemeralSecret: !configuredSecret,
    accessTtlSeconds: Math.round(positiveNumber(env.ACCESS_TOKEN_TTL_MINUTES, 15, "ACCESS_TOKEN_TTL_MINUTES") * 60),
    refreshTtlDays: positiveNumber(env.REFRESH_TOKEN_TTL_DAYS, 30, "REFRESH_TOKEN_TTL_DAYS"),
    deviceRefreshTtlDays: positiveNumber(env.DEVICE_TOKEN_TTL_DAYS, 90, "DEVICE_TOKEN_TTL_DAYS"),
    issuer: "samaritan",
    audience: "samaritan-api",
    allowRegistration: flag(env.ALLOW_REGISTRATION, target === "global"),
    cookieName: "samaritan_refresh",
    cookieSecure: flag(env.AUTH_COOKIE_SECURE, production),
    localDeviceEnrollment: target === "local" && flag(env.LOCAL_DEVICE_ENROLLMENT, true),
    enrollmentKeyFile:
      env.DEVICE_ENROLLMENT_KEY_FILE || path.resolve(__dirname, "../../../.runtime/device-enrollment.key"),
    localOwnerUserId: env.LOCAL_OWNER_USER_ID?.trim() || null,
  };
}

export const authConfig = loadAuthConfig();
