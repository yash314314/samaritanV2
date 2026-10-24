"use client";

import { apiBase } from "./apiBase";

// Browser side of authentication. The access token lives in memory only, so
// a script injected into the page cannot lift a long-lived credential from
// storage; the refresh token is an HttpOnly cookie the page never sees.
// Reloading the page restores the session through /api/auth/refresh.

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  expiresAt: number;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Sign in required");
  }
}

// Refresh this long before expiry so requests never leave with a lapsing token.
const EXPIRY_MARGIN_MS = 60 * 1000;
// Pre-auth builds stored a bearer token here; it is not trusted any more.
const LEGACY_TOKEN_KEY = "samaritan_token";

let state: AuthState = { user: null, accessToken: null, expiresAt: 0 };
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentUser(): AuthUser | null {
  return state.user;
}

/** The signed-in user's id; empty before sign-in (the API fills it in from the token). */
export function getUserId(): string {
  return state.user?.id ?? "";
}

function adopt(body: { user: AuthUser; accessToken: string; accessTokenExpiresAt?: string }) {
  setState({
    user: body.user,
    accessToken: body.accessToken,
    expiresAt: body.accessTokenExpiresAt ? Date.parse(body.accessTokenExpiresAt) : Date.now() + 5 * 60 * 1000,
  });
}

function signedOut() {
  if (state.user || state.accessToken) setState({ user: null, accessToken: null, expiresAt: 0 });
}

async function authPost(path: string, body?: unknown, token?: string | null) {
  const response = await fetch(`${apiBase()}/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // Empty body.
  }
  return { ok: response.ok, status: response.status, body: json };
}

/** Uses the refresh cookie to get a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const result = await authPost("/refresh");
        if (result.ok && result.body?.accessToken) {
          adopt(result.body);
          return true;
        }
        // 204: no session cookie at all; 401/403: the session ended.
        if (result.status === 204 || result.status === 401 || result.status === 403) signedOut();
        return false;
      } catch {
        // API unreachable: keep whatever state we have.
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/**
 * A usable access token, refreshing first when it would lapse within
 * `minValidityMs`; null when signed out.
 */
export async function getAccessToken(minValidityMs = EXPIRY_MARGIN_MS): Promise<string | null> {
  if (state.accessToken && state.expiresAt - Date.now() > minValidityMs) return state.accessToken;
  const refreshed = await refreshSession();
  return refreshed ? state.accessToken : null;
}

/** fetch() with the access token attached; retries once through a refresh after a 401. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) =>
    fetch(input, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  const token = await getAccessToken();
  if (!token) throw new AuthRequiredError();
  let response = await send(token);
  if (response.status === 401) {
    state = { ...state, accessToken: null, expiresAt: 0 };
    const retry = await getAccessToken();
    if (!retry) throw new AuthRequiredError();
    response = await send(retry);
    if (response.status === 401) signedOut();
  }
  return response;
}

async function authAction(path: string, body: unknown) {
  const result = await authPost(path, body);
  if (!result.ok) throw new Error(result.body?.error || `Request failed (${result.status})`);
  adopt(result.body);
  return result.body.user as AuthUser;
}

export function login(email: string, password: string) {
  return authAction("/login", { email, password });
}

export function register(name: string, email: string, password: string) {
  return authAction("/register", { name, email, password });
}

export async function logout(): Promise<void> {
  try {
    await authPost("/logout");
  } finally {
    signedOut();
  }
}

export async function logoutEverywhere(): Promise<void> {
  const token = await getAccessToken();
  try {
    await authPost("/logout-all", undefined, token);
  } finally {
    signedOut();
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = await getAccessToken();
  const result = await authPost("/password", { currentPassword, newPassword }, token);
  if (!result.ok) throw new Error(result.body?.error || `Password change failed (${result.status})`);
  adopt(result.body);
}

/** Restores the session on page load. Resolves the user, or null when signed out. */
export async function restoreSession(): Promise<AuthUser | null> {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage may be blocked; nothing to clean then.
  }
  if (state.user && (await getAccessToken())) return state.user;
  return (await refreshSession()) ? state.user : null;
}

export async function authConfig(): Promise<{ registrationOpen: boolean }> {
  try {
    const response = await fetch(`${apiBase()}/api/auth/config`, { cache: "no-store" });
    if (response.ok) return await response.json();
  } catch {
    // Fall through to the conservative default.
  }
  return { registrationOpen: false };
}

export interface SessionInfo {
  id: string;
  client: string;
  userAgent: string | null;
  startedAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

export async function listSessions(): Promise<SessionInfo[]> {
  const response = await authFetch(`${apiBase()}/api/auth/sessions`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load sessions (${response.status})`);
  return (await response.json()).sessions;
}

export async function endSession(id: string): Promise<void> {
  const response = await authFetch(`${apiBase()}/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Failed to end session (${response.status})`);
}

// ─── Electron tracker link ─────────────────────────────────────────────

interface DesktopBridge {
  status: () => Promise<{ linked: boolean; userId: string | null; deviceId?: string }>;
  link: (refreshToken: string) => Promise<{ linked: boolean; userId: string | null }>;
  unlink: () => Promise<unknown>;
}

function desktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { samaritanDesktop?: DesktopBridge }).samaritanDesktop ?? null;
}

/**
 * Inside the Electron app, makes sure the tracker records for the signed-in
 * user: when it holds no credential, or one for someone else, the dashboard
 * mints a device credential and hands it over.
 */
export async function linkDesktopTracker(): Promise<void> {
  const bridge = desktopBridge();
  const user = state.user;
  if (!bridge || !user) return;
  const current = await bridge.status().catch(() => null);
  if (current?.linked && current.userId === user.id) return;
  const response = await authFetch(`${apiBase()}/api/auth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: current?.deviceId ?? "electron" }),
  });
  if (!response.ok) throw new Error(`Device link failed (${response.status})`);
  const body = await response.json();
  await bridge.link(body.refreshToken);
}
