import { prisma } from "../prisma";
import { evaluateProtocol, pushDeepWorkState } from "./deepWorkService";
import { isIdleActivity } from "./metricEngine";
import { emitDeepWorkMinute } from "../websocket/broadcaster";

export function startMinuteLogger() {
  console.log("[MinuteLogger] Started");

  setInterval(async () => {
    try {
      const activeSessions = await prisma.deepWorkSession.findMany({
        where: {
          status: "active"
        }
      });

      for (const session of activeSessions) {
        try {
          await logMinuteForSession(session.id);
        } catch (err) {
          console.error(`[MinuteLogger] Error logging session ${session.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[MinuteLogger] Error fetching active sessions:", err);
    }
  }, 60000);
}

async function logMinuteForSession(sessionId: string) {
  const session = await prisma.deepWorkSession.findUnique({
    where: { id: sessionId },
    include: { minuteLogs: true }
  });

  if (!session || session.status !== "active") return;

  if (session.currentPhase !== "focus" || session.pausedAt) {
    await pushDeepWorkState(session.userId, sessionId);
    return;
  }

  const nextMinuteIndex = session.minuteLogs.length;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000);

  const recentActivity = await prisma.activity.findFirst({
    where: {
      session: {
        userId: session.userId
      },
      startTime: {
        lt: now
      },
      endTime: {
        gte: windowStart
      }
    },
    orderBy: {
      endTime: "desc"
    }
  });

  if (!recentActivity) {
    await prisma.deepWorkMinuteLog.create({
      data: {
        deepWorkId: session.id,
        minuteIndex: nextMinuteIndex,
        timestamp: now,
        focusScore: session.focusScore,
        productivityScore: session.productivityScore,
        distractionFlag: false,
        idleFlag: true,
        appName: null,
        windowTitle: "Idle",
        category: "idle",
        intent: "idle"
      }
    });

    emitDeepWorkMinute(session.userId, sessionId, {
      minute: nextMinuteIndex,
      focusScore: session.focusScore,
      productivityScore: session.productivityScore,
      distraction: false,
      idle: true,
      appName: null,
    });

    await pushDeepWorkState(session.userId, sessionId);
    return;
  }

  const protocolResult = evaluateProtocol(session, {
    appName: recentActivity.appName,
    windowTitle: recentActivity.windowTitle,
    startTime: recentActivity.startTime,
    endTime: recentActivity.endTime,
    duration: recentActivity.duration,
    type: recentActivity.type,
    category: recentActivity.category,
    intent: recentActivity.intent,
    focusImpact: recentActivity.focusImpact,
    confidence: recentActivity.confidence,
    domain: recentActivity.domain,
    url: recentActivity.url
  });

  const idle = isIdleActivity(recentActivity);
  const productive = !idle && protocolResult.allowed;
  const distraction = !idle && !protocolResult.allowed;

  let focusScore = 0;
  let productivityScore = 0;

  // CRITICAL: Record the session's RUNNING focus/productivity score at this minute.
  // This ensures the minute logs match the session's actual score progression
  // (computed by evaluateDeepWorkActivity's proportional model).
  // For productive minutes, the session score will be rising toward the target.
  // For distraction minutes, the session score will be dropping.
  // For idle minutes, the session score stays flat.
  focusScore = session.focusScore;
  productivityScore = session.productivityScore;

  await prisma.deepWorkMinuteLog.create({
    data: {
      deepWorkId: session.id,
      minuteIndex: nextMinuteIndex,
      timestamp: now,
      focusScore,
      productivityScore,
      distractionFlag: distraction,
      idleFlag: idle,
      appName: recentActivity.appName,
      windowTitle: recentActivity.windowTitle,
      category: recentActivity.category ?? "unknown",
      intent: recentActivity.intent ?? "unknown"
    }
  });

  // ─── WebSocket broadcast ───
  emitDeepWorkMinute(session.userId, sessionId, {
    minute: nextMinuteIndex,
    focusScore,
    productivityScore,
    distraction,
    idle,
    appName: recentActivity.appName,
  });

  // Push full state update
  await pushDeepWorkState(session.userId, sessionId);
}
