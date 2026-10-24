// Regressions for the red-team audit of the auth layer: each test reproduces
// a reported attack and asserts it now fails.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import { call, DASHBOARD_ORIGIN, prisma, refreshCookie, registerUser, resetDatabase, startServer, type TestServer } from "./harness";
import { resetAuthRateLimits } from "../../routes/auth";
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
  await prisma.appPattern.deleteMany({ where: { userId: null, appName: "attackapp" } });
  resetAuthRateLimits();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function track(server: TestServer, token: string, title: string, minute: number) {
  const start = new Date(Date.UTC(2026, 9, 24, 6, minute));
  const response = await call(server, "POST", "/activity/session", {
    token,
    body: { app: "attackapp", title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 60_000).toISOString(), duration: 60_000, type: "active" },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return prisma.activity.findUniqueOrThrow({ where: { id: response.body.activity.id } });
}

describe("classifier isolation (finding 1)", () => {
  test("a review teaches only the reviewer's classifier", async () => {
    const alice = await registerUser(server);
    const bob = await registerUser(server);
    const bobActivity = await track(server, bob.accessToken, "SecretClientProject - main.ts", 0);
    const review = await call(server, "POST", "/activity/reviews", {
      token: bob.accessToken,
      body: { reviews: [{ activityIds: [bobActivity.id], category: "entertainment", intent: "poisoned_by_bob", focusImpact: 0, remember: true }] },
    });
    assert.equal(review.status, 200, JSON.stringify(review.body));
    const learned = await prisma.appPattern.findMany({ where: { appName: "attackapp" } });
    assert.equal(learned.length, 1);
    assert.equal(learned[0].userId, bob.userId, "the learned pattern belongs to the reviewer");

    const aliceActivity = await track(server, alice.accessToken, "SecretClientProject - main.ts", 5);
    assert.notEqual(aliceActivity.intent, "poisoned_by_bob");
    const bobAgain = await track(server, bob.accessToken, "SecretClientProject - main.ts", 10);
    assert.equal(bobAgain.intent, "poisoned_by_bob", "the reviewer's own classifier did learn");
  });
});

describe("foreign focus-session ids (findings 2 and 9)", () => {
  async function aliceSession() {
    const alice = await registerUser(server);
    const session = await prisma.deepWorkSession.create({
      data: { userId: alice.userId, plannedMinutes: 25, startedAt: new Date(), status: "active", enforcement: "warn" },
    });
    return { alice, deepWorkId: session.id };
  }

  test("blocker events cannot be filed against another user's focus session", async () => {
    const { alice, deepWorkId } = await aliceSession();
    const bob = await registerUser(server);
    const inject = await call(server, "POST", "/api/distraction-blocks/events", {
      token: bob.accessToken,
      body: { deepWorkId, targetType: "app", target: "evil", appName: "ATTACKER_INJECTED_APP", outcome: "matched" },
    });
    assert.equal(inject.status, 404, JSON.stringify(inject.body));
    // Even a row planted directly in the database never reaches Alice's result.
    await prisma.distractionBlockEvent.create({
      data: { userId: bob.userId, deepWorkId, targetType: "app", target: "evil", appName: "PLANTED", outcome: "matched", occurredAt: new Date() },
    });
    const result = await call(server, "GET", `/focus/${deepWorkId}/result`, { token: alice.accessToken });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(!JSON.stringify(result.body).includes("PLANTED"));
    assert.ok(!JSON.stringify(result.body).includes("ATTACKER_INJECTED_APP"));
  });

  test("ratings validate the value and the session owner", async () => {
    const { alice, deepWorkId } = await aliceSession();
    const bob = await registerUser(server);
    assert.equal((await call(server, "POST", "/api/ratings", { token: bob.accessToken, body: { rating: 4, deepWorkId } })).status, 404);
    assert.equal((await call(server, "POST", "/api/ratings", { token: alice.accessToken, body: { rating: 9 } })).status, 400);
    assert.equal((await call(server, "POST", "/api/ratings", { token: alice.accessToken, body: { rating: "5" } })).status, 400);
    assert.equal((await call(server, "POST", "/api/ratings", { token: alice.accessToken, body: { rating: 5, deepWorkId } })).status, 200);
  });
});

describe("ending one session ends its access token and sockets (findings 4 and 5)", () => {
  const desktop = { "X-Samaritan-Client": "desktop" };

  test("revoking a session from Settings kills that session's access token at once", async () => {
    const user = await registerUser(server);
    const device = await call(server, "POST", "/api/auth/login", { headers: desktop, body: { email: user.email, password: user.password } });
    assert.equal((await call(server, "GET", "/api/auth/me", { token: device.body.accessToken })).status, 200);
    const sessions = await call(server, "GET", "/api/auth/sessions", { token: user.accessToken, cookie: user.cookie });
    const target = sessions.body.sessions.find((row: any) => row.client === "desktop");
    assert.equal((await call(server, "DELETE", `/api/auth/sessions/${target.id}`, { token: user.accessToken })).status, 200);
    assert.equal((await call(server, "GET", "/api/auth/me", { token: device.body.accessToken })).status, 401);
    assert.equal((await call(server, "GET", "/api/auth/me", { token: user.accessToken })).status, 200, "other sessions are unaffected");
  });

  test("logout kills the access token issued for that login", async () => {
    const user = await registerUser(server);
    assert.equal((await call(server, "POST", "/api/auth/logout", { origin: DASHBOARD_ORIGIN, cookie: user.cookie })).status, 200);
    assert.equal((await call(server, "GET", "/api/goals", { token: user.accessToken })).status, 401);
  });

  test("tokens minted before login families existed (no fid claim) are refused", async () => {
    const user = await registerUser(server);
    const legacy = jwt.sign({ typ: "access", tv: 0, role: "user" }, authConfig.accessSecret, {
      algorithm: "HS256", issuer: authConfig.issuer, audience: authConfig.audience, subject: user.userId, expiresIn: 300,
    });
    assert.equal((await call(server, "GET", "/api/goals", { token: legacy })).status, 401);
  });

  function connect(token: string) {
    return new Promise<{ ws: WebSocket; messages: any[]; closed: Promise<number> }>((resolve, reject) => {
      const ws = new WebSocket(server.wsUrl, { headers: { Authorization: `Bearer ${token}` } });
      const messages: any[] = [];
      const closed = new Promise<number>((done) => ws.on("close", (code) => done(code)));
      ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
      ws.on("open", () => resolve({ ws, messages, closed }));
      ws.on("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    });
  }

  test("revoking a session closes its sockets", async () => {
    const user = await registerUser(server);
    const device = await call(server, "POST", "/api/auth/login", { headers: desktop, body: { email: user.email, password: user.password } });
    const socket = await connect(device.body.accessToken);
    const sessions = await call(server, "GET", "/api/auth/sessions", { token: user.accessToken, cookie: user.cookie });
    const target = sessions.body.sessions.find((row: any) => row.client === "desktop");
    await call(server, "DELETE", `/api/auth/sessions/${target.id}`, { token: user.accessToken });
    assert.equal(await socket.closed, 4001);
  });

  test("a socket closes when its token lapses unrenewed, and stays open when renewed", async () => {
    const user = await registerUser(server);
    const familyId = (await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.userId } })).familyId;
    const shortLived = (seconds: number) =>
      jwt.sign({ typ: "access", tv: 0, role: "user", fid: familyId }, authConfig.accessSecret, {
        algorithm: "HS256", issuer: authConfig.issuer, audience: authConfig.audience, subject: user.userId, expiresIn: seconds,
      });

    const lapsing = await connect(shortLived(2));
    assert.equal(await lapsing.closed, 4002);

    const renewing = await connect(shortLived(2));
    renewing.ws.send(JSON.stringify({ type: "auth:renew", payload: { token: user.accessToken } }));
    await sleep(3000);
    assert.equal(renewing.ws.readyState, WebSocket.OPEN);
    assert.ok(renewing.messages.some((message) => message.type === "auth:renewed"));

    const other = await registerUser(server);
    renewing.ws.send(JSON.stringify({ type: "auth:renew", payload: { token: other.accessToken } }));
    await sleep(400);
    assert.ok(renewing.messages.some((message) => message.type === "auth:renew.failed"), "another user's token cannot take over a socket");
    renewing.ws.close();
  });
});

describe("rotation races (finding 8)", () => {
  test("concurrent refreshes of one cookie all succeed and keep the login alive", async () => {
    const user = await registerUser(server);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie }))
    );
    assert.deepEqual(results.map((result) => result.status), [200, 200, 200, 200, 200, 200]);
    assert.equal(results.filter((result) => refreshCookie(result.cookies)).length, 1, "exactly one rotation happened");
    assert.equal(results.filter((result) => result.cookies.some((value) => /^samaritan_refresh=;/.test(value))).length, 0, "no tab was signed out");
    const live = await prisma.refreshToken.count({ where: { userId: user.userId, revokedAt: null } });
    assert.equal(live, 1);
  });

  test("a logout racing a refresh never leaves a live token behind", async () => {
    for (let round = 0; round < 5; round += 1) {
      await resetDatabase();
      resetAuthRateLimits();
      const user = await registerUser(server);
      await Promise.all([
        call(server, "POST", "/api/auth/refresh", { origin: DASHBOARD_ORIGIN, cookie: user.cookie }),
        call(server, "POST", "/api/auth/logout", { origin: DASHBOARD_ORIGIN, cookie: user.cookie }),
      ]);
      const live = await prisma.refreshToken.count({ where: { userId: user.userId, revokedAt: null } });
      assert.equal(live, 0, `round ${round}`);
    }
  });
});

describe("error detail (finding 10)", () => {
  test("database errors reach the client as a generic message", async () => {
    const user = await registerUser(server);
    const project = await call(server, "POST", "/api/projects", { token: user.accessToken, body: { name: "P" } });
    const projectId = project.body.id ?? project.body.project?.id;
    const broken = await call(server, "PATCH", `/api/projects/${projectId}`, { token: user.accessToken, body: { weeklyHourGoal: "lots" } });
    assert.ok(broken.status >= 400);
    assert.ok(!/prisma|invocation|Argument|Expected/i.test(JSON.stringify(broken.body)), JSON.stringify(broken.body));
  });
});
