// Desktop credentials. The tracker holds a long-lived device refresh token
// (encrypted with the OS keychain through safeStorage when one is available)
// and trades it for short-lived access tokens. It gets that device token in
// one of two ways:
//   1. Local enrollment: the API on this machine writes a key file readable by
//      this OS user only; presenting it enrolls the tracker for the local owner.
//   2. Dashboard link: after signing in, the dashboard window mints a device
//      token for its user and hands it over through IPC (see main.js).
const { safeStorage } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Store = require("electron-store");

const store = new Store();
const API_BASE = (process.env.SAMARITAN_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const ENROLLMENT_KEY_FILE =
  process.env.SAMARITAN_ENROLLMENT_KEY_FILE || path.resolve(__dirname, "../.runtime/device-enrollment.key");
const CLIENT_HEADERS = { "Content-Type": "application/json", "X-Samaritan-Client": "desktop" };
// Refresh a minute early so a request never leaves with a token about to lapse.
const EXPIRY_MARGIN_MS = 60 * 1000;

const DEVICE_ID = store.get("deviceId") || crypto.randomUUID();
store.set("deviceId", DEVICE_ID);
// Credentials from before authentication existed are meaningless now.
store.delete("authToken");

let access = null; // { token, expiresAt, userId }
let refreshing = null;
const listeners = new Set();

function emit() {
  const state = status();
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error("[Auth] Listener error:", err);
    }
  }
}

function readRefreshToken() {
  const entry = store.get("auth.refresh");
  if (!entry || typeof entry.data !== "string") return null;
  try {
    return entry.encrypted ? safeStorage.decryptString(Buffer.from(entry.data, "base64")) : entry.data;
  } catch (err) {
    console.warn("[Auth] Stored device credential could not be decrypted:", err.message);
    return null;
  }
}

function writeRefreshToken(token) {
  if (safeStorage.isEncryptionAvailable()) {
    store.set("auth.refresh", { encrypted: true, data: safeStorage.encryptString(token).toString("base64") });
  } else {
    store.set("auth.refresh", { encrypted: false, data: token });
  }
}

function clearCredentials() {
  store.delete("auth.refresh");
  store.delete("auth.userId");
  access = null;
  emit();
}

// Key-file enrollment signs the tracker in as the machine's owner. It runs
// only until someone links the tracker from the dashboard or signs it out:
// after that, a rejected credential leaves the tracker signed out instead of
// silently switching it to another account.
function autoEnrollAllowed() {
  return store.get("auth.autoEnroll") !== false;
}

/** Takes in a session answer from the API (login, refresh, device link or enrollment). */
function adopt(body) {
  if (!body || typeof body.accessToken !== "string" || !body.user?.id) {
    throw new Error("Malformed session response");
  }
  if (body.refreshToken) writeRefreshToken(body.refreshToken);
  const wasSignedOut = !access;
  const previousUser = store.get("auth.userId");
  store.set("auth.userId", body.user.id);
  // Remembered past sign-out so queued activity is only ever delivered to its account.
  store.set("auth.lastUserId", body.user.id);
  access = {
    token: body.accessToken,
    expiresAt: Date.parse(body.accessTokenExpiresAt) || Date.now() + 5 * 60 * 1000,
    userId: body.user.id,
  };
  if (wasSignedOut || previousUser !== body.user.id) emit();
}

async function post(pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: CLIENT_HEADERS,
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Empty or non-JSON body.
  }
  return { status: response.status, body: json };
}

async function enrollLocally() {
  let key;
  try {
    key = fs.readFileSync(ENROLLMENT_KEY_FILE, "utf8").trim();
  } catch {
    return false;
  }
  if (!key) return false;
  const response = await post("/api/auth/device/local", { enrollmentKey: key, deviceId: DEVICE_ID });
  if (response.status === 201) {
    adopt(response.body);
    console.log("[Auth] Enrolled with the local key file for user", response.body.user.id);
    return true;
  }
  if (response.status !== 404) {
    console.warn("[Auth] Local enrollment refused:", response.status, response.body?.error || "");
  }
  return false;
}

async function refresh() {
  const token = readRefreshToken();
  if (!token) return autoEnrollAllowed() && (await enrollLocally()) ? access.token : null;

  const response = await post("/api/auth/refresh", { refreshToken: token });
  if (response.status === 200) {
    adopt(response.body);
    return access.token;
  }
  if (response.status === 401 || response.status === 403) {
    // Revoked, expired or replaced: start over rather than retry a dead token.
    console.warn("[Auth] Device credential rejected (HTTP %d)", response.status);
    clearCredentials();
    return autoEnrollAllowed() && (await enrollLocally()) ? access.token : null;
  }
  // Network trouble or a server error: keep the credential and let callers retry.
  throw new Error(`Token refresh failed: HTTP ${response.status}`);
}

/** Drops the cached access token so the next request refreshes first. */
function invalidateAccessToken() {
  access = null;
}

/**
 * A valid access token that lasts at least `minValidityMs`, or null when this
 * device is not signed in. Concurrent callers share one refresh.
 */
async function getAccessToken(minValidityMs = EXPIRY_MARGIN_MS) {
  if (access && access.expiresAt - Date.now() > minValidityMs) return access.token;
  if (!refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

class NotAuthenticatedError extends Error {
  constructor() {
    super("Desktop is not signed in");
    this.code = "NOT_AUTHENTICATED";
  }
}

/** fetch() with the device's access token; one transparent retry after a 401. */
async function authFetch(url, init = {}) {
  const withToken = (token) => ({ ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  const token = await getAccessToken();
  if (!token) throw new NotAuthenticatedError();
  let response = await fetch(url, withToken(token));
  if (response.status === 401) {
    access = null;
    const retry = await getAccessToken();
    if (!retry) throw new NotAuthenticatedError();
    response = await fetch(url, withToken(retry));
  }
  return response;
}

/** Stores a device token minted by the signed-in dashboard and proves it works. */
async function linkFromDashboard(refreshToken) {
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 200) {
    throw new Error("Invalid device token");
  }
  writeRefreshToken(refreshToken);
  store.set("auth.autoEnroll", false);
  access = null;
  const token = await getAccessToken();
  if (!token) throw new Error("The device token was refused");
  emit();
  return status();
}

async function signOut() {
  const token = readRefreshToken();
  if (token) await post("/api/auth/logout", { refreshToken: token }).catch(() => undefined);
  store.set("auth.autoEnroll", false);
  clearCredentials();
}

/** The account queued activity belongs to: the signed-in one, else the last one. */
function activityOwnerId() {
  return access?.userId || store.get("auth.userId") || store.get("auth.lastUserId") || null;
}

function status() {
  return { linked: Boolean(readRefreshToken()), userId: access?.userId || store.get("auth.userId") || null, deviceId: DEVICE_ID };
}

function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

module.exports = {
  API_BASE,
  DEVICE_ID,
  NotAuthenticatedError,
  authFetch,
  getAccessToken,
  invalidateAccessToken,
  linkFromDashboard,
  signOut,
  status,
  onChange,
  activityOwnerId,
};
