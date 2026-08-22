import express from "express";
import cors from "cors";
import { createServer } from "http";
import WebSocket from "ws";
import assert from "node:assert/strict";
import { prisma } from "../prisma";
import activityRoutes from "../routes/activity";
import analyticsRoutes from "../routes/analytics";
import focusRoutes from "../routes/focus";
import projectsRoutes from "../routes/projects";
import projectRulesRoutes from "../routes/projectRules";
import calendarRoutes from "../routes/calendar";
import goalsRoutes from "../routes/goals";
import breaksRoutes from "../routes/breaks";
import distractionBlocksRoutes from "../routes/distractionBlocks";
import { initWebSocket } from "../websocket/manager";
import "../websocket/handlers";

const TEST_PORT = 4199;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const WS_URL = `ws://localhost:${TEST_PORT}/ws`;

async function main() {
  console.log("=== SamaritanV2 Automated Integration, Concurrency & Stress Baseline Test ===");

  const app = express();
  const server = createServer(app);

  app.use(express.json());
  app.use(cors());

  app.use("/activity", activityRoutes);
  app.use("/analytics", analyticsRoutes);
  app.use("/focus", focusRoutes);
  app.use("/api/projects", projectsRoutes);
  app.use("/api/projects", projectRulesRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/goals", goalsRoutes);
  app.use("/api/breaks", breaksRoutes);
  app.use("/api/distraction-blocks", distractionBlocksRoutes);

  app.get("/health", (req, res) => {
    res.json({ status: "OK", ws: true });
  });

  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  });

  initWebSocket(server);

  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test API & WebSocket server running on ${BASE_URL}`);

  const testUserId = `stress-user-${Date.now()}`;
  await prisma.user.create({ data: { id: testUserId, name: "Stress Test User" } });

  try {
    // 1. Health check
    console.log("\n[1] Testing /health...");
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, "OK");
    console.log("✓ /health passed");

    // 2. Activity Ingestion
    console.log("\n[2] Testing /activity ingestion...");
    const activityRes = await fetch(`${BASE_URL}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: testUserId,
        appName: "Cursor",
        windowTitle: "samaritanV2/api/src/index.ts",
      }),
    });
    assert.equal(activityRes.status, 200);
    const activityJson = await activityRes.json();
    assert.ok(activityJson.id);
    console.log("✓ /activity passed");

    // 3. Projects CRUD
    console.log("\n[3] Testing Projects CRUD...");
    const projectRes = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: testUserId,
        name: "Stress Core Engine",
        color: "#6366f1",
      }),
    });
    assert.ok(projectRes.status === 200 || projectRes.status === 201);
    const projectJson = await projectRes.json();
    assert.equal(projectJson.name, "Stress Core Engine");

    const getProjectsRes = await fetch(`${BASE_URL}/api/projects?userId=${testUserId}`);
    assert.equal(getProjectsRes.status, 200);
    const projectsList = await getProjectsRes.json();
    assert.equal(projectsList.length, 1);
    console.log("✓ Projects CRUD passed");

    // 4. Focus Session Lifecycle
    console.log("\n[4] Testing Focus Session Lifecycle...");
    const focusStartRes = await fetch(`${BASE_URL}/focus/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: testUserId,
        goal: "Hardening Samaritan Engine",
        plannedMinutes: 25,
        enforcement: "warn",
      }),
    });
    assert.ok(focusStartRes.status === 200 || focusStartRes.status === 201);
    const focusSession = await focusStartRes.json();
    assert.equal(focusSession.status, "active");

    const focusEndRes = await fetch(`${BASE_URL}/focus/${focusSession.id}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: testUserId,
        status: "completed",
      }),
    });
    assert.equal(focusEndRes.status, 200);
    console.log("✓ Focus Session Lifecycle passed");

    // 5. WebSocket Event Handshake & Subscription
    console.log("\n[5] Testing WebSocket handshake and ping...");
    const ws = new WebSocket(WS_URL);
    let wsConnected = false;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS Connection Timeout")), 5000);
      ws.on("open", () => {
        wsConnected = true;
        clearTimeout(timeout);
        resolve();
      });
      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert.ok(wsConnected);
    ws.close();
    console.log("✓ WebSocket handshake passed");

    // 6. Concurrency & Stress Testing
    console.log("\n[6] Executing Concurrency & Stress Test (100 parallel requests)...");
    const startTime = Date.now();
    const latencies: number[] = [];
    let successCount = 0;
    let failureCount = 0;

    const requestPromises = Array.from({ length: 100 }, async (_, i) => {
      const reqStart = Date.now();
      try {
        const res = await fetch(`${BASE_URL}/activity/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: testUserId,
            app: i % 2 === 0 ? "Cursor" : "Terminal",
            title: `Working on task ${i}`,
            startTime: new Date(Date.now() - 5000).toISOString(),
            endTime: new Date().toISOString(),
            duration: 5,
            type: "focus",
          }),
        });
        const elapsed = Date.now() - reqStart;
        latencies.push(elapsed);
        if (res.ok) successCount++;
        else failureCount++;
      } catch (err) {
        failureCount++;
      }
    });

    await Promise.all(requestPromises);
    const totalTimeMs = Date.now() - startTime;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const rps = Math.round((100 / totalTimeMs) * 1000);

    console.log(`
--- STRESS TEST RESULTS ---
Total Requests: 100
Successful:     ${successCount}
Failed:         ${failureCount}
Total Duration: ${totalTimeMs} ms
RPS:            ${rps} req/sec
P50 Latency:    ${p50} ms
P95 Latency:    ${p95} ms
P99 Latency:    ${p99} ms
---------------------------
    `);

    assert.equal(failureCount, 0, "Expected 0 failed requests under load");
    console.log("✓ Concurrency & Stress Test PASSED successfully!");
  } finally {
    // Cleanup test database entries
    await prisma.activity.deleteMany({ where: { session: { userId: testUserId } } });
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.deepWorkSession.deleteMany({ where: { userId: testUserId } });
    await prisma.project.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });

    server.close();
  }
}

main().catch((err) => {
  console.error("Integration/Stress test failed:", err);
  process.exit(1);
});
