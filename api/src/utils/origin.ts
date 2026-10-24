// Browser origins the API answers. Every data route requires a bearer access
// token, so CORS here only decides which pages may read responses; the
// stricter list below decides which pages may use the refresh cookie, the one
// credential a browser sends on its own.
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
// The dashboard's own origins when nothing is configured (serve.mjs and next dev).
const DEFAULT_DASHBOARD_ORIGINS = ["http://localhost:4001", "http://127.0.0.1:4001", "http://[::1]:4001"];

function list(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const configuredOrigins = list(process.env.CORS_ORIGIN);
const credentialOrigins = (() => {
  const explicit = list(process.env.AUTH_ORIGINS);
  if (explicit.length > 0) return explicit;
  const fromCors = configuredOrigins.filter((origin) => origin !== "*");
  return fromCors.length > 0 ? fromCors : DEFAULT_DASHBOARD_ORIGINS;
})();

export function isAllowedOrigin(origin?: string | null): boolean {
  // Native clients (Electron main process, curl, scripts) send no Origin.
  if (!origin) return true;
  if (configuredOrigins.includes("*")) return true;
  if (configuredOrigins.length > 0) return configuredOrigins.includes(origin);
  return LOOPBACK_ORIGIN.test(origin);
}

/**
 * Origins allowed to send and read credentialed (cookie) requests. Ports do
 * not separate cookies, so "any localhost page" would let every other local
 * web app mint access tokens from the refresh cookie; only the dashboard may.
 */
export function isCredentialOrigin(origin?: string | null): boolean {
  return Boolean(origin) && credentialOrigins.includes(origin as string);
}
