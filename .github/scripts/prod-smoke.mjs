// End-to-end check of the production stack (docker-compose.prod.yml) from the
// outside, through nginx, the way a browser and a user reach it.
//
//   node .github/scripts/prod-smoke.mjs <public origin> [--after-restart] [--browser <dir>]
//
// SMOKE_EMAIL and SMOKE_PASSWORD name the account the first run registers and
// --after-restart signs in with, proving the data and the signing key survived
// an API restart. --browser <dir> also drives the real dashboard in Chrome,
// using the puppeteer-core installed in <dir> and the Chrome at CHROME_BIN.
// Every expectation is reported; the exit code is the number of failures.
import { createRequire } from "node:module";
import path from "node:path";

const [origin, ...flags] = process.argv.slice(2);
const afterRestart = flags.includes("--after-restart");
const browserIndex = flags.indexOf("--browser");
const puppeteerDir = browserIndex === -1 ? null : flags[browserIndex + 1];
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
if (!origin || !email || !password || (browserIndex !== -1 && !puppeteerDir)) {
  console.error("Usage: SMOKE_EMAIL=… SMOKE_PASSWORD=… node prod-smoke.mjs <origin> [--after-restart] [--browser <dir>]");
  process.exit(2);
}

const COOKIE = "samaritan_refresh";
const COOKIE_PATH = "/svc/api/auth";
const wsOrigin = origin.replace(/^http/i, "ws");
let failures = 0;

function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `  ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures += 1;
  return ok;
}

/** A check the rest of the run depends on: stop here when it fails. */
function mustPass(name, ok, detail) {
  if (check(name, ok, detail)) return;
  console.log(`${failures} FAILED (stopped early)`);
  process.exit(failures);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, route, { token, cookie, from = origin, body, client } = {}) {
  const headers = {};
  if (from) headers.Origin = from;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = `${COOKIE}=${cookie}`;
  if (client) headers["X-Samaritan-Client"] = client;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${origin}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, json, text };
}

/** The refresh cookie a response sets, with its attributes. */
function refreshCookie(response) {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${COOKIE}=`));
  if (!line) return null;
  const [pair, ...attributes] = line.split(";").map((part) => part.trim());
  return {
    value: decodeURIComponent(pair.slice(COOKIE.length + 1)),
    attributes: attributes.map((attribute) => attribute.toLowerCase()),
  };
}

function cookieIsLockedDown(cookie) {
  const has = (attribute) => cookie.attributes.includes(attribute);
  return has("httponly") && has("secure") && has("samesite=strict") && has(`path=${COOKIE_PATH}`);
}

/** Opens the API socket through nginx; resolves with the agreed subprotocol, or null if refused. */
function openSocket(protocols) {
  return new Promise((resolve) => {
    const socket = new WebSocket(`${wsOrigin}/svc/ws`, protocols);
    const timer = setTimeout(() => {
      socket.close();
      resolve(null);
    }, 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      const agreed = socket.protocol;
      socket.close();
      resolve(agreed);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

console.log(`Smoke test of ${origin}${afterRestart ? " after an API restart" : ""}`);

// The edge: the dashboard is served with nginx's security headers, once each.
const home = await fetch(`${origin}/`);
const csp = home.headers.get("content-security-policy") || "";
check("dashboard is served", home.status === 200 && /text\/html/.test(home.headers.get("content-type") || ""), home.status);
check("CSP is same-origin and forbids framing", csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'"), csp);
check("X-Frame-Options is DENY", home.headers.get("x-frame-options") === "DENY", home.headers.get("x-frame-options"));
check("nginx does not announce its version", home.headers.get("server") === "nginx", home.headers.get("server"));

const health = await call("GET", "/health", { from: null });
mustPass("API and database are healthy", health.status === 200 && health.json?.db === "ok", health.json ?? health.status);

const config = await call("GET", "/svc/api/auth/config");
check("API responses carry each security header once", config.headers.get("x-frame-options") === "DENY" && config.headers.get("x-content-type-options") === "nosniff", {
  frame: config.headers.get("x-frame-options"),
  sniff: config.headers.get("x-content-type-options"),
});
check("API does not announce Express", !config.headers.has("x-powered-by"), config.headers.get("x-powered-by"));
check("registration is open on the global database", config.json?.registrationOpen === true, config.json);

// Access control at the door.
const anonymous = await call("GET", "/svc/api/projects");
check("data routes refuse requests without a token", anonymous.status === 401, anonymous.status);
const foreign = await call("POST", "/svc/api/auth/login", { from: "https://evil.example", body: { email, password } });
check("sign-in from a foreign origin is refused", foreign.status === 403, foreign.status);

// Sign up (first run) or sign in (after restart) as a browser would.
const session = afterRestart
  ? await call("POST", "/svc/api/auth/login", { body: { email, password } })
  : await call("POST", "/svc/api/auth/register", { body: { email, password, name: "Smoke Test" } });
const token = session.json?.accessToken;
mustPass(afterRestart ? "the account survived the restart and signs in" : "a new account registers", session.status === (afterRestart ? 200 : 201) && typeof token === "string", {
  status: session.status,
  error: session.json?.error,
});
const issued = refreshCookie(session);
mustPass("the refresh cookie is set", Boolean(issued), session.headers.getSetCookie());
check("the refresh cookie is HttpOnly, Secure, SameSite=Strict and scoped to the auth path", cookieIsLockedDown(issued), issued.attributes);
check("browser sign-in returns no refresh token in the body", !("refreshToken" in session.json), Object.keys(session.json));

const me = await call("GET", "/svc/api/auth/me", { token });
check("the access token identifies the account", me.status === 200 && me.json?.user?.email === email.toLowerCase(), me.json ?? me.status);
const projects = await call("GET", "/svc/api/projects", { token });
check("an authenticated data route answers", projects.status === 200 && Array.isArray(projects.json), projects.status);
const adminOnly = await call("GET", "/svc/api/system/database", { token });
check("admin routes refuse an ordinary user", adminOnly.status === 403, adminOnly.status);

// Refresh: the cookie alone is not enough, the request must come from the dashboard.
const noOrigin = await call("POST", "/svc/api/auth/refresh", { cookie: issued.value, from: null });
check("refresh without an Origin is refused", noOrigin.status === 403, noOrigin.status);
const refreshed = await call("POST", "/svc/api/auth/refresh", { cookie: issued.value });
const rotated = refreshCookie(refreshed);
check(
  "refresh issues a new access token and rotates the cookie",
  refreshed.status === 200 && typeof refreshed.json?.accessToken === "string" && Boolean(rotated) && rotated.value !== issued.value,
  { status: refreshed.status, error: refreshed.json?.error },
);

// The live channel, through nginx's upgrade route.
check("the WebSocket opens with a valid token", (await openSocket(["samaritan", `bearer.${token}`])) === "samaritan");
check("the WebSocket refuses a connection without a token", (await openSocket(["samaritan"])) === null);

// Sign out ends the login.
const current = rotated?.value ?? issued.value;
const logout = await call("POST", "/svc/api/auth/logout", { cookie: current });
check("sign-out succeeds", logout.status >= 200 && logout.status < 300, logout.status);
const afterLogout = await call("POST", "/svc/api/auth/refresh", { cookie: current });
check("a signed-out cookie no longer refreshes", afterLogout.status === 401, afterLogout.status);

if (puppeteerDir) await browserChecks();

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures);

/** Signs in through the real dashboard: CSP, API prefix, cookie path and socket as Chrome sees them. */
async function browserChecks() {
  const puppeteer = createRequire(path.join(path.resolve(puppeteerDir), "noop.js"))("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless: true,
    // CI runners restrict the user namespaces Chrome's sandbox needs.
    args: ["--no-sandbox", "--lang=en-US"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("samaritan_v2_tour_completed", "true"));

    const consoleErrors = [];
    const badResponses = [];
    const foreignRequests = [];
    let apiRequests = 0;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));
    page.on("request", (request) => {
      const url = request.url();
      if (/^(data|blob):/.test(url)) return;
      if (!url.startsWith(`${origin}/`)) foreignRequests.push(url);
      else if (url.startsWith(`${origin}/svc/`)) apiRequests += 1;
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().startsWith(origin)) badResponses.push(`${response.status()} ${response.url()}`);
    });
    const sockets = new Map();
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    cdp.on("Network.webSocketCreated", (event) => sockets.set(event.requestId, { url: event.url, status: null }));
    cdp.on("Network.webSocketHandshakeResponseReceived", (event) => {
      const socket = sockets.get(event.requestId);
      if (socket) socket.status = event.response.status;
    });

    await page.goto(`${origin}/login`, { waitUntil: "networkidle0" });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    const signedIn = await page
      .waitForFunction(() => location.pathname !== "/login", { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    check("signing in through the dashboard leaves the login page", signedIn, await page.evaluate(() => document.body.innerText.slice(0, 200)));
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 }).catch(() => undefined);
    await sleep(1500);

    check("the dashboard calls the API through /svc", apiRequests > 0, apiRequests);
    check("the dashboard loads nothing from other origins", foreignRequests.length === 0, foreignRequests);
    const live = [...sockets.values()].filter((socket) => socket.url === `${wsOrigin}/svc/ws`);
    check("the dashboard's live socket connects through nginx", live.some((socket) => socket.status === 101), [...sockets.values()]);
    const cookie = (await page.cookies()).find((entry) => entry.name === COOKIE);
    check("Chrome stores the refresh cookie HttpOnly and scoped to the auth path", Boolean(cookie?.httpOnly && cookie.path === COOKIE_PATH), cookie && { path: cookie.path, httpOnly: cookie.httpOnly });

    await page.reload({ waitUntil: "networkidle0" });
    await sleep(1000);
    check("the session survives a reload", await page.evaluate(() => location.pathname !== "/login"));

    const blocked = consoleErrors.filter((text) => /Content Security Policy|Refused to/i.test(text));
    check("no Content Security Policy violations", blocked.length === 0, blocked);
    check("no other console errors", consoleErrors.length === blocked.length, consoleErrors);
    check("no failed requests", badResponses.length === 0, badResponses);
  } finally {
    await browser.close();
  }
}
