import { prisma } from "../prisma";
import { emitCalendarFocusChanged, emitCalendarSessionChanged } from "../websocket/broadcaster";
import { endDeepWorkSession, getActiveDeepWorkSession, startDeepWorkSession } from "./deepWorkService";

const ENFORCEMENT_LEVELS = new Set(["observe", "warn", "require_reason", "block"]);

function calendarSessionInclude() {
  return {
    calendarEvent: {
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
        color: true,
        deepWorkId: true,
        focusAutoStart: true,
        focusEnforcement: true,
        focusAllowedApps: true,
        focusAllowedDomains: true,
        focusBlockedApps: true,
        focusBlockedDomains: true,
      },
    },
    project: { select: { id: true, name: true, color: true } },
    _count: { select: { evidence: true } },
  } as const;
}

async function emitSessionUpdate(sessionId: string, action: "updated" | "ended") {
  const session = await prisma.calendarSession.findUnique({
    where: { id: sessionId },
    include: calendarSessionInclude(),
  });
  if (session) emitCalendarSessionChanged(session.userId, action, { session });
  return session;
}

export async function activateCalendarFocusSession(sessionId: string, now = new Date()) {
  const session = await prisma.calendarSession.findUnique({
    where: { id: sessionId },
    include: { calendarEvent: true },
  });
  const event = session?.calendarEvent;
  if (!session || session.type !== "focus" || !event?.focusAutoStart || !session.scheduledEnd) return null;
  if (session.scheduledEnd <= now || ["confirmed", "missed", "rejected"].includes(session.status)) return null;

  if (event.deepWorkId) {
    const linked = await prisma.deepWorkSession.findUnique({ where: { id: event.deepWorkId } });
    if (!linked) {
      await prisma.calendarEvent.update({ where: { id: event.id }, data: { deepWorkId: null } });
    } else if (linked.status === "active") {
      if (session.status !== "active" || !session.actualStart) {
        await prisma.calendarSession.update({
          where: { id: session.id },
          data: { status: "active", actualStart: linked.startedAt, reviewReason: null },
        });
        await emitSessionUpdate(session.id, "updated");
      }
      return linked;
    } else {
      return finalizeCalendarFocusSession(session.id, linked.endedAt ?? now);
    }
  }

  const active = await getActiveDeepWorkSession(session.userId);
  if (active) {
    const reason = `Auto-start skipped while Deep Work session "${active.goal || "Untitled focus"}" is active`;
    if (session.reviewReason !== reason) {
      await prisma.calendarSession.update({ where: { id: session.id }, data: { reviewReason: reason } });
      await emitSessionUpdate(session.id, "updated");
      emitCalendarFocusChanged(session.userId, "skipped", { calendarEventId: event.id, calendarSessionId: session.id, reason, activeDeepWorkId: active.id });
    }
    return null;
  }

  const plannedMinutes = Math.max(1, Math.ceil((session.scheduledEnd.getTime() - now.getTime()) / 60_000));
  const deepWork = await startDeepWorkSession({
    userId: session.userId,
    projectId: session.projectId,
    goal: event.title,
    plannedMinutes,
    enforcement: ENFORCEMENT_LEVELS.has(event.focusEnforcement) ? event.focusEnforcement : "warn",
    allowedApps: event.focusAllowedApps,
    allowedDomains: event.focusAllowedDomains,
    blockedApps: event.focusBlockedApps,
    blockedDomains: event.focusBlockedDomains,
  });

  await prisma.$transaction([
    prisma.calendarEvent.update({ where: { id: event.id }, data: { deepWorkId: deepWork.id } }),
    prisma.calendarSession.update({
      where: { id: session.id },
      data: { status: "active", actualStart: deepWork.startedAt, actualEnd: null, actualDurationMs: 0, confidence: 1, reviewReason: null },
    }),
  ]);
  const updated = await emitSessionUpdate(session.id, "updated");
  emitCalendarFocusChanged(session.userId, "activated", { calendarEventId: event.id, calendarSessionId: session.id, deepWork, session: updated });
  return deepWork;
}

export async function finalizeCalendarFocusSession(sessionId: string, endedAt = new Date()) {
  const session = await prisma.calendarSession.findUnique({
    where: { id: sessionId },
    include: { calendarEvent: true },
  });
  if (!session || session.type !== "focus" || session.status === "confirmed") return session;

  let deepWork = session.calendarEvent?.deepWorkId
    ? await prisma.deepWorkSession.findUnique({ where: { id: session.calendarEvent.deepWorkId } })
    : null;
  if (deepWork?.status === "active") {
    try {
      deepWork = await endDeepWorkSession(session.userId, deepWork.id, "completed");
    } catch (error) {
      console.warn(`[CalendarFocus] Deep Work ${deepWork.id} could not be ended`, error);
      deepWork = await prisma.deepWorkSession.findUnique({ where: { id: deepWork.id } });
    }
  }

  const actualStart = session.actualStart ?? deepWork?.startedAt ?? session.scheduledStart;
  const actualEnd = deepWork?.endedAt ?? endedAt;
  const normalizedEnd = actualStart && actualEnd > actualStart ? actualEnd : actualStart;
  await prisma.calendarSession.update({
    where: { id: session.id },
    data: {
      status: "confirmed",
      actualStart,
      actualEnd: normalizedEnd,
      actualDurationMs: actualStart && normalizedEnd ? normalizedEnd.getTime() - actualStart.getTime() : 0,
      confidence: 1,
      reviewReason: null,
      reviewedAt: new Date(),
    },
  });
  const updated = await emitSessionUpdate(session.id, "ended");
  emitCalendarFocusChanged(session.userId, "completed", {
    calendarEventId: session.calendarEventId,
    calendarSessionId: session.id,
    deepWorkId: deepWork?.id ?? null,
    session: updated,
  });
  return updated;
}

export async function reconcileCalendarFocusSessions(now = new Date()) {
  const candidates = await prisma.calendarSession.findMany({
    where: {
      type: "focus",
      status: { in: ["detecting", "active"] },
      scheduledStart: { lte: now },
    },
    include: { calendarEvent: true },
  });

  for (const session of candidates) {
    if (!session.calendarEvent?.focusAutoStart) continue;
    if (session.status === "detecting" && session.scheduledEnd && session.scheduledEnd > now) {
      await activateCalendarFocusSession(session.id, now);
      continue;
    }
    if (session.status !== "active") continue;
    const linked = session.calendarEvent.deepWorkId
      ? await prisma.deepWorkSession.findUnique({ where: { id: session.calendarEvent.deepWorkId } })
      : null;
    if ((session.scheduledEnd && session.scheduledEnd <= now) || !linked || linked.status !== "active" || session.calendarEvent.status === "cancelled") {
      await finalizeCalendarFocusSession(session.id, linked?.endedAt ?? now);
    }
  }
}

export async function stopCalendarFocusForEvent(eventId: string, now = new Date()) {
  const sessions = await prisma.calendarSession.findMany({
    where: {
      type: "focus",
      status: "active",
      calendarEvent: {
        OR: [{ id: eventId }, { recurrenceParentId: eventId }],
      },
    },
    select: { id: true },
  });
  for (const session of sessions) await finalizeCalendarFocusSession(session.id, now);
  return sessions.length;
}
