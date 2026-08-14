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
  emitInterventionTriggered,
} from "../websocket/broadcaster";
import { updateAndEmitGoalProgress } from "./goalProgressService";
import { dispatchWebhookEvent } from "./webhookService";

type StrictFocusInput = {
  userId: string;
  goal?: string | null;
  plannedMinutes: number;
  enforcement?: string | null;
  allowedApps?: string[];
  allowedDomains?: string[];
  blockedApps?: string[];
  blockedDomains?: string[];
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

function getDeepWorkWindowEnd(session: { startedAt: Date; plannedMinutes: number }) {
  return new Date(session.startedAt.getTime() + session.plannedMinutes * 60 * 1000);
}

function getActivityOverlapMs(
  session: { startedAt: Date; plannedMinutes: number },
  activity?: Pick<ActivityInput, "startTime" | "endTime"> | null
) {
  if (!activity) return 0;

  const windowStart = session.startedAt.getTime();
  const windowEnd = getDeepWorkWindowEnd(session).getTime();
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
  const existing = await prisma.deepWorkSession.findFirst({
    where: {
      userId: input.userId,
      status: "active"
    },
    orderBy: { startedAt: "desc" }
  });

  if (existing) {
    const elapsedMinutes = Math.floor(
      (Date.now() - existing.startedAt.getTime()) / (60 * 1000)
    );

    if (elapsedMinutes > existing.plannedMinutes * 2) {
      await prisma.deepWorkSession.update({
        where: { id: existing.id },
        data: {
          status: "abandoned",
          endedAt: new Date()
        }
      });
      console.log(`[DeepWork] Auto-abandoned stale session ${existing.id}`);
    } else {
      return existing;
    }
  }

  const session = await prisma.deepWorkSession.create({
    data: {
      userId: input.userId,
      goal: input.goal ?? (null as any),
      status: "active",
      plannedMinutes: Math.max(1, Math.floor(input.plannedMinutes)),
      enforcement: normalizeEnforcement(input.enforcement),
      allowedApps: input.allowedApps ?? [],
      allowedDomains: input.allowedDomains ?? [],
      blockedApps: input.blockedApps ?? ([] as any),
      blockedDomains: input.blockedDomains ?? ([] as any)
    }
  });

  emitDeepWorkStarted(input.userId, {
    id: session.id,
    goal: session.goal,
    plannedMinutes: session.plannedMinutes,
    enforcement: session.enforcement,
    startedAt: session.startedAt,
    allowedApps: session.allowedApps,
    allowedDomains: session.allowedDomains,
    blockedApps: session.blockedApps,
    blockedDomains: session.blockedDomains,
  });

  return session;
}

export async function getActiveDeepWorkSession(userId: string) {
  return prisma.deepWorkSession.findFirst({
    where: {
      userId,
      status: "active"
    },
    orderBy: {
      startedAt: "desc"
    },
    include: {
      interventions: {
        orderBy: { detectedAt: "desc" },
        take: 10
      }
    }
  });
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

  if (session.status === "expired") {
    throw new Error("Cannot modify expired session");
  }

  if (session.status !== "active") {
    throw new Error("Session already ended");
  }

  await writeSessionEndLog(
    id,
    status === "completed" ? "Session completed" : "Session abandoned"
  );

  const updated = await prisma.deepWorkSession.update({
    where: { id },
    data: {
      status,
      endedAt: new Date()
    }
  });

  emitDeepWorkEnded(userId, id, {
    status,
    endedAt: new Date(),
  });
  void dispatchWebhookEvent(
    userId,
    status === "completed" ? "focus_session.completed" : "focus_session.abandoned",
    { session: updated },
    id
  ).catch((error) => console.error("Focus session webhook dispatch failed:", error));

  const goals = await updateAndEmitGoalProgress(userId);
  emitGoalProgress(userId, goals);

  return updated;
}

export async function completeDeepWorkSessionByTimer(id: string) {
  const session = await prisma.deepWorkSession.findUnique({
    where: { id }
  });

  if (!session || session.status !== "active") return null;

  await writeSessionEndLog(id, "Planned duration completed");

  const endedAt = getDeepWorkWindowEnd(session);
  const updated = await prisma.deepWorkSession.update({
    where: { id },
    data: {
      status: "completed",
      endedAt
    }
  });

  emitDeepWorkEnded(session.userId, id, {
    status: "completed",
    endedAt,
    reason: "planned_duration"
  });
  void dispatchWebhookEvent(
    session.userId,
    "focus_session.completed",
    { session: updated, reason: "planned_duration" },
    id
  ).catch((error) => console.error("Focus session webhook dispatch failed:", error));

  const goals = await updateAndEmitGoalProgress(session.userId);
  emitGoalProgress(session.userId, goals);

  return updated;
}

async function writeSessionEndLog(sessionId: string, reason: string) {
  const lastLog = await prisma.deepWorkMinuteLog.findFirst({
    where: { deepWorkId: sessionId },
    orderBy: { minuteIndex: "desc" }
  });

  const nextMinuteIndex = lastLog ? lastLog.minuteIndex + 1 : 0;

  await prisma.deepWorkMinuteLog.create({
    data: {
      deepWorkId: sessionId,
      minuteIndex: nextMinuteIndex,
      timestamp: new Date(),
      focusScore: 0,
      productivityScore: 0,
      distractionFlag: false,
      idleFlag: true,
      appName: "System",
      windowTitle: reason,
      category: "system",
      intent: "session_end"
    }
  });
}

export async function getDeepWorkSessionHistory(userId: string) {
  const sessions = await prisma.deepWorkSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 30,
    include: {
      interventions: {
        orderBy: { detectedAt: "desc" },
        take: 5
      },
      minuteLogs: {
        orderBy: { minuteIndex: "asc" },
        take: -10
      }
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

    return {
      id: session.id,
      goal: session.goal,
      status: session.status,
      plannedMinutes: session.plannedMinutes,
      actualMinutes,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      enforcement: session.enforcement,
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
  id: string,
  reason?: string | null,
  action = "allowed_once"
) {
  return prisma.focusIntervention.update({
    where: { id },
    data: {
      reason: reason ?? null,
      action
    }
  });
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

  emitDeepWorkState(userId, session.id, {
    elapsedMinutes: Math.floor(
      (Date.now() - updatedSession.startedAt.getTime()) / (60 * 1000)
    ),
    remainingMinutes: Math.max(
      0,
      updatedSession.plannedMinutes -
        Math.floor((Date.now() - updatedSession.startedAt.getTime()) / (60 * 1000))
    ),
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
      minuteLogs: {
        orderBy: { minuteIndex: "asc" }
      },
      interventions: {
        orderBy: { detectedAt: "asc" }
      }
    }
  });

  if (!session) return null;

  const now = new Date();
  const endedAt = session.endedAt ?? now;
  const actualDurationMs = endedAt.getTime() - session.startedAt.getTime();
  const actualMinutes = Math.floor(actualDurationMs / (60 * 1000));
  const plannedMinutes = session.plannedMinutes;

  // ─── ACCURATE TIME ALLOCATION ───
  // Use the session's accumulated ms directly (these are the source of truth)
  const productiveMs = session.productiveMs || 0;
  const distractionMs = session.distractionMs || 0;
  const idleMs = session.idleMs || 0;
  const totalTrackedMs = productiveMs + distractionMs + idleMs;

  const productiveMinutes = Math.round(productiveMs / 60000);
  const distractionMinutes = Math.round(distractionMs / 60000);
  const idleMinutes = Math.round(idleMs / 60000);
  const totalTrackedMinutes = productiveMinutes + distractionMinutes + idleMinutes;

  // ─── ACCURATE FOCUS / PRODUCTIVITY ───
  // These are the final scores from the session (computed incrementally)
  const finalFocusScore = Number(session.focusScore.toFixed(2));
  const finalProductivityScore = Number(session.productivityScore.toFixed(2));

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
    ? Math.min(100, (actualMinutes / plannedMinutes) * 100)
    : 0;

  // ─── PER-SECOND TIME SERIES ───
  // Interpolate between minute-log data points to create smooth per-second data.
  // This gives a much more detailed view of how focus/productivity evolved.
  const minuteLogs = session.minuteLogs;
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

  if (minuteLogs.length === 0) {
    // No minute logs — use session start/end as a single data point
    timeSeries.push({
      second: 0,
      timestamp: session.startedAt.toISOString(),
      focusScore: 0,
      productivityScore: 0,
      distraction: false,
      idle: false,
      appName: null,
      category: null,
    });
  } else if (minuteLogs.length === 1) {
    // Single minute log — just use it
    const log = minuteLogs[0];
    timeSeries.push({
      second: 0,
      timestamp: log.timestamp.toISOString(),
      focusScore: Number(log.focusScore.toFixed(2)),
      productivityScore: Number(log.productivityScore.toFixed(2)),
      distraction: log.distractionFlag,
      idle: log.idleFlag,
      appName: log.appName,
      category: log.category,
    });
  } else {
    // Multiple minute logs — interpolate per-second between each pair
    for (let i = 0; i < minuteLogs.length - 1; i++) {
      const curr = minuteLogs[i];
      const next = minuteLogs[i + 1];

      const currSec = curr.minuteIndex * 60;
      const nextSec = next.minuteIndex * 60;
      const gapSec = nextSec - currSec;

      const currFocus = curr.focusScore;
      const nextFocus = next.focusScore;
      const currProd = curr.productivityScore;
      const nextProd = next.productivityScore;

      for (let s = 0; s < gapSec; s++) {
        const t = gapSec > 0 ? s / gapSec : 0;
        const focus = currFocus + (nextFocus - currFocus) * t;
        const prod = currProd + (nextProd - currProd) * t;

        // Determine state: if either endpoint is distraction, mark as distraction
        // (distractions are discrete events, not interpolated)
        const isDistraction = curr.distractionFlag || next.distractionFlag;
        const isIdle = !isDistraction && (curr.idleFlag || next.idleFlag);

        timeSeries.push({
          second: currSec + s,
          timestamp: new Date(curr.timestamp.getTime() + s * 1000).toISOString(),
          focusScore: Number(focus.toFixed(2)),
          productivityScore: Number(prod.toFixed(2)),
          distraction: isDistraction,
          idle: isIdle,
          appName: s === 0 ? curr.appName : null, // only first second gets the app name
          category: s === 0 ? curr.category : null,
        });
      }
    }

    // Add the last minute log's data point
    const last = minuteLogs[minuteLogs.length - 1];
    timeSeries.push({
      second: last.minuteIndex * 60,
      timestamp: last.timestamp.toISOString(),
      focusScore: Number(last.focusScore.toFixed(2)),
      productivityScore: Number(last.productivityScore.toFixed(2)),
      distraction: last.distractionFlag,
      idle: last.idleFlag,
      appName: last.appName,
      category: last.category,
    });
  }

  let recoveryCount = 0;
  let recoveryTotalMinutes = 0;
  for (let i = 1; i < timeSeries.length; i++) {
    if (timeSeries[i - 1].distraction && !timeSeries[i].distraction) {
      recoveryCount++;
      let recoveryMinutes = 1;
      for (let j = i + 1; j < timeSeries.length; j++) {
        if (timeSeries[j].distraction) break;
        recoveryMinutes++;
      }
      recoveryTotalMinutes += recoveryMinutes;
    }
  }
  const avgRecoveryMinutes =
    recoveryCount > 0 ? recoveryTotalMinutes / recoveryCount : 0;

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
      enforcement: session.enforcement
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
    },
    timeSeries,
    interventions: session.interventions.map((i) => ({
      id: i.id,
      appName: i.appName,
      windowTitle: i.windowTitle,
      domain: i.domain,
      action: i.action,
      reason: i.reason,
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

  const now = new Date();
  const elapsedMinutes = Math.floor(
    (now.getTime() - session.startedAt.getTime()) / (60 * 1000)
  );
  const remainingMinutes = Math.max(0, session.plannedMinutes - elapsedMinutes);

  emitDeepWorkState(userId, sessionId, {
    elapsedMinutes,
    remainingMinutes,
    focusScore: Number(session.focusScore.toFixed(2)),
    productivityScore: Number(session.productivityScore.toFixed(2)),
    violationCount: session.violationCount,
    productiveMs: session.productiveMs,
    distractionMs: session.distractionMs,
    idleMs: session.idleMs,
    interruptionMs: session.interruptionMs,
  });
}
