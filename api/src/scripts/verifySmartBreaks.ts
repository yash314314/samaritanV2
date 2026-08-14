import assert from "node:assert/strict";

import { prisma } from "../prisma";
import {
  calculateContinuousWork,
  endSmartBreak,
  evaluateSmartBreak,
  getSmartBreakHistory,
  startSmartBreak,
  updateSmartBreakSettings,
} from "../services/smartBreakService";

const MINUTE_MS = 60_000;

function activity(startMinute: number, durationMinutes: number, type = "active") {
  const origin = new Date("2026-08-14T09:00:00.000Z");
  const startTime = new Date(origin.getTime() + startMinute * MINUTE_MS);
  return {
    appName: type === "idle" ? "System Idle" : "Code",
    category: type === "idle" ? "idle" : "productive",
    type,
    startTime,
    endTime: new Date(startTime.getTime() + durationMinutes * MINUTE_MS),
    duration: durationMinutes * MINUTE_MS,
  };
}

async function verifyPureCalculation() {
  const now = new Date("2026-08-14T09:35:00.000Z");
  const continuous = calculateContinuousWork([
    activity(0, 20),
    activity(18, 12),
    activity(30, 5),
  ], now, 5 * MINUTE_MS);
  assert.equal(continuous.workMs, 35 * MINUTE_MS, "overlapping activity must not be counted twice");

  const reset = calculateContinuousWork([
    activity(0, 10),
    activity(10, 5, "idle"),
    activity(15, 8),
  ], new Date("2026-08-14T09:23:00.000Z"), 5 * MINUTE_MS);
  assert.equal(reset.workMs, 8 * MINUTE_MS, "a qualifying idle interval must reset the streak");

  const stale = calculateContinuousWork(
    [activity(0, 10)],
    new Date("2026-08-14T09:20:00.000Z"),
    5 * MINUTE_MS
  );
  assert.equal(stale.workMs, 0, "stale activity must not remain an active streak");
}

async function verifyPersistedLifecycle() {
  const user = await prisma.user.create({ data: { name: "Smart break verifier" } });
  const now = new Date();
  let calendarSessionId: string | null = null;
  try {
    const session = await prisma.session.create({
      data: { userId: user.id, startTime: new Date(now.getTime() - 16 * MINUTE_MS) },
    });
    await prisma.activity.create({
      data: {
        sessionId: session.id,
        appName: "Code",
        windowTitle: "Smart break verification",
        startTime: new Date(now.getTime() - 16 * MINUTE_MS),
        endTime: now,
        duration: 16 * MINUTE_MS,
        type: "active",
        category: "productive",
      },
    });
    await updateSmartBreakSettings(user.id, {
      enabled: true,
      workHoursOnly: false,
      workThresholdMinutes: 15,
      breakDurationMinutes: 5,
      resetIdleMinutes: 5,
    });

    const suggestion = await evaluateSmartBreak(user.id, now);
    assert.equal(suggestion?.status, "suggested");
    assert.ok((suggestion?.continuousWorkMs ?? 0) >= 15 * MINUTE_MS);

    const started = await startSmartBreak(user.id, { breakId: suggestion!.id }, now);
    assert.equal(started.status, "active");
    assert.ok(started.calendarSessionId);
    calendarSessionId = started.calendarSessionId;

    const endedAt = new Date(now.getTime() + 2 * MINUTE_MS);
    const completed = await endSmartBreak(user.id, started.id, endedAt);
    assert.equal(completed.status, "completed");
    assert.equal(completed.openKey, null);

    const calendarSession = await prisma.calendarSession.findUnique({ where: { id: calendarSessionId! } });
    assert.equal(calendarSession?.status, "confirmed");
    assert.equal(calendarSession?.type, "break");
    assert.equal(calendarSession?.actualDurationMs, 2 * MINUTE_MS);

    const history = await getSmartBreakHistory(
      user.id,
      new Date(now.getTime() - MINUTE_MS),
      new Date(endedAt.getTime() + MINUTE_MS)
    );
    assert.equal(history.summary.completed, 1);
    assert.equal(history.summary.recoveryMs, 2 * MINUTE_MS);
  } finally {
    await prisma.meetingEvidence.deleteMany({ where: { calendarSession: { userId: user.id } } });
    await prisma.calendarSession.deleteMany({ where: { userId: user.id } });
    await prisma.smartBreak.deleteMany({ where: { userId: user.id } });
    await prisma.smartBreakSettings.deleteMany({ where: { userId: user.id } });
    await prisma.activity.deleteMany({ where: { session: { userId: user.id } } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function main() {
  await verifyPureCalculation();
  await verifyPersistedLifecycle();
  console.log("Smart break verification passed: streak calculation, lifecycle, calendar logging, and history.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
