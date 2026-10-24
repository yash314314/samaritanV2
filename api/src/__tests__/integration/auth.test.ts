import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import { promises as fs } from "fs";
import {
  call,
  DASHBOARD_ORIGIN,
  prisma,
  refreshCookie,
  registerUser,
  resetDatabase,
  startServer,
  type TestServer,
} from "./harness";
import { resetAuthRateLimits } from "../../routes/auth";
import { ensureEnrollmentKey, hashToken } from "../../services/authService";
import { authConfig } from "../../config/auth";

let server: TestServer;

before(async () => {
  server = await startServer();
});

after(async () => {
  await server.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  resetAuthRateLimits();
});

function signWith(secret: string, claims: Record<string, unknown>, options: jwt.SignOptions = {}) {
  return jwt.sign({ typ: "access", tv: 0, role: "user", ...claims }, secret, {
    algorithm: "HS256",
    issuer: authConfig.issuer,
    audience: authConfig.audience,
    expiresIn: 300,
    ...options,
  });
}

describe("access control", () => {
  test("health stays public; data routes demand a bearer token", async () => {
    assert.equal((await call(server, "GET", "/health")).status, 200);
    const denied = await call(server, "GET", "/api/goals");
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get("www-authenticate") || "", /Bearer/);
    assert.equal((await call(server, "GET", "/analytics/dashboard?days=7")).status, 401);
    assert.equal((await call(server, "POST", "/activity/session", { body: { app: "x" } })).status, 401);
  });

  test("forged, expired, mis-addressed and alg=none tokens are rejected", async () => {
    const user = await registerUser(server);
    const sub = { subject: user.userId };
    const forged = signWith("some-other-secret-that-is-long-enough-000", {}, sub);
    const expired = signWith(authConfig.accessSecret, {}, { ...sub, expiresIn: -10 });
    const wrongAudience = signWith(authConfig.accessSecret, {}, { ...sub, audience: "someone-else" });
    const refreshTyped = signWith(authConfig.accessSecret, { typ: "refresh" }, sub);
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(
      JSON.stringify({ sub: user.userId, typ: "access", tv: 0, iss: authConfig.issuer, aud: authConfig.audience })
    ).toString("base64url")}.`;
    for (const token of [forged, expired, wrongAudience, refreshTyped, unsigned, `${user.accessToken}x`]) {
      assert.equal((await call(server, "GET", "/api/goals", { token })).status, 401, token.slice(0, 24));
    }
    assert.equal((await call(server, "GET", "/api/goals", { token: user.accessToken })).status, 200);
  });

  test("a token for a deleted user stops working", async () => {
    const user = await registerUser(server);
    await prisma.user.delete({ where: { id: user.userId } });
    await new Promise((resolve) => setTimeout(resolve, 5_100)); // token-version cache
    assert.equal((await call(server, "GET", "/api/goals", { token: user.accessToken })).status, 401);
  });

  test("userId in the query or body must be the caller's own; a missing one is filled in", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    assert.equal((await call(server, "GET", `/api/goals?userId=${bob.userId}`, { token: alice.accessToken })).status, 403);
    assert.equal(
      (await call(server, "POST", "/api/goals", { token: alice.accessToken, body: { userId: bob.userId, title: "x", target: 1 } })).status,
      403
    );
    assert.equal((await call(server, "GET", `/api/goals?userId=${alice.userId}&userId=${bob.userId}`, { token: alice.accessToken })).status, 403);
    const created = await call(server, "POST", "/api/goals", { token: alice.accessToken, body: { title: "Mine", target: 30 } });
    assert.ok([200, 201].includes(created.status));
    const stored = await prisma.goal.findUniqueOrThrow({ where: { id: created.body.id } });
    assert.equal(stored.userId, alice.userId);
  });
});

describe("cross-user isolation", () => {
  test("another user's goal cannot be read, edited, archived or restored", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    const goal = await call(server, "POST", "/api/goals", { token: alice.accessToken, body: { title: "Alice goal", target: 60 } });
    assert.ok([200, 201].includes(goal.status));
    const id = goal.body.id;

    const list = await call(server, "GET", "/api/goals", { token: bob.accessToken });
    assert.equal(list.status, 200);
    assert.ok(!JSON.stringify(list.body).includes(id));
    assert.equal((await call(server, "GET", `/api/goals/${id}/history`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "PATCH", `/api/goals/${id}`, { token: bob.accessToken, body: { title: "pwned" } })).status, 404);
    assert.equal((await call(server, "DELETE", `/api/goals/${id}`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "POST", `/api/goals/${id}/restore`, { token: bob.accessToken, body: {} })).status, 404);
    const untouched = await prisma.goal.findUniqueOrThrow({ where: { id } });
    assert.equal(untouched.title, "Alice goal");
    assert.equal(untouched.active, true);
  });

  test("another user's project, its rules and links to it are out of reach", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    const project = await call(server, "POST", "/api/projects", { token: alice.accessToken, body: { name: "Alice project" } });
    assert.ok([200, 201].includes(project.status), JSON.stringify(project.body));
    const projectId = project.body.id ?? project.body.project?.id;
    const rule = await call(server, "POST", `/api/projects/${projectId}/rules`, { token: alice.accessToken, body: { appName: "code" } });
    assert.equal(rule.status, 200);

    assert.equal((await call(server, "GET", `/api/projects/${projectId}/rules`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "POST", `/api/projects/${projectId}/rules`, { token: bob.accessToken, body: { appName: "x" } })).status, 404);
    assert.equal((await call(server, "PATCH", `/api/projects/${projectId}/rules/${rule.body.id}`, { token: bob.accessToken, body: { appName: "x" } })).status, 404);
    assert.equal((await call(server, "DELETE", `/api/projects/${projectId}/rules/${rule.body.id}`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "DELETE", `/api/projects/${projectId}`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "PATCH", `/api/projects/${projectId}`, { token: bob.accessToken, body: { name: "pwned" } })).status, 404);
    assert.equal((await call(server, "GET", `/api/projects/${projectId}/dashboard`, { token: bob.accessToken })).status, 404);
    // Bob cannot attach Alice's project to his own goal or calendar event.
    assert.equal((await call(server, "POST", "/api/goals", { token: bob.accessToken, body: { title: "g", target: 1, projectId } })).status, 404);
    const event = await call(server, "POST", "/api/calendar", {
      token: bob.accessToken,
      body: { title: "e", startAt: "2026-10-25T10:00:00+05:30", endAt: "2026-10-25T11:00:00+05:30", projectId },
    });
    assert.equal(event.status, 404, JSON.stringify(event.body));
    assert.equal((await prisma.projectRule.count({ where: { projectId } })), 1);
    assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).active, true);
  });

  test("another user's calendar event and report cannot be deleted or read", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    const event = await call(server, "POST", "/api/calendar", {
      token: alice.accessToken,
      body: { title: "Alice meeting", startAt: "2026-10-25T10:00:00+05:30", endAt: "2026-10-25T11:00:00+05:30" },
    });
    assert.ok([200, 201].includes(event.status), JSON.stringify(event.body));
    const eventId = event.body.id ?? event.body.event?.id;
    assert.equal((await call(server, "DELETE", `/api/calendar/${eventId}`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "PATCH", `/api/calendar/${eventId}`, { token: bob.accessToken, body: { title: "pwned" } })).status, 404);
    assert.equal(await prisma.calendarEvent.count({ where: { id: eventId } }), 1);

    const report = await prisma.report.create({
      data: { userId: alice.userId, title: "Daily", period: "daily", startDate: new Date(), endDate: new Date(), summaryJson: {} },
    });
    assert.equal((await call(server, "GET", `/api/reports/${report.id}`, { token: bob.accessToken })).status, 404);
    assert.equal((await call(server, "GET", `/api/reports/${report.id}`, { token: alice.accessToken })).status, 200);
  });

  test("a tracker upsert cannot overwrite another user's activity id", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    const id = "5d7a3c1e-0000-4000-8000-000000000001";
    const payload = (minutes: number) => ({
      id,
      app: "code",
      title: "editor",
      startTime: "2026-10-24T04:00:00.000Z",
      endTime: new Date(Date.parse("2026-10-24T04:00:00.000Z") + minutes * 60_000).toISOString(),
      duration: minutes * 60_000,
      type: "active",
    });
    assert.equal((await call(server, "POST", "/activity/session", { token: alice.accessToken, body: payload(5) })).status, 200);
    assert.equal((await call(server, "POST", "/activity/session", { token: bob.accessToken, body: payload(500) })).status, 409);
    const stored = await prisma.activity.findUniqueOrThrow({ where: { id } });
    assert.equal(stored.duration, 5 * 60_000);
  });

  test("admin-only endpoints refuse ordinary users and never return credentials", async () => {
    const user = await registerUser(server);
    assert.equal((await call(server, "GET", "/api/system/database", { token: user.accessToken })).status, 403);
    assert.equal((await call(server, "POST", "/api/calendar/tracking/reconcile", { token: user.accessToken, body: {} })).status, 403);
    await prisma.user.update({ where: { id: user.userId }, data: { role: "admin" } });
    const login = await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: user.password } });
    const info = await call(server, "GET", "/api/system/database", { token: login.body.accessToken });
    assert.equal(info.status, 200);
    assert.equal(info.body.target, "local");
    assert.equal(info.body.database, "acpe_test");
    assert.ok(!JSON.stringify(info.body).includes("password"));
  });
});

describe("browser session (cookie)", () => {
  test("register stores a bcrypt hash and sets a locked-down refresh cookie, never a body token", async () => {
    const response = await call(server, "POST", "/api/auth/register", {
      origin: DASHBOARD_ORIGIN,
      body: { email: "  Mixed.Case@Example.TEST ", password: "a sturdy passphrase", name: "Mixed" },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.user.email, "mixed.case@example.test");
    assert.equal(response.body.refreshToken, undefined);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const cookie = response.cookies.find((value) => value.startsWith("samaritan_refresh="))!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\/api\/auth/i);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "mixed.case@example.test" } });
    assert.match(user.passwordHash!, /^\$2[aby]\$12\$/);
    const stored = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    const raw = refreshCookie(response.cookies)!.split("=")[1];
    assert.equal(stored.length, 1);
    assert.equal(stored[0].token, hashToken(raw), "only the hash is stored");
  });

  test("weak passwords, bad emails and duplicate accounts are refused", async () => {
    const weak = await call(server, "POST", "/api/auth/register", { origin: DASHBOARD_ORIGIN, body: { email: "a@b.test", password: "short", name: "A" } });
    assert.equal(weak.status, 400);
    const long = await call(server, "POST", "/api/auth/register", { origin: DASHBOARD_ORIGIN, body: { email: "a@b.test", password: "x".repeat(73), name: "A" } });
    assert.equal(long.status, 400);
    const badEmail = await call(server, "POST", "/api/auth/register", { origin: DASHBOARD_ORIGIN, body: { email: "nope", password: "long enough password", name: "A" } });
    assert.equal(badEmail.status, 400);
    await registerUser(server, { email: "dupe@example.test" });
    const dupe = await call(server, "POST", "/api/auth/register", { origin: DASHBOARD_ORIGIN, body: { email: "DUPE@example.test", password: "long enough password", name: "B" } });
    assert.equal(dupe.status, 409);
  });

  test("login: wrong password and unknown email look identical", async () => {
    const user = await registerUser(server);
    const wrong = await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: "not the password" } });
    const unknown = await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: "ghost@example.test", password: "not the password" } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    const ok = await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email.toUpperCase(), password: user.password } });
    assert.equal(ok.status, 200);
    const me = await call(server, "GET", "/api/auth/me", { token: ok.body.accessToken });
    assert.equal(me.body.user.id, user.userId);
    assert.ok(me.body.user.lastLoginAt);
  });

  test("refresh rotates the cookie; replaying a rotated cookie revokes the whole login", async () => {
    const user = await registerUser(server);
    const first = await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie });
    assert.equal(first.status, 200);
    const rotated = refreshCookie(first.cookies)!;
    assert.ok(rotated && rotated !== user.cookie);
    assert.equal((await call(server, "GET", "/api/goals", { token: first.body.accessToken })).status, 200);

    // A second tab racing with the same cookie inside the grace window gets an access token, no new cookie.
    const racing = await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie });
    assert.equal(racing.status, 200);
    assert.equal(refreshCookie(racing.cookies), null);

    // Outside the grace window the same replay is treated as theft.
    await prisma.refreshToken.updateMany({
      where: { userId: user.userId, revokedReason: "rotated" },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const replay = await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie });
    assert.equal(replay.status, 401);
    const afterTheft = await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: rotated });
    assert.equal(afterTheft.status, 401, "the legitimate successor dies with its family");
    const reasons = await prisma.refreshToken.findMany({ where: { userId: user.userId }, select: { revokedReason: true } });
    assert.ok(reasons.some((row) => row.revokedReason === "reuse"));
  });

  test("the refresh cookie only works from the dashboard origin", async () => {
    const user = await registerUser(server);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { cookie: user.cookie })).status, 403, "no Origin");
    assert.equal((await call(server, "POST", "/api/auth/refresh", { cookie: user.cookie, origin: "http://localhost:3000" })).status, 403);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { cookie: user.cookie, origin: "https://evil.example" })).status, 403);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN })).status, 204, "no cookie: no session, no error");
    assert.equal((await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: "samaritan_refresh=forged" })).status, 401);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { headers: { "X-Samaritan-Client": "desktop" }, body: {} })).status, 401);

    const preflight = (origin: string) =>
      fetch(`${server.baseUrl}/api/auth/refresh`, {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
      });
    const fromDashboard = await preflight(DASHBOARD_ORIGIN);
    assert.equal(fromDashboard.headers.get("access-control-allow-credentials"), "true");
    const fromOtherLocalApp = await preflight("http://localhost:3000");
    assert.equal(fromOtherLocalApp.headers.get("access-control-allow-credentials"), null);
  });

  test("logout ends the login; the cookie is cleared", async () => {
    const user = await registerUser(server);
    const logout = await call(server, "POST", "/api/auth/logout", { origin: DASHBOARD_ORIGIN, cookie: user.cookie });
    assert.equal(logout.status, 200);
    assert.ok(logout.cookies.some((value) => /^samaritan_refresh=;/.test(value)));
    assert.equal((await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie })).status, 401);
  });

  test("password change signs out every other session and invalidates old access tokens", async () => {
    const user = await registerUser(server);
    const otherDevice = await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: user.password } });
    const wrongCurrent = await call(server, "POST", "/api/auth/password", {
      token: user.accessToken,
      origin: DASHBOARD_ORIGIN,
      body: { currentPassword: "nope nope nope", newPassword: "a brand new passphrase" },
    });
    assert.equal(wrongCurrent.status, 401);
    const changed = await call(server, "POST", "/api/auth/password", {
      token: user.accessToken,
      origin: DASHBOARD_ORIGIN,
      body: { currentPassword: user.password, newPassword: "a brand new passphrase" },
    });
    assert.equal(changed.status, 200);
    assert.equal((await call(server, "GET", "/api/goals", { token: user.accessToken })).status, 401, "old access token");
    assert.equal((await call(server, "GET", "/api/goals", { token: otherDevice.body.accessToken })).status, 401);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: refreshCookie(otherDevice.cookies)! })).status, 401);
    assert.equal((await call(server, "GET", "/api/goals", { token: changed.body.accessToken })).status, 200, "the caller stays signed in");
    assert.equal((await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: user.password } })).status, 401);
    assert.equal((await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: "a brand new passphrase" } })).status, 200);
  });

  test("log out everywhere kills access tokens and refresh cookies at once; sessions are listed and revocable", async () => {
    const user = await registerUser(server);
    const second = await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: user.password } });
    const sessions = await call(server, "GET", "/api/auth/sessions", { token: user.accessToken, cookie: user.cookie });
    assert.equal(sessions.body.sessions.length, 2);
    assert.equal(sessions.body.sessions.filter((row: any) => row.current).length, 1);
    const other = sessions.body.sessions.find((row: any) => !row.current);
    assert.equal((await call(server, "DELETE", `/api/auth/sessions/${other.id}`, { token: user.accessToken })).status, 200);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: refreshCookie(second.cookies)! })).status, 401);

    assert.equal((await call(server, "POST", "/api/auth/logout-all", { token: user.accessToken })).status, 200);
    assert.equal((await call(server, "GET", "/api/goals", { token: user.accessToken })).status, 401);
    assert.equal((await call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie })).status, 401);
  });

  test("repeated failed logins are throttled", async () => {
    const user = await registerUser(server);
    let last = 0;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      last = (await call(server, "POST", "/api/auth/login", { origin: DASHBOARD_ORIGIN, body: { email: user.email, password: "wrong password!" } })).status;
    }
    assert.equal(last, 429);
  });
});

describe("desktop session (body token)", () => {
  const desktop = { "X-Samaritan-Client": "desktop" };

  test("desktop login returns the refresh token in the body, sets no cookie, and rotates on refresh", async () => {
    const user = await registerUser(server);
    const login = await call(server, "POST", "/api/auth/login", { headers: desktop, body: { email: user.email, password: user.password, deviceId: "laptop-1" } });
    assert.equal(login.status, 200);
    assert.equal(refreshCookie(login.cookies), null);
    assert.ok(login.body.refreshToken);
    const refreshed = await call(server, "POST", "/api/auth/refresh", { headers: desktop, body: { refreshToken: login.body.refreshToken } });
    assert.equal(refreshed.status, 200);
    assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);
    const stored = await prisma.refreshToken.findFirstOrThrow({ where: { token: hashToken(refreshed.body.refreshToken) } });
    assert.equal(stored.client, "desktop");
    assert.equal(stored.deviceId, "laptop-1");
    assert.ok(stored.expiresAt.getTime() - Date.now() > 80 * 24 * 60 * 60 * 1000, "device credentials live ~90 days");
  });

  test("a browser cannot pose as the desktop client", async () => {
    const user = await registerUser(server);
    const posing = await call(server, "POST", "/api/auth/login", {
      headers: desktop,
      origin: DASHBOARD_ORIGIN,
      body: { email: user.email, password: user.password },
    });
    assert.equal(posing.status, 403);
  });

  test("the dashboard can mint a device credential for the signed-in user", async () => {
    const user = await registerUser(server);
    const linked = await call(server, "POST", "/api/auth/device", { token: user.accessToken, body: { deviceId: "desk" } });
    assert.equal(linked.status, 201);
    assert.ok(linked.body.refreshToken);
    assert.equal(linked.body.user.id, user.userId);
  });

  test("local enrollment needs the key file and a native loopback client", async () => {
    const user = await registerUser(server);
    await prisma.user.update({ where: { id: user.userId }, data: { role: "admin" } });
    const file = await ensureEnrollmentKey();
    assert.ok(file);
    const mode = (await fs.stat(file!)).mode & 0o777;
    assert.equal(mode, 0o600);
    const key = (await fs.readFile(file!, "utf8")).trim();
    assert.equal((await call(server, "POST", "/api/auth/device/local", { body: { enrollmentKey: "wrong" } })).status, 401);
    assert.equal((await call(server, "POST", "/api/auth/device/local", { origin: DASHBOARD_ORIGIN, body: { enrollmentKey: key } })).status, 403);
    const enrolled = await call(server, "POST", "/api/auth/device/local", { body: { enrollmentKey: key, deviceId: "this-pc" } });
    assert.equal(enrolled.status, 201);
    assert.equal(enrolled.body.user.id, user.userId);
    assert.ok(enrolled.body.refreshToken);
  });
});

describe("WebSocket", () => {
  function open(url: string, options: WebSocket.ClientOptions & { protocols?: string[] } = {}) {
    return new Promise<{ ws: WebSocket; status?: number; closeCode?: number; messages: any[] }>((resolve) => {
      const { protocols, ...rest } = options;
      const ws = new WebSocket(url, protocols, { origin: DASHBOARD_ORIGIN, ...rest });
      const messages: any[] = [];
      ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
      ws.on("unexpected-response", (_req, res) => resolve({ ws, status: res.statusCode, messages }));
      ws.on("open", () => setTimeout(() => resolve({ ws, messages }), 150));
      ws.on("close", (code) => resolve({ ws, closeCode: code, messages }));
      ws.on("error", () => undefined);
    });
  }

  test("handshake without a valid token is refused with 401", async () => {
    assert.equal((await open(server.wsUrl)).status, 401);
    assert.equal((await open(server.wsUrl, { protocols: ["samaritan", "bearer.not-a-token"] })).status, 401);
  });

  test("browser subprotocol and native Authorization header both authenticate", async () => {
    const user = await registerUser(server);
    const browser = await open(`${server.wsUrl}?clientType=dashboard`, { protocols: ["samaritan", `bearer.${user.accessToken}`] });
    assert.equal(browser.ws.readyState, WebSocket.OPEN);
    assert.equal(browser.ws.protocol, "samaritan");
    assert.equal(browser.messages[0]?.payload?.userId, user.userId);
    browser.ws.close();
    const native = await open(`${server.wsUrl}?clientType=desktop`, { headers: { Authorization: `Bearer ${user.accessToken}` }, origin: undefined });
    assert.equal(native.ws.readyState, WebSocket.OPEN);
    native.ws.close();
  });

  test("a socket cannot claim another userId, and streamed activity lands on the socket's user", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    const mismatch = await open(`${server.wsUrl}?userId=${bob.userId}`, { headers: { Authorization: `Bearer ${alice.accessToken}` } });
    assert.equal(mismatch.closeCode, 4003);

    const socket = await open(`${server.wsUrl}?clientType=desktop`, { headers: { Authorization: `Bearer ${alice.accessToken}` } });
    socket.ws.send(
      JSON.stringify({
        type: "activity:stream",
        payload: {
          userId: bob.userId,
          app: "code",
          title: "spoof",
          startTime: "2026-10-24T05:00:00.000Z",
          endTime: "2026-10-24T05:01:00.000Z",
          duration: 60_000,
          type: "active",
        },
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    socket.ws.close();
    const spoofed = await prisma.activity.findMany({ where: { windowTitle: "spoof" }, include: { session: true } });
    assert.equal(spoofed.length, 1);
    assert.equal(spoofed[0].session.userId, alice.userId);
  });

  test("log out everywhere closes open sockets", async () => {
    const user = await registerUser(server);
    const socket = await open(server.wsUrl, { headers: { Authorization: `Bearer ${user.accessToken}` } });
    const closed = new Promise<number>((resolve) => socket.ws.on("close", (code) => resolve(code)));
    await call(server, "POST", "/api/auth/logout-all", { token: user.accessToken });
    assert.equal(await closed, 4001);
  });
});

describe("goal form flow", () => {
  test("a goal saved the way the dashboard sends it is stored and shows up in the dashboard", async () => {
    const user = await registerUser(server);
    const created = await call(server, "POST", "/api/goals", {
      token: user.accessToken,
      body: {
        userId: user.userId,
        title: "Ship auth",
        description: "",
        type: "hours",
        target: 1.5,
        period: "daily",
        priority: "medium",
        startDate: "2026-10-25",
        endDate: "2026-10-31",
      },
    });
    assert.ok([200, 201].includes(created.status), JSON.stringify(created.body));
    const dashboard = await call(server, "GET", "/api/goals/dashboard", { token: user.accessToken });
    assert.equal(dashboard.status, 200);
    const goal = dashboard.body.goals.find((row: any) => row.id === created.body.id);
    assert.ok(goal, "goal is listed");
    assert.equal(goal.target, 1.5);
    assert.equal(goal.startDate.slice(0, 10), "2026-10-25");
    const edited = await call(server, "PATCH", `/api/goals/${created.body.id}`, { token: user.accessToken, body: { target: 2.25, title: "Ship auth v2" } });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.target, 2.25);
  });
});
