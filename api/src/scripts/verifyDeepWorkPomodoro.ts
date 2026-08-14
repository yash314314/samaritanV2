import assert from "node:assert/strict";

import { prisma } from "../prisma";
import {
  advanceDeepWorkTimer,
  evaluateDeepWorkActivity,
  getDeepWorkSessionResult,
  getDeepWorkTimerState,
  pauseDeepWorkSession,
  resumeDeepWorkSession,
  skipDeepWorkBreak,
  startDeepWorkSession,
} from "../services/deepWorkService";

const enforcementActions: Record<string, string> = {
  observe: "observed",
  warn: "warned",
  require_reason: "reason_required",
  block: "blocked",
};

async function expireCurrentPhase(id: string, durationMinutes = 5) {
  const endedAt = new Date(Date.now() - 1_000);
  const startedAt = new Date(endedAt.getTime() - durationMinutes * 60_000);
  await prisma.$transaction([
    prisma.deepWorkSession.update({
      where: { id },
      data: { phaseStartedAt: startedAt, phaseEndsAt: endedAt },
    }),
    prisma.deepWorkPhase.updateMany({
      where: { deepWorkId: id, status: "active" },
      data: { startedAt },
    }),
  ]);
  return advanceDeepWorkTimer(id, new Date());
}

async function verifyPomodoro(userId: string) {
  const session = await startDeepWorkSession({
    userId,
    goal: "Verify Pomodoro lifecycle",
    plannedMinutes: 25,
    timerMode: "pomodoro",
    focusMinutes: 5,
    shortBreakMinutes: 1,
    longBreakMinutes: 2,
    totalRounds: 2,
    enforcement: "block",
    blockedApps: ["discord"],
    ambientSound: "brown",
    ambientVolume: 0.25,
  });

  assert.equal(session.plannedMinutes, 10);
  assert.equal(session.currentPhase, "focus");
  assert.equal(session.ambientSound, "brown");
  await assert.rejects(
    () => startDeepWorkSession({ userId, plannedMinutes: 5 }),
    /already active/,
  );

  const paused = await pauseDeepWorkSession(userId, session.id);
  assert.ok(paused.pausedAt);
  assert.equal(paused.phaseEndsAt, null);
  assert.equal(getDeepWorkTimerState(paused).enforcementActive, false);

  const resumed = await resumeDeepWorkSession(userId, session.id);
  assert.equal(resumed.pausedAt, null);
  assert.ok(resumed.phaseEndsAt);

  const firstBreak = await expireCurrentPhase(session.id);
  assert.equal(firstBreak?.currentPhase, "short_break");
  assert.equal(firstBreak?.currentRound, 1);
  assert.equal(firstBreak && getDeepWorkTimerState(firstBreak).enforcementActive, false);

  await pauseDeepWorkSession(userId, session.id);
  await assert.rejects(() => skipDeepWorkBreak(userId, session.id), /Resume the timer/);
  await resumeDeepWorkSession(userId, session.id);
  const secondFocus = await skipDeepWorkBreak(userId, session.id);
  assert.equal(secondFocus?.currentPhase, "focus");
  assert.equal(secondFocus?.currentRound, 2);

  const completed = await expireCurrentPhase(session.id);
  assert.equal(completed?.status, "completed");

  await prisma.distractionBlockEvent.create({
    data: {
      userId,
      deepWorkId: session.id,
      targetType: "app",
      target: "discord",
      appName: "Discord",
      outcome: "killed",
      reason: "Verification event",
    },
  });

  const result = await getDeepWorkSessionResult(session.id, userId);
  assert.ok(result);
  assert.equal(result?.session.timerMode, "pomodoro");
  assert.equal(result?.session.completedRounds, 2);
  assert.equal(result?.phases.length, 3);
  assert.equal(result?.phases.find((phase) => phase.type !== "focus")?.status, "skipped");
  assert.equal(result?.metrics.focusedMinutes, 10);
  assert.equal(result?.metrics.blockedCount, 1);
}

async function verifyEnforcementLevels(userId: string) {
  for (const [enforcement, expectedAction] of Object.entries(enforcementActions)) {
    const session = await startDeepWorkSession({
      userId,
      goal: `Verify ${enforcement}`,
      plannedMinutes: 5,
      enforcement,
      blockedApps: ["discord"],
    });
    const startTime = new Date(session.startedAt.getTime() + 10);
    const endTime = new Date(startTime.getTime() + 10_000);
    const evaluated = await evaluateDeepWorkActivity(userId, {
      appName: "Discord.exe",
      windowTitle: "Discord",
      startTime,
      endTime,
      duration: 10_000,
      category: "entertainment",
      intent: "social_media",
      focusImpact: -0.8,
      confidence: 1,
    });
    assert.equal(evaluated?.intervention.action, expectedAction);
    assert.equal(evaluated?.enforcement, enforcement);
    await expireCurrentPhase(session.id);
  }
}

async function main() {
  const user = await prisma.user.create({ data: { name: "Deep Work verifier" } });
  try {
    await verifyPomodoro(user.id);
    await verifyEnforcementLevels(user.id);
  } finally {
    await prisma.distractionBlockEvent.deleteMany({ where: { userId: user.id } });
    await prisma.focusIntervention.deleteMany({ where: { deepWork: { userId: user.id } } });
    await prisma.deepWorkMinuteLog.deleteMany({ where: { deepWork: { userId: user.id } } });
    await prisma.deepWorkSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("Deep Work verification passed: Pomodoro phases, pause/resume, break skipping, reports, and all enforcement levels.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
