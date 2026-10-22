// Samaritan is single-user and the API trusts the userId it is given, so the
// browser origin is the boundary that stops other websites from reading
// tracked activity through the local API (CORS) or WebSocket (no CORS at all).
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isAllowedOrigin(origin?: string | null): boolean {
  // Native clients (Electron main process, curl, scripts) send no Origin.
  if (!origin) return true;
  if (configuredOrigins.includes("*")) return true;
  if (configuredOrigins.length > 0) return configuredOrigins.includes(origin);
  return LOOPBACK_ORIGIN.test(origin);
}
