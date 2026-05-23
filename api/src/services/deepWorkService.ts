import { prisma } from "../prisma";
import {
  getActivityProductivityScore,
  getBaseFocus,
  isIdleActivity
} from "./metricEngine";

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

  // Build time-series data for curve lines
  const timeSeries = session.minuteLogs.map((log) => ({
    minute: log.minuteIndex,
    timestamp: log.timestamp,
    focusScore: Number(log.focusScore.toFixed(2)),
    productivityScore: Number(log.productivityScore.toFixed(2)),
    distraction: log.distractionFlag,
    idle: log.idleFlag,
    appName: log.appName,
    category: log.category
  }));

  // Calculate aggregates
  const totalMinutes = timeSeries.length;
  const distractionMinutes = timeSeries.filter((t) => t.distraction).length;
  const idleMinutes = timeSeries.filter((t) => t.idle).length;
  const productiveMinutes = totalMinutes - distractionMinutes - idleMinutes;

  const avgFocus =
    totalMinutes > 0
      ? timeSeries.reduce((sum, t) => sum + t.focusScore, 0) / totalMinutes
      : 0;

  const avgProductivity =
    totalMinutes > 0
      ? timeSeries.reduce((sum, t) => sum + t.productivityScore, 0) / totalMinutes
      : 0;

  const peakFocus =
    totalMinutes > 0
      ? Math.max(...timeSeries.map((t) => t.focusScore))
      : 0;

  const peakProductivity =
    totalMinutes > 0
      ? Math.max(...timeSeries.map((t) => t.productivityScore))
      : 0;

  // Recovery rate: how fast user got back to focus after distraction
  let recoveryCount = 0;
  let recoveryTotalMinutes = 0;
  for (let i = 1; i < timeSeries.length; i++) {
    if (timeSeries[i - 1].distraction && !timeSeries[i].distraction) {
      recoveryCount++;
      // Find how many minutes until next distraction or end
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

  // Session completion rate
  const completionRate = plannedMinutes > 0 
    ? Math.min(100, (actualMinutes / plannedMinutes) * 100) 
    : 0;

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
      totalMinutes,
      productiveMinutes,
      distractionMinutes,
      idleMinutes,
      violationCount: session.violationCount,
      interruptionMs: session.interruptionMs,
      avgFocus: Number(avgFocus.toFixed(2)),
      avgProductivity: Number(avgProductivity.toFixed(2)),
      peakFocus: Number(peakFocus.toFixed(2)),
      peakProductivity: Number(peakProductivity.toFixed(2)),
      avgRecoveryMinutes: Number(avgRecoveryMinutes.toFixed(2)),
      finalFocusScore: Number(session.focusScore.toFixed(2)),
      finalProductivityScore: Number(session.productivityScore.toFixed(2))
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

function interventionAction(enforcement: string) {
  if (enforcement === "block") return "blocked";
  if (enforcement === "warn") return "warned";
  if (enforcement === "observe") return "observed";
  return "reason_required";
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
  const domainBlocked = includesRule(blockedDomains, activity.domain);

  if (appBlocked || domainBlocked) {
    return {
      allowed: false,
      severity: "critical",
      reason: "Blocked app or domain entered during strict focus."
    };
  }

  const hasAllowList =
    allowedApps.length > 0 || allowedDomains.length > 0;

  if (hasAllowList) {
    const appAllowed = includesRule(allowedApps, activity.appName);
    const domainAllowed = includesRule(
      allowedDomains,
      activity.domain ?? activity.url
    );

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

  if (
    DISTRACTION_CATEGORIES.has(category) ||
    DISTRACTION_INTENTS.has(intent)
  ) {
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
    orderBy: {
      startedAt: "desc"
    }
  });

  // Auto-abandon stale session (> 2x planned time)
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
      return existing; // Return existing active session
    }
  }

  return prisma.deepWorkSession.create({
    data: {
      userId: input.userId,
      goal: input.goal ?? (null as any),
      status: "active",
      plannedMinutes: Math.max(1, Math.floor(input.plannedMinutes)),
      enforcement: input.enforcement ?? "require_reason",
      allowedApps: input.allowedApps ?? [],
      allowedDomains: input.allowedDomains ?? [],
      blockedApps: input.blockedApps ?? ([] as any),
      blockedDomains: input.blockedDomains ?? ([] as any)
    }
  });
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
        orderBy: {
          detectedAt: "desc"
        },
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

  // Write final log
  await writeSessionEndLog(
    id,
    status === "completed" ? "Session completed" : "Session abandoned"
  );

  return prisma.deepWorkSession.update({
    where: { id },
    data: {
      status,
      endedAt: new Date()
    }
  });
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
        // Only get last 10 minutes for sparkline preview
        take: -10
      }
    }
  });

  return sessions.map((session) => {
    // Build sparkline data: last 10 minutes (or all if < 10)
    const sparklineMinutes = session.minuteLogs.slice(-10);
    
    const focusSparkline = sparklineMinutes.map((m) => 
      Number(m.focusScore.toFixed(1))
    );
    
    const productivitySparkline = sparklineMinutes.map((m) => 
      Number(m.productivityScore.toFixed(1))
    );

    // Distraction/idle flags for color coding
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
      
      // Sparkline preview for dashboard
      sparkline: {
        focus: focusSparkline,
        productivity: productivitySparkline,
        status: statusSparkline,
        minutesCount: sparklineMinutes.length
      },
      
      // Top 5 interventions (existing)
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

export async function evaluateDeepWorkActivity(
  userId: string,
  activity: ActivityInput
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

  const duration = Math.max(0, activity.duration ?? 0);
  const result = evaluateProtocol(session, activity);
  const idle = isIdleActivity(activity);
  const productive = !idle && result.allowed;
  const distraction = !idle && !result.allowed;

  const currentTotal =
    session.productiveMs + session.distractionMs + session.idleMs;
  const nextProductiveMs =
    session.productiveMs + (productive ? duration : 0);
  const nextDistractionMs =
    session.distractionMs + (distraction ? duration : 0);
  const nextIdleMs =
    session.idleMs + (idle ? duration : 0);
  const nextTotal =
    currentTotal + duration;

  const focusContribution = productive
    ? getBaseFocus(activity) * 100
    : 0;
  const productivityContribution = productive
    ? getActivityProductivityScore(activity)
    : 0;

  const nextFocusScore =
    nextTotal > 0
      ? (
          session.focusScore * currentTotal +
          focusContribution * duration
        ) / nextTotal
      : 0;

  const nextProductivityScore =
    nextTotal > 0
      ? (
          session.productivityScore * currentTotal +
          productivityContribution * duration
        ) / nextTotal
      : 0;

  await prisma.deepWorkSession.update({
    where: { id: session.id },
    data: {
      productiveMs: nextProductiveMs,
      distractionMs: nextDistractionMs,
      idleMs: nextIdleMs,
      focusScore: nextFocusScore,
      productivityScore: nextProductivityScore,
      violationCount: {
        increment: distraction ? 1 : 0
      },
      interruptionMs: {
        increment: distraction ? duration : 0
      }
    }
  });

  if (result.allowed) return null;

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

  return {
    sessionId: session.id,
    intervention,
    enforcement: session.enforcement,
    message: result.reason
  };
}
