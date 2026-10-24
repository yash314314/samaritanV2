// Where the API lives. NEXT_PUBLIC_API_URL is baked in at build time; it may
// be absolute ("https://api.example.com") or a same-origin path prefix
// ("/svc" behind the bundled nginx). Unset, the API is assumed on port 4000
// of whatever host served the dashboard, so 127.0.0.1:4001 talks to
// 127.0.0.1:4000 and the refresh cookie stays same-site.

const configuredApi = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const configuredWs = (process.env.NEXT_PUBLIC_WS_URL || "").replace(/\/+$/, "");

function browserOrigin(): { protocol: string; host: string; hostname: string } | null {
  if (typeof window === "undefined") return null;
  return window.location;
}

export function apiBase(): string {
  if (configuredApi) return configuredApi;
  const location = browserOrigin();
  if (!location) return "http://localhost:4000";
  return `${location.protocol}//${location.hostname}:4000`;
}

export function wsUrl(): string {
  if (configuredWs) return configuredWs;
  const base = apiBase();
  if (/^https?:\/\//i.test(base)) return `${base.replace(/^http/i, "ws")}/ws`;
  const location = browserOrigin();
  const scheme = location?.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location?.host ?? "localhost:4000"}${base}/ws`;
}

export const API_BASE = apiBase();
