import { prisma } from "../prisma";

const GRACE_PERIOD_MINUTES = 5;
const MINUTE_MS = 60 * 1000;

export async function expireOldSessions() {
  const now = new Date();

  // Find active sessions that exceeded planned time + grace period
  const expiredSessions = await prisma.deepWorkSession.findMany({
    where: {
      status: "active",
      startedAt: {
        lte: new Date(now.getTime() - (GRACE_PERIOD_MINUTES * MINUTE_MS))
      }
    }
  });

  for (const session of expiredSessions) {
    const elapsedMinutes = Math.floor(
      (now.getTime() - session.startedAt.getTime()) / MINUTE_MS
    );

    // Only expire if actually past planned time + grace
    if (elapsedMinutes <= session.plannedMinutes + GRACE_PERIOD_MINUTES) {
      continue;
    }

    // Write final minute log marking expiration
    const lastLog = await prisma.deepWorkMinuteLog.findFirst({
      where: { deepWorkId: session.id },
      orderBy: { minuteIndex: "desc" }
    });

    const nextMinuteIndex = lastLog ? lastLog.minuteIndex + 1 : 0;

    await prisma.deepWorkMinuteLog.create({
      data: {
        deepWorkId: session.id,
        minuteIndex: nextMinuteIndex,
        timestamp: now,
        focusScore: 0,
        productivityScore: 0,
        distractionFlag: false,
        idleFlag: true,
        appName: "System",
        windowTitle: "Session expired — exceeded planned duration",
        category: "system",
        intent: "session_expired"
      }
    });

    // Mark session as expired
    await prisma.deepWorkSession.update({
      where: { id: session.id },
      data: {
        status: "expired",
        endedAt: now
      }
    });

    console.log(`[SessionExpiry] Session ${session.id} expired after ${elapsedMinutes} minutes (planned: ${session.plannedMinutes})`);
  }

  return expiredSessions.length;
}

export function startSessionExpiryChecker() {
  console.log("[SessionExpiry] Started — checking every 60 seconds");

  // Run immediately
  expireOldSessions();

  // Then every minute
  setInterval(expireOldSessions, MINUTE_MS);
}