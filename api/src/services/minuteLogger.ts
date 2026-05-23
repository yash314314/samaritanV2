import { prisma } from "../prisma";
import {
  getBaseFocus,
  getActivityProductivityScore,
  isIdleActivity
} from "./metricEngine";
import { evaluateProtocol } from "./deepWorkService";

const MINUTE_MS = 60 * 1000;

export async function logMinuteForSession(sessionId: string) {
  const now = new Date();

  // 1. Get the session with current aggregates
  const session = await prisma.deepWorkSession.findUnique({
    where: { id: sessionId },
    include: {
      minuteLogs: {
        orderBy: { minuteIndex: "desc" },
        take: 1
      }
    }
  });

  if (!session || session.status !== "active") return;

  // 2. Calculate next minute index
  const lastMinute = session.minuteLogs[0];
  const nextMinuteIndex = lastMinute ? lastMinute.minuteIndex + 1 : 0;

  // 3. Find the most recent activity for this user in the last minute
  const minuteAgo = new Date(now.getTime() - MINUTE_MS);
  
  const recentActivity = await prisma.activity.findFirst({
    where: {
      session: { userId: session.userId },
      startTime: { gte: minuteAgo },
      endTime: { lte: now }
    },
    orderBy: { endTime: "desc" }
  });

  // 4. Evaluate against session protocol
  let focusScore = 0;
  let productivityScore = 0;
  let distractionFlag = false;
  let idleFlag = false;
  let appName = null;
  let windowTitle = null;
  let category = null;
  let intent = null;

  if (!recentActivity) {
    // No activity in last minute = idle
    idleFlag = true;
    focusScore = 0;
    productivityScore = 0;
  } else {
    appName = recentActivity.appName;
    windowTitle = recentActivity.windowTitle;
    category = recentActivity.category;
    intent = recentActivity.intent;

    const isIdle = isIdleActivity({
      appName: recentActivity.appName,
      type: recentActivity.type,
      category: recentActivity.category
    });

    if (isIdle) {
      idleFlag = true;
      focusScore = 0;
      productivityScore = 0;
    } else {
      // Evaluate against deep work protocol
      const protocolResult = evaluateProtocol(session, {
        appName: recentActivity.appName,
        windowTitle: recentActivity.windowTitle,
        domain: recentActivity.domain,
        url: recentActivity.url,
        category: recentActivity.category,
        intent: recentActivity.intent,
        startTime: recentActivity.startTime,
        endTime: recentActivity.endTime,
        duration: recentActivity.duration
      });

      if (!protocolResult.allowed) {
        distractionFlag = true;
        focusScore = 0;
        productivityScore = 0;
      } else {
        // Calculate scores using metricEngine
        const metricInput = {
          appName: recentActivity.appName,
          category: recentActivity.category,
          intent: recentActivity.intent,
          focusImpact: recentActivity.focusImpact,
          confidence: recentActivity.confidence
        };

        focusScore = getBaseFocus(metricInput) * 100;
        productivityScore = getActivityProductivityScore(metricInput);
      }
    }
  }

  // 5. Write the minute log
  await prisma.deepWorkMinuteLog.create({
    data: {
      deepWorkId: sessionId,
      minuteIndex: nextMinuteIndex,
      timestamp: now,
      focusScore,
      productivityScore,
      distractionFlag,
      idleFlag,
      appName,
      windowTitle,
      category,
      intent
    }
  });

  // 6. Update session running aggregates (optional, for quick access)
  const totalMinutes = nextMinuteIndex + 1;
  const productiveMinutes = session.productiveMs / MINUTE_MS + (distractionFlag || idleFlag ? 0 : 1);
  
  await prisma.deepWorkSession.update({
    where: { id: sessionId },
    data: {
      focusScore: (session.focusScore * session.minuteLogs.length + focusScore) / totalMinutes,
      productivityScore: (session.productivityScore * session.minuteLogs.length + productivityScore) / totalMinutes
    }
  });

  console.log(`[MinuteLogger] Session ${sessionId} | Minute ${nextMinuteIndex} | Focus: ${focusScore.toFixed(1)} | Prod: ${productivityScore.toFixed(1)} | Idle: ${idleFlag} | Distraction: ${distractionFlag}`);
}

export async function logAllActiveSessions() {
  const activeSessions = await prisma.deepWorkSession.findMany({
    where: { status: "active" }
  });

  for (const session of activeSessions) {
    try {
      await logMinuteForSession(session.id);
    } catch (err) {
      console.error(`[MinuteLogger] Failed for session ${session.id}:`, err);
    }
  }
}

export function startMinuteLogger() {
  console.log("[MinuteLogger] Started — ticking every 60 seconds");
  
  // Run immediately on start
  logAllActiveSessions();

  // Then every minute
  setInterval(logAllActiveSessions, MINUTE_MS);
}