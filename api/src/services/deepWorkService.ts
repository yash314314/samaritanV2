import { prisma } from "../prisma";
import {
  isIdleActivity,
  updateSmoothMetricState
} from "./metricEngine";
import {
  emitDeepWorkStarted,
  emitDeepWorkEnded,
  emitDeepWorkState,
  emitGoalProgress,
  emitInterventionCleared,
  emitInterventionResolved,
  emitInterventionTriggered,
} from "../websocket/broadcaster";
import { updateAndEmitGoalProgress } from "./goalProgressService";
import { dispatchWebhookEvent } from "./webhookService";

type StrictFocusInput = {
  userId: string;
  projectId?: string | null;
  goal?: string | null;
  plannedMinutes: number;
  enforcement?: string | null;
  allowedApps?: string[];
  allowedDomains?: string[];
  blockedApps?: string[];
  blockedDomains?: string[];
  timerMode?: "countdown" | "pomodoro";
  focusMinutes?: number;
  shortBreakMinutes?: number;
  longBreakMinutes?: number;
  totalRounds?: number;
  ambientSound?: string;
  ambientVolume?: number;
};

type ActivityInput = {
  appName: string;
  windowTitle: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  type?: string | null;
  category?: string | null;
  intent?: string | null;
  focusImpact?: number | null;
  confidence?: number | null;
  domain?: string | null;
  url?: string | null;
};

const WORK_CATEGORIES = new Set([
  "deep_work",
  "research",
  "productivity",
  "development_tools"
]);

const DISTRACTION_CATEGORIES = new Set([
  "entertainment",
  "media"
]);

const DISTRACTION_INTENTS = new Set([
  "gaming",
  "social_media",
  "streaming_video",
  "video_streaming",
  "video"
]);

const ENFORCEMENT_LEVELS = new Set([
  "observe",
  "warn",
  "require_reason",
  "block"
]);

const AMBIENT_SOUNDS = new Set(["none", "white", "pink", "brown", "rain"]);

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function boundedVolume(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.35;
}

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function normalizeList(values?: string[] | null) {
  return (values ?? [])
    .map(normalize)
    .filter(Boolean);
}

function includesRule(rules: string[], value?: string | null) {
  const normalized = normalize(value);
  if (!normalized) return false;
  return rules.some(rule => normalized.includes(rule));
}

function getActivityOverlapMs(
  session: {
    startedAt: Date;
    plannedMinutes: number;
    currentPhase?: string;
    phaseStartedAt?: Date;
    phaseEndsAt?: Date | null;
    pausedAt?: Date | null;
  },
  activity?: Pick<ActivityInput, "startTime" | "endTime"> | null
) {
  if (!activity || session.pausedAt || (session.currentPhase && session.currentPhase !== "focus")) return 0;

  const windowStart = (session.phaseStartedAt ?? session.startedAt).getTime();
  const windowEnd = (session.phaseEndsAt ?? new Date(session.startedAt.getTime() + session.plannedMinutes * 60 * 1000)).getTime();
  const activityStart = activity.startTime.getTime();
  const activityEnd = activity.endTime.getTime();

  return Math.max(0, Math.min(activityEnd, windowEnd) - Math.max(activityStart, windowStart));
}

function interventionAction(enforcement: string) {
  if (enforcement === "block") return "blocked";
  if (enforcement === "warn") return "warned";
  if (enforcement === "observe") return "observed";
  return "reason_required";
}

export function getDeepWorkTimerState(session: {
  startedAt: Date;
  plannedMinutes: number;
  timerMode: string;
  currentPhase: string;
  currentRound: number;
  totalRounds: number;
  phaseStartedAt: Date;
  phaseEndsAt: Date | null;
  pausedAt: Date | null;
  pausedRemainingSeconds: number | null;
}, now = new Date()) {
  const phaseRemainingSeconds = session.pausedAt
    ? Math.max(0, session.pausedRemainingSeconds ?? 0)
    : Math.max(0, Math.ceil(((session.phaseEndsAt?.getTime() ?? now.getTime()) - now.getTime()) / 1000));
  const phaseElapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - session.phaseStartedAt.getTime()) / 1000) -
      (session.pausedAt ? Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000) : 0)
  );
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000));
  return {
    timerMode: session.timerMode,
    currentPhase: session.currentPhase,
    currentRound: session.currentRound,
    totalRounds: session.totalRounds,
    paused: Boolean(session.pausedAt),
    phaseStartedAt: session.phaseStartedAt,
    phaseEndsAt: session.phaseEndsAt,
    phaseElapsedSeconds,
    phaseRemainingSeconds,
    elapsedSeconds,
    elapsedMinutes: Math.floor(elapsedSeconds / 60),
    remainingMinutes: Math.ceil(phaseRemainingSeconds / 60),
    enforcementActive: session.currentPhase === "focus" && !session.pausedAt,
  };
}

function normalizeEnforcement(enforcement?: string | null) {
  return ENFORCEMENT_LEVELS.has(enforcement ?? "") ? enforcement! : "warn";
}

export function evaluateProtocol(session: any, activity: ActivityInput) {
  if (isIdleActivity(activity)) {
    return {
      allowed: true,
      severity: "idle",
      reason: "Idle time is tracked but not treated as a protocol violation."
    };
  }

  const allowedApps = normalizeList(session.allowedApps);
  const allowedDomains = normalizeList(session.allowedDomains);
  const blockedApps = normalizeList(session.blockedApps);
  const blockedDomains = normalizeList(session.blockedDomains);

  const appBlocked = includesRule(blockedApps, activity.appName);
  const domainBlocked = includesRule(blockedDomains, activity.domain ?? activity.url);

  if (appBlocked || domainBlocked) {
    return {
      allowed: false,
      severity: "critical",
      reason: "Blocked app or domain entered during strict focus."
    };
  }

  const hasAllowList = allowedApps.length > 0 || allowedDomains.length > 0;

  if (hasAllowList) {
    const appAllowed = includesRule(allowedApps, activity.appName);
    const domainAllowed = includesRule(allowedDomains, activity.domain ?? activity.url);

    if (!appAllowed && !domainAllowed) {
      return {
        allowed: false,
        severity: "warning",
        reason: "Activity is outside the allowed focus protocol."
      };
    }
  }

  const category = activity.category ?? "unknown";
  const intent = activity.intent ?? "unknown";

  if (DISTRACTION_CATEGORIES.has(category) || DISTRACTION_INTENTS.has(intent)) {
    return {
      allowed: false,
      severity: "warning",
      reason: "Distracting category or intent detected."
    };
  }

  if (!hasAllowList && !WORK_CATEGORIES.has(category)) {
    return {
      allowed: false,
      severity: "notice",
      reason: "Activity is not categorized as deep work, research, productivity, or development."
    };
  }

  return {
    allowed: true,
    severity: "ok",
    reason: "Activity matches the active focus protocol."
  };
}

export async function startDeepWorkSession(input: StrictFocusInput) {
  if (input.projectId) {
    const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: input.userId, active: true }, select: { id: true } });
    if (!project) throw new Error("Project not found");
  }
  const existing = await prisma.deepWorkSession.findFirst({
    where: {
      userId: input.userId,
      status: "active"
    },
    orderBy: { startedAt: "desc" }
  });

  if (existing) {
    await advanceDeepWorkTimer(existing.id);
    const stillActive = await prisma.deepWorkSession.findFirst({ where: { id: existing.id, status: "active" } });
    if (stillActive) throw new Error("A deep work session is already active");
  }

  const timerMode = input.timerMode === "pomodoro" ? "pomodoro" : "countdown";
  const countdownMinutes = boundedInteger(input.plannedMinutes, 25, 1, 480);
  const focusMinutes = timerMode === "pomodoro"
    ? boundedInteger(input.focusMinutes ?? input.plannedMinutes, 25, 5, 120)
    : countdownMinutes;
  const totalRounds = timerMode === "pomodoro" ? boundedInteger(input.totalRounds, 4, 1, 12) : 1;
  const shortBreakMinutes = boundedInteger(input.shortBreakMinutes, 5, 1, 30);
  const longBreakMinutes = boundedInteger(input.longBreakMinutes, 15, 1, 60);
  const plannedMinutes = timerMode === "pomodoro" ? focusMinutes * totalRounds : countdownMinutes;
  const startedAt = new Date();
  const phaseEndsAt = new Date(startedAt.getTime() + focusMinutes * 60_000);
  const ambientSound = AMBIENT_SOUNDS.has(input.ambientSound ?? "") ? input.ambientSound! : "none";

  const session = await prisma.deepWorkSession.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      goal: input.goal?.trim().slice(0, 240) || null,
      status: "active",
      plannedMinutes,
      startedAt,
      enforcement: normalizeEnforcement(input.enforcement),
      allowedApps: normalizeList(input.allowedApps),
      allowedDomains: normalizeList(input.allowedDomains),
      blockedApps: normalizeList(input.blockedApps),
      blockedDomains: normalizeList(input.blockedDomains),
      timerMode,
      focusMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      totalRounds,
      currentRound: 1,
      currentPhase: "focus",
      phaseStartedAt: startedAt,
      phaseEndsAt,
      ambientSound,
      ambientVolume: boundedVolume(input.ambientVolume),
      phases: {
        create: {
          type: "focus",
          round: 1,
          plannedSeconds: focusMinutes * 60,
          startedAt,
        },
      },
    }
  });

  emitDeepWorkStarted(input.userId, {
    id: session.id,
    projectId: session.projectId,
    goal: session.goal,
    plannedMinutes: session.plannedMinutes,
    enforcement: session.enforcement,
    startedAt: session.startedAt,
    allowedApps: session.allowedApps,
    allowedDomains: session.allowedDomains,
    blockedApps: session.blockedApps,
    blockedDomains: session.blockedDomains,
    timerMode: session.timerMode,
    focusMinutes: session.focusMinutes,
    shortBreakMinutes: session.shortBreakMinutes,
    longBreakMinutes: session.longBreakMinutes,
    totalRounds: session.totalRounds,
    currentRound: session.currentRound,
    currentPhase: session.currentPhase,
    phaseStartedAt: session.phaseStartedAt,
    phaseEndsAt: session.phaseEndsAt,
    pausedAt: session.pausedAt,
    ambientSound: session.ambientSound,
    ambientVolume: session.ambientVolume,
  });

  return session;
}

export async function getActiveDeepWorkSession(userId: string) {
  const active = await prisma.deepWorkSession.findFirst({
    where: { userId, status: "active" },
    orderBy: { startedAt: "desc" },
  });
  if (active?.phaseEndsAt && !active.pausedAt && active.phaseEndsAt <= new Date()) {
    await advanceDeepWorkTimer(active.id);
  }
  return prisma.deepWorkSession.findFirst({
    where: {
      userId,
      status: "active"
    },
    orderBy: {
      startedAt: "desc"
    },
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
      interventions: {
        orderBy: { detectedAt: "desc" },
        take: 10
      },
      phases: { orderBy: { startedAt: "asc" } },
    }
  });
}

async function emitCompletedSession(session: { id: string; userId: string; status: string; endedAt: Date | null }, reason: string) {
  emitDeepWorkEnded(session.userId, session.id, {
    status: session.status,
    endedAt: session.endedAt,
    reason,
  });
  const goals = await updateAndEmitGoalProgress(session.userId);
  emitGoalProgress(session.userId, goals);
}

export async function advanceDeepWorkTimer(id: string, now = new Date(), forceBreakSkip = false) {
  const session = await prisma.deepWorkSession.findUnique({ where: { id } });
  if (!session || session.status !== "active" || session.pausedAt || !session.phaseEndsAt) return session;
  if (!forceBreakSkip && session.phaseEndsAt > now) return session;
  if (forceBreakSkip && session.currentPhase === "focus") throw new Error("Focus phases cannot be skipped");

  const transitionAt = forceBreakSkip ? now : session.phaseEndsAt;
  const activePhase = await prisma.deepWorkPhase.findFirst({
    where: { deepWorkId: id, status: "active" },
    orderBy: { startedAt: "desc" },
  });
  const actualSeconds = activePhase
    ? Math.max(0, Math.floor((transitionAt.getTime() - activePhase.startedAt.getTime()) / 1000) - activePhase.pausedSeconds)
    : 0;
  const phaseStatus = forceBreakSkip ? "skipped" : "completed";

  if (session.currentPhase === "focus" && session.currentRound >= session.totalRounds) {
    const completed = await prisma.$transaction(async (tx) => {
      if (activePhase) {
        await tx.deepWorkPhase.update({
          where: { id: activePhase.id },
          data: { status: "completed", endedAt: transitionAt, actualSeconds },
        });
      }
      return tx.deepWorkSession.update({
        where: { id },
        data: { status: "completed", endedAt: transitionAt, phaseEndsAt: transitionAt },
      });
    });
    await emitCompletedSession(completed, "planned_duration");
    return completed;
  }

  const nextIsFocus = session.currentPhase !== "focus";
  const nextRound = nextIsFocus ? session.currentRound + 1 : session.currentRound;
  const nextPhase = nextIsFocus
    ? "focus"
    : session.currentRound % 4 === 0 ? "long_break" : "short_break";
  const nextMinutes = nextPhase === "focus"
    ? session.focusMinutes
    : nextPhase === "long_break" ? session.longBreakMinutes : session.shortBreakMinutes;
  const nextEndsAt = new Date(transitionAt.getTime() + nextMinutes * 60_000);

  const updated = await prisma.$transaction(async (tx) => {
    if (activePhase) {
      await tx.deepWorkPhase.update({
        where: { id: activePhase.id },
        data: { status: phaseStatus, endedAt: transitionAt, actualSeconds },
      });
    }
    await tx.deepWorkPhase.create({
      data: {
        deepWorkId: id,
        type: nextPhase,
        round: nextRound,
        plannedSeconds: nextMinutes * 60,
        startedAt: transitionAt,
      },
    });
    return tx.deepWorkSession.update({
      where: { id },
      data: {
        currentPhase: nextPhase,
        currentRound: nextRound,
        phaseStartedAt: transitionAt,
        phaseEndsAt: nextEndsAt,
        pausedAt: null,
        pausedRemainingSeconds: null,
      },
    });
  });

  await pushDeepWorkState(updated.userId, updated.id);
  return updated;
}

export async function pauseDeepWorkSession(userId: string, id: string) {
  let session = await prisma.deepWorkSession.findFirst({ where: { id, userId, status: "active" } });
  if (!session) throw new Error("Active session not found");
  if (session.pausedAt) return session;
  if (session.phaseEndsAt && session.phaseEndsAt <= new Date()) {
    await advanceDeepWorkTimer(id);
    session = await prisma.deepWorkSession.findFirst({ where: { id, userId, status: "active" } });
    if (!session) throw new Error("Session already completed");
  }
  const now = new Date();
  const remainingSeconds = Math.max(1, Math.ceil(((session.phaseEndsAt?.getTime() ?? now.getTime()) - now.getTime()) / 1000));
  const updated = await prisma.deepWorkSession.update({
    where: { id },
    data: { pausedAt: now, pausedRemainingSeconds: remainingSeconds, phaseEndsAt: null },
  });
  await pushDeepWorkState(userId, id);
  return updated;
}

export async function resumeDeepWorkSession(userId: string, id: string) {
  const session = await prisma.deepWorkSession.findFirst({ where: { id, userId, status: "active" } });
  if (!session) throw new Error("Active session not found");
  if (!session.pausedAt) return session;
  const now = new Date();
  const pausedSeconds = Math.max(0, Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000));
  const remainingSeconds = Math.max(1, session.pausedRemainingSeconds ?? 1);
  const updated = await prisma.$transaction(async (tx) => {
    const phase = await tx.deepWorkPhase.findFirst({ where: { deepWorkId: id, status: "active" }, orderBy: { startedAt: "desc" } });
    if (phase) await tx.deepWorkPhase.update({ where: { id: phase.id }, data: { pausedSeconds: { increment: pausedSeconds } } });
    return tx.deepWorkSession.update({
      where: { id },
      data: {
        pausedAt: null,
        pausedRemainingSeconds: null,
        phaseEndsAt: new Date(now.getTime() + remainingSeconds * 1000),
      },
    });
  });
  await pushDeepWorkState(userId, id);
  return updated;
}

export async function skipDeepWorkBreak(userId: string, id: string) {
  const session = await prisma.deepWorkSession.findFirst({ where: { id, userId, status: "active" } });
  if (!session) throw new Error("Active session not found");
  if (session.pausedAt) throw new Error("Resume the timer before skipping this break");
  if (session.currentPhase === "focus") throw new Error("Only break phases can be skipped");
  return advanceDeepWorkTimer(id, new Date(), true);
}

export async function endDeepWorkSession(
  userId: string,
  id: string,
  status = "completed"
) {
  const session = await prisma.deepWorkSession.findFirst({
    where: { id, userId }
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "active") {
    throw new Error("Session already ended");
  }
  const finalStatus = status === "completed" ? "completed" : "abandoned";
  const endedAt = new Date();
  const activePhase = await prisma.deepWorkPhase.findFirst({ where: { deepWorkId: id, status: "active" }, orderBy: { startedAt: "desc" } });
  const currentPauseSeconds = session.pausedAt ? Math.floor((endedAt.getTime() - session.pausedAt.getTime()) / 1000) : 0;
  const actualSeconds = activePhase
    ? Math.max(0, Math.floor((endedAt.getTime() - activePhase.startedAt.getTime()) / 1000) - activePhase.pausedSeconds - currentPauseSeconds)
    : 0;
  const updated = await prisma.$transaction(async (tx) => {
    if (activePhase) {
      await tx.deepWorkPhase.update({
        where: { id: activePhase.id },
        data: { status: finalStatus, endedAt, actualSeconds },
      });
    }
    return tx.deepWorkSession.update({
      where: { id },
      data: { status: finalStatus, endedAt, phaseEndsAt: endedAt, pausedAt: null, pausedRemainingSeconds: null },
    });
  });

  await emitCompletedSession(updated, finalStatus === "completed" ? "manual_completion" : "abandoned");
  void dispatchWebhookEvent(
    userId,
    finalStatus === "completed" ? "focus_session.completed" : "focus_session.abandoned",
    { session: updated },
    id
  ).catch((error) => console.error("Focus session webhook dispatch failed:", error));

  return updated;
}

export async function completeDeepWorkSessionByTimer(id: string) {
  return advanceDeepWorkTimer(id);
}

export async function getDeepWorkSessionHistory(userId: string) {
  const sessions = await prisma.deepWorkSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 30,
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
      interventions: {
        orderBy: { detectedAt: "desc" },
        take: 5
      },
      minuteLogs: {
        orderBy: { minuteIndex: "asc" },
        take: -10
      },
      phases: { orderBy: { startedAt: "asc" } }
    }
  });

  return sessions.map((session) => {
    const sparklineMinutes = session.minuteLogs.slice(-10);

    const focusSparkline = sparklineMinutes.map((m) =>
      Number(m.focusScore.toFixed(1))
    );

    const productivitySparkline = sparklineMinutes.map((m) =>
      Number(m.productivityScore.toFixed(1))
    );

    const statusSparkline = sparklineMinutes.map((m) => {
      if (m.distractionFlag) return "distraction";
      if (m.idleFlag) return "idle";
      return "focus";
    });

    const now = new Date();
    const endedAt = session.endedAt ?? now;
    const actualMinutes = Math.floor(
      (endedAt.getTime() - session.startedAt.getTime()) / (60 * 1000)
    );
    const focusedSeconds = session.phases
      .filter((phase) => phase.type === "focus")
      .reduce((sum, phase) => sum + phase.actualSeconds, 0);

    return {
      id: session.id,
      goal: session.goal,
      projectId: session.projectId,
      project: session.project,
      status: session.status,
      plannedMinutes: session.plannedMinutes,
      actualMinutes,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      enforcement: session.enforcement,
      timerMode: session.timerMode,
      currentPhase: session.currentPhase,
      currentRound: session.currentRound,
      totalRounds: session.totalRounds,
      focusedMinutes: Number((focusedSeconds / 60).toFixed(1)),
      ambientSound: session.ambientSound,
      finalFocusScore: Number(session.focusScore.toFixed(2)),
      finalProductivityScore: Number(session.productivityScore.toFixed(2)),
      violationCount: session.violationCount,
      interruptionMs: session.interruptionMs,
      sparkline: {
        focus: focusSparkline,
        productivity: productivitySparkline,
        status: statusSparkline,
        minutesCount: sparklineMinutes.length
      },
      interventions: session.interventions.map((i) => ({
        id: i.id,
        appName: i.appName,
        action: i.action,
        detectedAt: i.detectedAt
      }))
    };
  });
}

export async function resolveFocusIntervention(
  userId: string,
  id: string,
  reason?: string | null,
  action = "allowed_once"
) {
  const existing = await prisma.focusIntervention.findFirst({ where: { id, deepWork: { userId } } });
  if (!existing) throw new Error("Intervention not found");
  const updated = await prisma.focusIntervention.update({
    where: { id },
    data: {
      reason: reason ?? null,
      resolution: action,
      resolvedAt: new Date(),
    }
  });
  emitInterventionResolved(userId, id, action);
  return updated;
}

/**
 * Evaluate a deep work activity and update session metrics.
 *
 * METRIC MODEL (all values start from 0 and build through the smoothing engine):
 *
 *   targetFocus = seeded focusImpact * 100
 *   targetProductivity = seeded category / intent / focus weights
 *
 * This ensures:
 *   - All values start at 0
 *   - Focus/productivity rise gradually toward each app's seeded weights
 *   - Distraction and idle activity pull the running scores back down
 *   - No instant jump to a neutral/default baseline
 */
export async function evaluateDeepWorkActivity(
  userId: string,
  activity: ActivityInput,
  previousActivity?: ActivityInput | null
) {
  const session = await prisma.deepWorkSession.findFirst({
    where: {
      userId,
      status: "active",
      startedAt: {
        lte: activity.endTime
      }
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  if (!session) return null;

  const currentOverlapMs = getActivityOverlapMs(session, activity);
  const previousOverlapMs = getActivityOverlapMs(session, previousActivity);
  const duration = Math.max(0, currentOverlapMs - previousOverlapMs);

  if (duration <= 0) {
    await pushDeepWorkState(userId, session.id);
    return null;
  }

  const result = evaluateProtocol(session, activity);
  const idle = isIdleActivity(activity);
  const productive = !idle && result.allowed;
  const distraction = !idle && !result.allowed;

  // Accumulate time buckets
  const nextProductiveMs = session.productiveMs + (productive ? duration : 0);
  const nextDistractionMs = session.distractionMs + (distraction ? duration : 0);
  const nextIdleMs = session.idleMs + (idle ? duration : 0);

  const metricActivity = {
    ...activity,
    durationMs: duration,
  };
  const nextMetricState = updateSmoothMetricState(
    {
      focusScore: session.focusScore,
      productivityScore: session.productivityScore,
      deepWorkScore: 0,
      burnoutScore: 0,
    },
    metricActivity
  );
  const nextFocusScore = nextMetricState.focusScore;
  const nextProductivityScore = nextMetricState.productivityScore;

  // Track if this is a NEW violation (not a continuation of same distraction)
  const isNewViolation = distraction && (
    session.distractionMs === 0 ||
    (session.lastViolationAt &&
      new Date().getTime() - new Date(session.lastViolationAt).getTime() > 5000)
  );

  const updatedSession = await prisma.deepWorkSession.update({
    where: { id: session.id },
    data: {
      productiveMs: nextProductiveMs,
      distractionMs: nextDistractionMs,
      idleMs: nextIdleMs,
      focusScore: nextFocusScore,
      productivityScore: nextProductivityScore,
      violationCount: {
        increment: isNewViolation ? 1 : 0
      },
      interruptionMs: {
        increment: distraction ? duration : 0
      },
      lastViolationAt: isNewViolation ? new Date() : undefined,
    }
  });

  const timer = getDeepWorkTimerState(updatedSession);
  emitDeepWorkState(userId, session.id, {
    ...timer,
    focusScore: Number(updatedSession.focusScore.toFixed(2)),
    productivityScore: Number(updatedSession.productivityScore.toFixed(2)),
    violationCount: updatedSession.violationCount,
    productiveMs: updatedSession.productiveMs,
    distractionMs: updatedSession.distractionMs,
    idleMs: updatedSession.idleMs,
    interruptionMs: updatedSession.interruptionMs,
  });

  if (result.allowed) {
    emitInterventionCleared(userId, session.id, {
      appName: activity.appName,
      domain: activity.domain ?? null,
      windowTitle: activity.windowTitle,
    });
    return null;
  }

  if (!isNewViolation) return null;

  const intervention = await prisma.focusIntervention.create({
    data: {
      deepWorkId: session.id,
      appName: activity.appName,
      domain: activity.domain ?? null,
      windowTitle: activity.windowTitle,
      action: interventionAction(session.enforcement),
      durationMs: duration
    }
  });

  emitInterventionTriggered(userId, {
    id: intervention.id,
    deepWorkId: session.id,
    appName: intervention.appName,
    windowTitle: intervention.windowTitle,
    domain: intervention.domain,
    action: intervention.action,
    reason: intervention.reason,
    detectedAt: intervention.detectedAt,
  });

  return {
    sessionId: session.id,
    intervention,
    enforcement: session.enforcement,
    message: result.reason
  };
}

export async function getDeepWorkSessionResult(sessionId: string, userId: string) {
  const session = await prisma.deepWorkSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
      minuteLogs: {
        orderBy: { minuteIndex: "asc" }
      },
      interventions: {
        orderBy: { detectedAt: "asc" }
      },
      phases: { orderBy: { startedAt: "asc" } }
    }
  });

  if (!session) return null;

  const enforcementEvents = await prisma.distractionBlockEvent.findMany({
    where: { deepWorkId: session.id, userId },
    orderBy: { occurredAt: "asc" },
  });

  const now = new Date();
  const endedAt = session.endedAt ?? now;
  const actualDurationMs = endedAt.getTime() - session.startedAt.getTime();
  const actualMinutes = Number((actualDurationMs / 60_000).toFixed(1));
  const plannedMinutes = session.plannedMinutes;
  const focusSecondsFromPhases = session.phases
    .filter((phase) => phase.type === "focus")
    .reduce((sum, phase) => sum + phase.actualSeconds, 0);
  const focusedSeconds = focusSecondsFromPhases || Math.min(actualDurationMs / 1000, plannedMinutes * 60);
  const breakSeconds = session.phases
    .filter((phase) => phase.type !== "focus")
    .reduce((sum, phase) => sum + phase.actualSeconds, 0);

  // ─── ACCURATE TIME ALLOCATION ───
  // Use the session's accumulated ms directly (these are the source of truth)
  let productiveMs = session.productiveMs || 0;
  let distractionMs = session.distractionMs || 0;
  let idleMs = session.idleMs || 0;
  let totalTrackedMs = productiveMs + distractionMs + idleMs;

  // Fallback 1: If session accumulators are 0, check overlapping raw activities
  if (totalTrackedMs === 0) {
    const overlappingActivities = await prisma.activity.findMany({
      where: {
        session: { userId },
        startTime: { lte: endedAt },
        endTime: { gte: session.startedAt },
      },
    });

    if (overlappingActivities.length > 0) {
      for (const act of overlappingActivities) {
        const start = Math.max(session.startedAt.getTime(), act.startTime.getTime());
        const end = Math.min(endedAt.getTime(), act.endTime.getTime());
        const dur = Math.max(0, end - start);
        if (dur <= 0) continue;
        const cat = (act.category ?? "").toLowerCase();
        const app = (act.appName ?? "").toLowerCase();
        if (cat === "idle" || app.includes("idle")) {
          idleMs += dur;
        } else if (cat === "distracting" || cat === "social" || cat === "entertainment") {
          distractionMs += dur;
        } else {
          productiveMs += dur;
        }
      }
      totalTrackedMs = productiveMs + distractionMs + idleMs;
    }
  }

  // Fallback 2: If still 0, fall back to elapsed focus duration
  if (totalTrackedMs === 0 && focusedSeconds > 0) {
    const focusDurationMs = Math.round(focusedSeconds * 1000);
    const interruptionMs = session.interruptionMs || 0;
    distractionMs = Math.min(focusDurationMs, interruptionMs);
    productiveMs = Math.max(0, focusDurationMs - distractionMs);
    idleMs = 0;
    totalTrackedMs = productiveMs + distractionMs + idleMs;
  }

  const productiveMinutes = Number((productiveMs / 60000).toFixed(1));
  const distractionMinutes = Number((distractionMs / 60000).toFixed(1));
  const idleMinutes = Number((idleMs / 60000).toFixed(1));
  const totalTrackedMinutes = Number((totalTrackedMs / 60000).toFixed(1));

  // ─── ACCURATE FOCUS / PRODUCTIVITY ───
  // These are the final scores from the session (computed incrementally)
  const finalFocusScore = session.focusScore > 0
    ? Number(session.focusScore.toFixed(2))
    : totalTrackedMs > 0
      ? Number(((productiveMs / totalTrackedMs) * 100).toFixed(2))
      : 0;
  const finalProductivityScore = session.productivityScore > 0
    ? Number(session.productivityScore.toFixed(2))
    : finalFocusScore;

  // ─── DERIVED METRICS ───
  // Focus efficiency: what % of tracked time was productive
  const focusEfficiency = totalTrackedMs > 0
    ? Number(((productiveMs / totalTrackedMs) * 100).toFixed(2))
    : 0;

  // Distraction ratio: what % of tracked time was distraction
  const distractionRatio = totalTrackedMs > 0
    ? Number(((distractionMs / totalTrackedMs) * 100).toFixed(2))
    : 0;

  // Idle ratio
  const idleRatio = totalTrackedMs > 0
    ? Number(((idleMs / totalTrackedMs) * 100).toFixed(2))
    : 0;

  // Completion rate
  const completionRate = plannedMinutes > 0
    ? Math.min(100, (focusedSeconds / (plannedMinutes * 60)) * 100)
    : 0;

  // ─── ATOMIC PER-SECOND TIME SERIES ───
  // Construct a true atomic second-by-second timeline combining minuteLogs,
  // raw activities, and recorded interventions.
  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { lte: endedAt },
      endTime: { gte: session.startedAt },
    },
    orderBy: { startTime: "asc" },
  });

  const totalDurationSec = Math.max(
    1,
    Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
  );

  const minuteLogMap = new Map<number, (typeof session.minuteLogs)[0]>();
  for (const ml of session.minuteLogs) {
    minuteLogMap.set(ml.minuteIndex, ml);
  }

  const timeSeries: Array<{
    second: number;
    timestamp: string;
    focusScore: number;
    productivityScore: number;
    distraction: boolean;
    idle: boolean;
    appName: string | null;
    category: string | null;
  }> = [];

  let runningFocus = session.focusScore > 0 ? Math.min(100, Math.max(50, session.focusScore * (session.focusScore <= 1 ? 100 : 1))) : 80;
  let runningProd = session.productivityScore > 0 ? Math.min(100, Math.max(50, session.productivityScore * (session.productivityScore <= 1 ? 100 : 1))) : 80;

  for (let s = 0; s < totalDurationSec; s++) {
    const secMs = session.startedAt.getTime() + s * 1000;
    const secDate = new Date(secMs);
    const minuteIndex = Math.floor(s / 60);

    // Active intervention at this exact second
    const activeInv = session.interventions.find((inv) => {
      const invStart = inv.detectedAt.getTime();
      const invEnd = invStart + (inv.durationMs || 3000);
      return secMs >= invStart && secMs <= invEnd;
    });

    // Active activity at this exact second
    const activeAct = activities.find((act) => {
      return act.startTime.getTime() <= secMs && act.endTime.getTime() >= secMs;
    });

    const isDistraction = !!activeInv || (activeAct && (activeAct.category === "distracting" || activeAct.category === "entertainment" || activeAct.category === "social"));
    const isIdle = !isDistraction && (activeAct?.category === "idle" || activeAct?.appName?.toLowerCase().includes("idle"));

    const currentApp = activeInv?.appName || activeAct?.appName || (minuteLogMap.get(minuteIndex)?.appName) || "desktop";
    const currentCategory = activeInv ? "distracting" : (activeAct?.category || minuteLogMap.get(minuteIndex)?.category || "productivity");

    // Dynamic per-second score response
    if (isDistraction) {
      runningFocus = Math.max(10, runningFocus - 2.5);
      runningProd = Math.max(10, runningProd - 2.5);
    } else if (isIdle) {
      runningFocus = Math.max(20, runningFocus - 0.5);
      runningProd = Math.max(20, runningProd - 0.5);
    } else {
      runningFocus = Math.min(100, runningFocus + 1.2);
      runningProd = Math.min(100, runningProd + 1.2);
    }

    const currentMinuteLog = minuteLogMap.get(minuteIndex);
    const nextMinuteLog = minuteLogMap.get(minuteIndex + 1);
    let finalSecFocus = runningFocus;
    let finalSecProd = runningProd;

    if (currentMinuteLog) {
      const curScore = currentMinuteLog.focusScore <= 1 ? currentMinuteLog.focusScore * 100 : currentMinuteLog.focusScore;
      const curProdScore = currentMinuteLog.productivityScore <= 1 ? currentMinuteLog.productivityScore * 100 : currentMinuteLog.productivityScore;
      if (nextMinuteLog) {
        const nextScore = nextMinuteLog.focusScore <= 1 ? nextMinuteLog.focusScore * 100 : nextMinuteLog.focusScore;
        const nextProdScore = nextMinuteLog.productivityScore <= 1 ? nextMinuteLog.productivityScore * 100 : nextMinuteLog.productivityScore;
        const t = (s % 60) / 60;
        const targetFocus = curScore + (nextScore - curScore) * t;
        const targetProd = curProdScore + (nextProdScore - curProdScore) * t;
        finalSecFocus = targetFocus * 0.7 + runningFocus * 0.3;
        finalSecProd = targetProd * 0.7 + runningProd * 0.3;
      } else {
        finalSecFocus = curScore * 0.7 + runningFocus * 0.3;
        finalSecProd = curProdScore * 0.7 + runningProd * 0.3;
      }
    }

    if (isDistraction) {
      finalSecFocus = Math.min(finalSecFocus, 45);
      finalSecProd = Math.min(finalSecProd, 45);
    }

    timeSeries.push({
      second: s,
      timestamp: secDate.toISOString(),
      focusScore: Number(Math.max(0, Math.min(100, finalSecFocus)).toFixed(1)),
      productivityScore: Number(Math.max(0, Math.min(100, finalSecProd)).toFixed(1)),
      distraction: !!isDistraction,
      idle: !!isIdle,
      appName: currentApp,
      category: currentCategory,
    });
  }

  let recoveryCount = 0;
  let recoveryTotalSeconds = 0;
  for (let i = 1; i < timeSeries.length; i++) {
    if (timeSeries[i - 1].distraction && !timeSeries[i].distraction) {
      recoveryCount++;
      let recoverySeconds = 1;
      for (let j = i + 1; j < timeSeries.length; j++) {
        if (timeSeries[j].distraction) break;
        recoverySeconds++;
      }
      recoveryTotalSeconds += recoverySeconds;
    }
  }
  const avgRecoveryMinutes =
    recoveryCount > 0 ? recoveryTotalSeconds / recoveryCount / 60 : 0;

  return {
    session: {
      id: session.id,
      goal: session.goal,
      status: session.status,
      plannedMinutes,
      actualMinutes,
      completionRate: Number(completionRate.toFixed(2)),
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      enforcement: session.enforcement,
      timerMode: session.timerMode,
      focusMinutes: session.focusMinutes,
      shortBreakMinutes: session.shortBreakMinutes,
      longBreakMinutes: session.longBreakMinutes,
      totalRounds: session.totalRounds,
      completedRounds: session.phases.filter((phase) => phase.type === "focus" && phase.status === "completed").length,
      ambientSound: session.ambientSound,
      project: session.project,
    },
    metrics: {
      // Time allocation (from session accumulators — source of truth)
      totalTrackedMinutes,
      productiveMinutes,
      distractionMinutes,
      idleMinutes,

      // Ratios
      focusEfficiency,
      distractionRatio,
      idleRatio,

      // Scores
      finalFocusScore,
      finalProductivityScore,
      violationCount: session.violationCount || 0,
      interruptionMs: session.interruptionMs || 0,

      // Recovery
      avgRecoveryMinutes: Number(avgRecoveryMinutes.toFixed(2)),
      focusedMinutes: Number((focusedSeconds / 60).toFixed(1)),
      breakMinutes: Number((breakSeconds / 60).toFixed(1)),
      blockedCount: enforcementEvents.filter((item) => item.outcome === "killed").length,
      blockFailureCount: enforcementEvents.filter((item) => item.outcome === "failed").length,
      warnedCount: session.interventions.filter((item) => item.action === "warned").length,
      reasonRequiredCount: session.interventions.filter((item) => item.action === "reason_required").length,
      overrideCount: session.interventions.filter((item) => item.resolution === "allowed_once").length,
    },
    timeSeries,
    phases: session.phases.map((phase) => ({
      id: phase.id,
      type: phase.type,
      round: phase.round,
      status: phase.status,
      plannedSeconds: phase.plannedSeconds,
      actualSeconds: phase.actualSeconds,
      startedAt: phase.startedAt,
      endedAt: phase.endedAt,
    })),
    enforcementEvents,
    interventions: session.interventions.map((i) => ({
      id: i.id,
      appName: i.appName,
      windowTitle: i.windowTitle,
      domain: i.domain,
      action: i.action,
      reason: i.reason,
      resolution: i.resolution,
      resolvedAt: i.resolvedAt,
      detectedAt: i.detectedAt,
      durationMs: i.durationMs
    }))
  };
}

export async function pushDeepWorkState(userId: string, sessionId: string) {
  const session = await prisma.deepWorkSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.status !== "active") return;

  const timer = getDeepWorkTimerState(session);

  emitDeepWorkState(userId, sessionId, {
    ...timer,
    focusScore: Number(session.focusScore.toFixed(2)),
    productivityScore: Number(session.productivityScore.toFixed(2)),
    violationCount: session.violationCount,
    productiveMs: session.productiveMs,
    distractionMs: session.distractionMs,
    idleMs: session.idleMs,
    interruptionMs: session.interruptionMs,
  });
}
