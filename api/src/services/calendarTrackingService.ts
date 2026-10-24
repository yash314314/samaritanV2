import type { Activity, CalendarEvent, CalendarSession } from "@prisma/client";
import { assertOwnedProject } from "./ownership";
import { prisma } from "../prisma";
import {
  classifyCalendarEvent,
  detectMeetingActivity,
  mergeIntervals,
  type CalendarClassifierSettings,
} from "./calendarClassifier";
import { emitCalendarSessionChanged } from "../websocket/broadcaster";
import { refreshRecurringCalendarEvents } from "./calendarRecurrenceService";
import { finalizeCalendarFocusSession, reconcileCalendarFocusSessions } from "./calendarFocusService";
import { calendarSessionDurationInRange, normalizeCalendarTimezone } from "./calendarTimeService";

const DEFAULT_SETTINGS: CalendarClassifierSettings & {
  offlineMeetingCreation: boolean;
  offlineMeetingMinutes: number;
  confirmationThresholdSeconds: number;
  timezone: string;
} = {
  meetingKeyword: "#rize-meeting",
  focusKeyword: "#rize-focus",
  breakKeyword: "#rize-break",
  attendeeThreshold: 2,
  offlineMeetingCreation: true,
  offlineMeetingMinutes: 10,
  confirmationThresholdSeconds: 60,
  timezone: "Asia/Kolkata",
};

export type CalendarWorkHourInput = {
  dayOfWeek: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

export const DEFAULT_CALENDAR_WORK_HOURS: CalendarWorkHourInput[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

let lifecycleRunning = false;
let lifecycleTimer: NodeJS.Timeout | null = null;

export async function getCalendarTrackingSettings(userId: string) {
  const [stored, storedWorkHours] = await Promise.all([
    prisma.calendarTrackingSettings.findUnique({ where: { userId } }),
    prisma.calendarWorkHour.findMany({ where: { userId }, orderBy: { dayOfWeek: "asc" } }),
  ]);
  const workHours = DEFAULT_CALENDAR_WORK_HOURS.map((fallback) => {
    const saved = storedWorkHours.find((item) => item.dayOfWeek === fallback.dayOfWeek);
    return saved
      ? { dayOfWeek: saved.dayOfWeek, enabled: saved.enabled, startMinute: saved.startMinute, endMinute: saved.endMinute }
      : fallback;
  });
  if (!stored) return { userId, ...DEFAULT_SETTINGS, workHours };
  try {
    return { ...stored, timezone: normalizeCalendarTimezone(stored.timezone), workHours };
  } catch {
    return { ...stored, timezone: DEFAULT_SETTINGS.timezone, workHours };
  }
}

export async function updateCalendarTrackingSettings(
  userId: string,
  input: Partial<typeof DEFAULT_SETTINGS> & { workHours?: CalendarWorkHourInput[] }
) {
  const current = await getCalendarTrackingSettings(userId);
  const data = {
    meetingKeyword: String(input.meetingKeyword ?? current.meetingKeyword).trim(),
    focusKeyword: String(input.focusKeyword ?? current.focusKeyword).trim(),
    breakKeyword: String(input.breakKeyword ?? current.breakKeyword).trim(),
    attendeeThreshold: Math.max(1, Math.min(50, Number(input.attendeeThreshold ?? current.attendeeThreshold))),
    offlineMeetingCreation: Boolean(input.offlineMeetingCreation ?? current.offlineMeetingCreation),
    offlineMeetingMinutes: Math.max(1, Math.min(120, Number(input.offlineMeetingMinutes ?? current.offlineMeetingMinutes))),
    confirmationThresholdSeconds: Math.max(10, Math.min(600, Number(input.confirmationThresholdSeconds ?? current.confirmationThresholdSeconds))),
    timezone: normalizeCalendarTimezone(input.timezone ?? current.timezone),
  };

  let normalizedWorkHours: CalendarWorkHourInput[] | undefined;
  if (input.workHours !== undefined) {
    if (!Array.isArray(input.workHours)) throw new Error("Work hours must be an array");
    const submitted = new Map(input.workHours.map((item) => [Number(item.dayOfWeek), item]));
    normalizedWorkHours = current.workHours.map((fallback) => {
      const item = submitted.get(fallback.dayOfWeek) ?? fallback;
      const startMinute = Math.round(Number(item.startMinute));
      const endMinute = Math.round(Number(item.endMinute));
      if (!Number.isFinite(startMinute) || startMinute < 0 || startMinute >= 1440) throw new Error("Invalid workday start time");
      if (!Number.isFinite(endMinute) || endMinute <= 0 || endMinute > 1440) throw new Error("Invalid workday end time");
      if (Boolean(item.enabled) && endMinute <= startMinute) throw new Error("Workday end must be after its start");
      return { dayOfWeek: fallback.dayOfWeek, enabled: Boolean(item.enabled), startMinute, endMinute };
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.calendarTrackingSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    for (const item of normalizedWorkHours ?? []) {
      await tx.calendarWorkHour.upsert({
        where: { userId_dayOfWeek: { userId, dayOfWeek: item.dayOfWeek } },
        update: item,
        create: { userId, ...item },
      });
    }
  });

  return getCalendarTrackingSettings(userId);
}

function sessionInclude() {
  return {
    calendarEvent: {
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        attendeeCount: true,
        attendeeStatus: true,
        eventType: true,
        color: true,
      },
    },
    project: { select: { id: true, name: true, color: true } },
    _count: { select: { evidence: true } },
  } as const;
}

async function emitSession(action: "started" | "updated" | "review-required" | "ended", sessionId: string) {
  const session = await prisma.calendarSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude(),
  });
  if (session) emitCalendarSessionChanged(session.userId, action, { session });
  return session;
}

export async function materializeCalendarEventSession(eventId: string, now = new Date()) {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event) return null;

  const settings = await getCalendarTrackingSettings(event.userId);
  const type = classifyCalendarEvent(event, settings);
  const existing = await prisma.calendarSession.findFirst({ where: { calendarEventId: event.id } });

  if (!type) {
    if (existing && ["scheduled", "detecting"].includes(existing.status)) {
      const rejected = await prisma.calendarSession.update({
        where: { id: existing.id },
        data: { status: "rejected", reviewReason: "Event no longer qualifies for automatic tracking" },
      });
      await emitSession("ended", rejected.id);
      return rejected;
    }
    return existing;
  }

  if (existing && existing.type !== type && ["scheduled", "detecting"].includes(existing.status)) {
    await prisma.calendarSession.update({
      where: { id: existing.id },
      data: { status: "rejected", reviewReason: `Event tracking type changed to ${type}` },
    });
    await emitSession("ended", existing.id);
  }

  const sameTypeSession = existing?.type === type ? existing : null;

  const status = now >= event.startAt && now < event.endAt ? "detecting" : "scheduled";
  const session = await prisma.calendarSession.upsert({
    where: { calendarEventId_type: { calendarEventId: event.id, type } },
    update: {
      title: event.title,
      scheduledStart: event.startAt,
      scheduledEnd: event.endAt,
      projectId: event.projectId,
      ...(sameTypeSession && ["scheduled", "detecting"].includes(sameTypeSession.status) ? { status } : {}),
    },
    create: {
      userId: event.userId,
      calendarEventId: event.id,
      type,
      source: event.source === "manual" ? "manual" : "calendar",
      status,
      title: event.title,
      scheduledStart: event.startAt,
      scheduledEnd: event.endAt,
      projectId: event.projectId,
    },
  });

  if (!sameTypeSession) await emitSession(status === "detecting" ? "started" : "updated", session.id);
  return session;
}

async function summarizeEvidence(sessionId: string) {
  const evidence = await prisma.meetingEvidence.findMany({
    where: { calendarSessionId: sessionId },
    orderBy: { startedAt: "asc" },
  });
  const intervals = mergeIntervals(evidence.map((item) => ({ start: item.startedAt, end: item.endedAt })), 5_000);
  return {
    actualStart: intervals[0]?.start ?? null,
    actualEnd: intervals[intervals.length - 1]?.end ?? null,
    actualDurationMs: intervals.reduce((sum, interval) => sum + interval.durationMs, 0),
    confidence: evidence.length > 0
      ? evidence.reduce((sum, item) => sum + item.confidence * item.durationMs, 0) /
        Math.max(1, evidence.reduce((sum, item) => sum + item.durationMs, 0))
      : 0,
  };
}

async function refreshMeetingSession(session: CalendarSession, final = false) {
  const settings = await getCalendarTrackingSettings(session.userId);
  const summary = await summarizeEvidence(session.id);
  const confirmed = summary.actualDurationMs >= settings.confirmationThresholdSeconds * 1000;
  const status = final
    ? confirmed ? "confirmed" : "tentative"
    : confirmed ? "confirmed" : "detecting";
  const reviewReason = final && !confirmed
    ? "No sustained meeting-app activity was observed during the scheduled window"
    : null;

  const updated = await prisma.calendarSession.update({
    where: { id: session.id },
    data: { ...summary, status, reviewReason },
  });
  await emitSession(final && !confirmed ? "review-required" : final ? "ended" : "updated", updated.id);
  return updated;
}

export async function processCalendarLifecycle(now = new Date()) {
  if (lifecycleRunning) return;
  lifecycleRunning = true;
  try {
    await refreshRecurringCalendarEvents(now);
    const eventFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const eventCeiling = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = await prisma.calendarEvent.findMany({
      where: {
        startAt: { lte: eventCeiling },
        endAt: { gte: eventFloor },
        status: { not: "cancelled" },
      },
      select: { id: true },
    });
    await Promise.all(events.map((event) => materializeCalendarEventSession(event.id, now)));

    const starting = await prisma.calendarSession.findMany({
      where: { status: "scheduled", scheduledStart: { lte: now }, scheduledEnd: { gt: now } },
    });
    for (const session of starting) {
      await prisma.calendarSession.update({ where: { id: session.id }, data: { status: "detecting" } });
      await emitSession("started", session.id);
    }
    await reconcileCalendarFocusSessions(now);

    const ending = await prisma.calendarSession.findMany({
      where: { status: { in: ["scheduled", "detecting"] }, scheduledEnd: { lte: now } },
    });
    for (const session of ending) {
      if (session.type === "focus") {
        await finalizeCalendarFocusSession(session.id, now);
      } else if (session.type === "meeting") {
        await refreshMeetingSession(session, true);
      } else {
        await prisma.calendarSession.update({
          where: { id: session.id },
          data: {
            status: "confirmed",
            actualStart: session.scheduledStart,
            actualEnd: session.scheduledEnd,
            actualDurationMs: session.scheduledStart && session.scheduledEnd
              ? Math.max(0, session.scheduledEnd.getTime() - session.scheduledStart.getTime())
              : 0,
            confidence: 1,
          },
        });
        await emitSession("ended", session.id);
      }
    }
  } finally {
    lifecycleRunning = false;
  }
}

function clipActivityToSession(activity: Activity, session: CalendarSession) {
  const start = new Date(Math.max(activity.startTime.getTime(), session.scheduledStart?.getTime() ?? activity.startTime.getTime()));
  const end = new Date(Math.min(activity.endTime.getTime(), session.scheduledEnd?.getTime() ?? activity.endTime.getTime()));
  return { start, end, durationMs: Math.max(0, end.getTime() - start.getTime()) };
}

async function attachEvidence(session: CalendarSession, activity: Activity, signal: NonNullable<ReturnType<typeof detectMeetingActivity>>) {
  const clipped = clipActivityToSession(activity, session);
  if (clipped.durationMs <= 0) return;
  await prisma.meetingEvidence.upsert({
    where: { calendarSessionId_activityId: { calendarSessionId: session.id, activityId: activity.id } },
    update: {
      startedAt: clipped.start,
      endedAt: clipped.end,
      durationMs: clipped.durationMs,
      signalType: signal.signalType,
      confidence: signal.confidence,
    },
    create: {
      calendarSessionId: session.id,
      activityId: activity.id,
      startedAt: clipped.start,
      endedAt: clipped.end,
      durationMs: clipped.durationMs,
      signalType: signal.signalType,
      confidence: signal.confidence,
    },
  });
}

async function reconcileAdHocMeeting(userId: string, activity: Activity, signal: NonNullable<ReturnType<typeof detectMeetingActivity>>) {
  const settings = await getCalendarTrackingSettings(userId);
  if (!settings.offlineMeetingCreation) return null;

  const lookback = new Date(activity.endTime.getTime() - Math.max(30, settings.offlineMeetingMinutes * 2) * 60_000);
  const candidates = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { lte: activity.endTime },
      endTime: { gte: lookback },
    },
    orderBy: { startTime: "asc" },
  });
  const meetingCandidates = candidates.filter((candidate) => detectMeetingActivity(candidate));
  const intervals = mergeIntervals(
    meetingCandidates.map((candidate) => ({ start: candidate.startTime, end: candidate.endTime })),
    60_000
  );
  const segment = intervals.find(
    (interval) => interval.start <= activity.endTime && interval.end >= activity.startTime
  );
  if (!segment || segment.durationMs < settings.offlineMeetingMinutes * 60_000) return null;

  let session = await prisma.calendarSession.findFirst({
    where: {
      userId,
      source: "activity",
      type: "meeting",
      actualStart: { lte: segment.end },
      actualEnd: { gte: segment.start },
    },
  });
  if (!session) {
    session = await prisma.calendarSession.create({
      data: {
        userId,
        type: "meeting",
        source: "activity",
        status: "confirmed",
        title: `Ad-hoc meeting · ${signal.label}`,
        actualStart: segment.start,
        actualEnd: segment.end,
        actualDurationMs: segment.durationMs,
        confidence: signal.confidence,
      },
    });
    await emitSession("started", session.id);
  }

  for (const candidate of meetingCandidates) {
    if (candidate.endTime < segment.start || candidate.startTime > segment.end) continue;
    const candidateSignal = detectMeetingActivity(candidate);
    if (candidateSignal) await attachEvidence(session, candidate, candidateSignal);
  }
  const summary = await summarizeEvidence(session.id);
  await prisma.calendarSession.update({ where: { id: session.id }, data: { ...summary, status: "confirmed" } });
  await emitSession("updated", session.id);
  return session;
}

export async function reconcileCalendarActivity(userId: string, activity: Activity) {
  const signal = detectMeetingActivity(activity);
  if (!signal) {
    const confirmedMeeting = await prisma.calendarSession.findFirst({
      where: {
        userId,
        type: "meeting",
        source: { not: "activity" },
        status: "confirmed",
        actualStart: { not: null },
        scheduledStart: { lte: activity.endTime },
        scheduledEnd: { gte: activity.startTime },
      },
      orderBy: { scheduledStart: "asc" },
    });
    if (!confirmedMeeting?.actualStart) return null;

    const actualEnd = new Date(Math.min(
      activity.endTime.getTime(),
      confirmedMeeting.scheduledEnd?.getTime() ?? activity.endTime.getTime()
    ));
    if (actualEnd <= confirmedMeeting.actualStart) return confirmedMeeting;

    const updated = await prisma.calendarSession.update({
      where: { id: confirmedMeeting.id },
      data: {
        actualEnd,
        actualDurationMs: actualEnd.getTime() - confirmedMeeting.actualStart.getTime(),
      },
    });
    await emitSession("updated", updated.id);
    return updated;
  }

  const scheduled = await prisma.calendarSession.findFirst({
    where: {
      userId,
      type: "meeting",
      status: { in: ["scheduled", "detecting", "confirmed"] },
      scheduledStart: { lte: activity.endTime },
      scheduledEnd: { gte: activity.startTime },
    },
    orderBy: { scheduledStart: "asc" },
  });

  if (!scheduled) return reconcileAdHocMeeting(userId, activity, signal);
  await attachEvidence(scheduled, activity, signal);
  return refreshMeetingSession(scheduled, false);
}

export async function listCalendarSessions(userId: string, from?: Date, to?: Date, status?: string) {
  return prisma.calendarSession.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            OR: [
              {
                scheduledStart: { ...(to ? { lte: to } : {}) },
                scheduledEnd: { ...(from ? { gt: from } : {}) },
              },
              {
                actualStart: { ...(to ? { lte: to } : {}) },
                actualEnd: { ...(from ? { gt: from } : {}) },
              },
              {
                actualStart: to ? { lte: to } : { not: null },
                actualEnd: null,
              },
            ],
          }
        : {}),
    },
    include: sessionInclude(),
    orderBy: [{ scheduledStart: "asc" }, { actualStart: "asc" }],
  });
}

export async function reviewCalendarSession(userId: string, sessionId: string, action: "confirm" | "reject" | "missed") {
  const existing = await prisma.calendarSession.findFirst({ where: { id: sessionId, userId } });
  if (!existing) throw new Error("Calendar session not found");

  const status = action === "confirm" ? "confirmed" : action;
  await prisma.calendarSession.update({
    where: { id: sessionId },
    data: {
      status,
      reviewedAt: new Date(),
      reviewReason: action === "confirm" ? null : existing.reviewReason,
      ...(action === "confirm" && existing.actualDurationMs === 0
        ? {
            actualStart: existing.scheduledStart,
            actualEnd: existing.scheduledEnd,
            actualDurationMs: existing.scheduledStart && existing.scheduledEnd
              ? Math.max(0, existing.scheduledEnd.getTime() - existing.scheduledStart.getTime())
              : 0,
            confidence: 0.5,
          }
        : {}),
    },
  });
  return emitSession("updated", sessionId);
}

export async function reviewCalendarSessions(
  userId: string,
  sessionIds: string[],
  action: "confirm" | "reject" | "missed"
) {
  const requestedIds = [...new Set(sessionIds)].slice(0, 500);
  if (!requestedIds.length) return { requested: 0, reviewed: 0, skipped: 0, sessions: [] };

  const reviewedIds = await prisma.$transaction(async (tx) => {
    const candidates = await tx.calendarSession.findMany({
      where: { id: { in: requestedIds }, userId, status: "tentative" },
      orderBy: [{ scheduledStart: "asc" }, { actualStart: "asc" }],
    });
    const status = action === "confirm" ? "confirmed" : action;

    for (const session of candidates) {
      await tx.calendarSession.update({
        where: { id: session.id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewReason: action === "confirm" ? null : session.reviewReason,
          ...(action === "confirm" && session.actualDurationMs === 0
            ? {
                actualStart: session.scheduledStart,
                actualEnd: session.scheduledEnd,
                actualDurationMs: session.scheduledStart && session.scheduledEnd
                  ? Math.max(0, session.scheduledEnd.getTime() - session.scheduledStart.getTime())
                  : 0,
                confidence: 0.5,
              }
            : {}),
        },
      });
    }
    return candidates.map((session) => session.id);
  });

  const sessions = (await Promise.all(reviewedIds.map((id) => emitSession("updated", id)))).filter(Boolean);
  return {
    requested: requestedIds.length,
    reviewed: sessions.length,
    skipped: requestedIds.length - sessions.length,
    sessions,
  };
}

const EDITABLE_SESSION_STATUSES = new Set(["confirmed", "tentative", "missed", "rejected"]);

export async function updateCalendarSession(
  userId: string,
  sessionId: string,
  input: {
    title?: string;
    type?: string;
    status?: string;
    actualStart?: Date | null;
    actualEnd?: Date | null;
    projectId?: string | null;
  }
) {
  const existing = await prisma.calendarSession.findFirst({ where: { id: sessionId, userId } });
  if (!existing) throw new Error("Calendar session not found");
  if (existing.status === "active") throw new Error("End an active session before correcting it");
  if (input.projectId) await assertOwnedProject(userId, input.projectId);

  const type = input.type ?? existing.type;
  validateManualSessionType(type);
  const status = input.status ?? existing.status;
  if (!EDITABLE_SESSION_STATUSES.has(status)) {
    throw new Error("Session status must be confirmed, tentative, missed, or rejected");
  }

  const actualStart = input.actualStart === undefined ? existing.actualStart : input.actualStart;
  const actualEnd = input.actualEnd === undefined ? existing.actualEnd : input.actualEnd;
  if ((actualStart && Number.isNaN(actualStart.getTime())) || (actualEnd && Number.isNaN(actualEnd.getTime()))) {
    throw new Error("Provide valid actual start and end times");
  }
  if ((actualStart && !actualEnd) || (!actualStart && actualEnd)) {
    throw new Error("Actual start and end must be provided together");
  }
  if (actualStart && actualEnd && actualEnd <= actualStart) {
    throw new Error("Actual end must be after actual start");
  }
  if (actualStart && actualEnd && actualEnd.getTime() - actualStart.getTime() > 24 * 60 * 60_000) {
    throw new Error("A calendar session cannot exceed 24 hours");
  }
  if (status === "confirmed" && (!actualStart || !actualEnd)) {
    throw new Error("Confirmed sessions require actual start and end times");
  }

  await prisma.calendarSession.update({
    where: { id: sessionId },
    data: {
      title: input.title === undefined ? existing.title : input.title.trim() || existing.title,
      type,
      status,
      actualStart,
      actualEnd,
      actualDurationMs: actualStart && actualEnd ? actualEnd.getTime() - actualStart.getTime() : 0,
      projectId: input.projectId === undefined ? existing.projectId : input.projectId || null,
      confidence: 1,
      reviewedAt: new Date(),
      reviewReason: status === "confirmed" ? null : existing.reviewReason,
    },
  });
  return emitSession("updated", sessionId);
}

const MANUAL_SESSION_TYPES = new Set(["meeting", "focus", "break"]);

function validateManualSessionType(type: string) {
  if (!MANUAL_SESSION_TYPES.has(type)) {
    throw new Error("Session type must be meeting, focus, or break");
  }
}

export async function startManualCalendarSession(
  userId: string,
  input: { type: string; title?: string; projectId?: string | null }
) {
  validateManualSessionType(input.type);
  await assertOwnedProject(userId, input.projectId);
  const active = await prisma.calendarSession.findFirst({
    where: { userId, source: "manual", status: "active", actualEnd: null },
  });
  if (active) throw new Error("Finish the active manual session before starting another");

  const session = await prisma.calendarSession.create({
    data: {
      userId,
      type: input.type,
      source: "manual",
      status: "active",
      title: input.title?.trim() || `Manual ${input.type}`,
      actualStart: new Date(),
      confidence: 1,
      projectId: input.projectId || null,
    },
  });
  return emitSession("started", session.id);
}

export async function logManualCalendarSession(
  userId: string,
  input: { type: string; title?: string; startAt: Date; endAt: Date; projectId?: string | null }
) {
  validateManualSessionType(input.type);
  await assertOwnedProject(userId, input.projectId);
  if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    throw new Error("Provide valid start and end times");
  }
  if (input.endAt <= input.startAt) throw new Error("Session end must be after its start");
  if (input.endAt.getTime() - input.startAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error("A manual session cannot exceed 24 hours");
  }

  const session = await prisma.calendarSession.create({
    data: {
      userId,
      type: input.type,
      source: "manual",
      status: "confirmed",
      title: input.title?.trim() || `Manual ${input.type}`,
      actualStart: input.startAt,
      actualEnd: input.endAt,
      actualDurationMs: input.endAt.getTime() - input.startAt.getTime(),
      confidence: 1,
      projectId: input.projectId || null,
      reviewedAt: new Date(),
    },
  });
  return emitSession("ended", session.id);
}

export async function endManualCalendarSession(userId: string, sessionId: string, endedAt = new Date()) {
  const session = await prisma.calendarSession.findFirst({
    where: { id: sessionId, userId, source: "manual", status: "active", actualEnd: null },
  });
  if (!session?.actualStart) throw new Error("Active manual session not found");
  if (endedAt <= session.actualStart) throw new Error("Session end must be after its start");

  await prisma.calendarSession.update({
    where: { id: session.id },
    data: {
      status: "confirmed",
      actualEnd: endedAt,
      actualDurationMs: endedAt.getTime() - session.actualStart.getTime(),
      reviewedAt: endedAt,
    },
  });
  return emitSession("ended", session.id);
}

export async function deleteManualCalendarSession(userId: string, sessionId: string) {
  const session = await prisma.calendarSession.findFirst({
    where: { id: sessionId, userId, source: "manual" },
  });
  if (!session) throw new Error("Manual session not found");
  await prisma.calendarSession.delete({ where: { id: session.id } });
  emitCalendarSessionChanged(userId, "ended", { session: { ...session, status: "rejected", deleted: true } });
}

export async function getCalendarSessionSummary(userId: string, from: Date, to: Date, now = new Date()) {
  const sessions = await listCalendarSessions(userId, from, to);
  const included = sessions.filter((session) => !["rejected", "missed"].includes(session.status));
  const durationFor = (session: typeof included[number]) => calendarSessionDurationInRange(session, from, to, now);
  const byType = (type: string) => included.filter((session) => session.type === type);
  const meetings = byType("meeting");
  const meetingWindows = meetings
    .map((session) => ({
      start: session.actualStart ?? session.scheduledStart,
      end: session.actualEnd ?? session.scheduledEnd,
    }))
    .filter((window): window is { start: Date; end: Date } => Boolean(window.start && window.end))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const backToBackCount = meetingWindows.slice(1).filter((window, index) => {
    const gap = window.start.getTime() - meetingWindows[index].end.getTime();
    return gap >= 0 && gap <= 15 * 60_000;
  }).length;
  const meetingMs = meetings.reduce((sum, session) => sum + durationFor(session), 0);
  const focusMs = byType("focus").reduce((sum, session) => sum + durationFor(session), 0);
  const breakMs = byType("break").reduce((sum, session) => sum + durationFor(session), 0);
  const classifiedMs = meetingMs + focusMs + breakMs;

  return {
    meetingMs,
    meetingCount: meetings.length,
    focusMs,
    breakMs,
    meetingLoadPercent: classifiedMs > 0 ? Math.round((meetingMs / classifiedMs) * 100) : 0,
    backToBackCount,
    tentativeCount: sessions.filter((session) => session.status === "tentative").length,
    activeSession: sessions.find((session) => session.status === "active") ?? null,
  };
}

function overlapMs(start: Date, end: Date, windowStart: Date, windowEnd: Date) {
  return Math.max(0, Math.min(end.getTime(), windowEnd.getTime()) - Math.max(start.getTime(), windowStart.getTime()));
}

function weightedActivityFocus(activities: Activity[], from: Date, to: Date) {
  let weighted = 0;
  let duration = 0;
  for (const activity of activities) {
    const overlap = overlapMs(activity.startTime, activity.endTime, from, to);
    if (overlap <= 0 || activity.focusImpact == null) continue;
    weighted += Math.max(0, Math.min(1, activity.focusImpact)) * overlap;
    duration += overlap;
  }
  return duration > 0 ? Math.round((weighted / duration) * 100) : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

export async function getCalendarMeetingInsights(userId: string, from: Date, to: Date, now = new Date()) {
  const [settings, sessions, activities] = await Promise.all([
    getCalendarTrackingSettings(userId),
    prisma.calendarSession.findMany({
      where: {
        userId,
        type: "meeting",
        status: { notIn: ["rejected"] },
        OR: [
          { scheduledStart: { lte: to }, scheduledEnd: { gte: from } },
          { actualStart: { lte: to }, actualEnd: { gte: from } },
          { actualStart: { lte: to }, actualEnd: null },
        ],
      },
      include: { project: { select: { id: true, name: true, color: true } } },
      orderBy: [{ actualStart: "asc" }, { scheduledStart: "asc" }],
    }),
    prisma.activity.findMany({
      where: {
        session: { userId },
        startTime: { lte: new Date(to.getTime() + 60 * 60_000) },
        endTime: { gte: new Date(from.getTime() - 60 * 60_000) },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const keyFor = (date: Date) => dateFormatter.format(date);
  const dayMap = new Map<string, { date: string; meetingMs: number; meetingCount: number; focusScore: number | null }>();
  const projectMap = new Map<string, { id: string | null; name: string; color: string; durationMs: number; meetingCount: number }>();
  const recoverySamples: number[] = [];
  const focusDeltas: number[] = [];
  let scheduledMs = 0;
  let actualMs = 0;
  let confirmedCount = 0;
  let overrunMs = 0;

  for (const session of sessions) {
    const scheduledDuration = session.scheduledStart && session.scheduledEnd
      ? Math.max(0, session.scheduledEnd.getTime() - session.scheduledStart.getTime())
      : 0;
    scheduledMs += scheduledDuration;

    const actualStart = session.actualStart;
    const actualEnd = session.actualEnd ?? (session.status === "active" && actualStart ? now : null);
    const duration = session.actualDurationMs > 0
      ? session.actualDurationMs
      : actualStart && actualEnd ? Math.max(0, actualEnd.getTime() - actualStart.getTime()) : 0;
    actualMs += duration;
    if (["confirmed", "active"].includes(session.status)) confirmedCount += 1;
    if (session.actualEnd && session.scheduledEnd) {
      overrunMs += Math.max(0, session.actualEnd.getTime() - session.scheduledEnd.getTime());
    }

    const anchor = actualStart ?? session.scheduledStart;
    if (anchor) {
      const key = keyFor(anchor);
      const day = dayMap.get(key) ?? { date: key, meetingMs: 0, meetingCount: 0, focusScore: null };
      day.meetingMs += duration;
      day.meetingCount += 1;
      dayMap.set(key, day);
    }

    const projectKey = session.project?.id ?? "unassigned";
    const project = projectMap.get(projectKey) ?? {
      id: session.project?.id ?? null,
      name: session.project?.name ?? "Unassigned",
      color: session.project?.color ?? "#71717a",
      durationMs: 0,
      meetingCount: 0,
    };
    project.durationMs += duration;
    project.meetingCount += 1;
    projectMap.set(projectKey, project);

    if (!actualStart || !session.actualEnd || session.status !== "confirmed") continue;
    const beforeStart = new Date(actualStart.getTime() - 60 * 60_000);
    const afterEnd = new Date(session.actualEnd.getTime() + 60 * 60_000);
    const beforeFocus = weightedActivityFocus(activities, beforeStart, actualStart);
    const afterFocus = weightedActivityFocus(activities, session.actualEnd, afterEnd);
    if (beforeFocus != null && afterFocus != null) focusDeltas.push(afterFocus - beforeFocus);

    const productive = activities.find((activity) =>
      activity.endTime > session.actualEnd! &&
      activity.startTime < afterEnd &&
      (activity.category === "productive" || Number(activity.focusImpact ?? 0) >= 0.65)
    );
    if (productive) {
      recoverySamples.push(Math.max(0, productive.startTime.getTime() - session.actualEnd.getTime()));
    }
  }

  for (const activity of activities) {
    if (activity.startTime < from || activity.startTime > to) continue;
    const key = keyFor(activity.startTime);
    const day = dayMap.get(key) ?? { date: key, meetingMs: 0, meetingCount: 0, focusScore: null };
    dayMap.set(key, day);
  }
  for (const day of dayMap.values()) {
    const dayActivities = activities.filter((activity) => keyFor(activity.startTime) === day.date);
    day.focusScore = weightedActivityFocus(
      dayActivities,
      new Date(from.getTime() - 24 * 60 * 60_000),
      new Date(to.getTime() + 24 * 60 * 60_000)
    );
  }

  const focusDelta = focusDeltas.length > 0
    ? Math.round(focusDeltas.reduce((sum, value) => sum + value, 0) / focusDeltas.length)
    : null;
  const medianRecoveryMs = median(recoverySamples);

  return {
    scheduledMs,
    actualMs,
    varianceMs: actualMs - scheduledMs,
    overrunMs,
    meetingCount: sessions.length,
    confirmedCount,
    tentativeCount: sessions.filter((session) => session.status === "tentative").length,
    missedCount: sessions.filter((session) => session.status === "missed").length,
    attendanceRate: sessions.some((session) => ["confirmed", "tentative", "missed"].includes(session.status))
      ? Math.round((sessions.filter((session) => session.status === "confirmed").length /
        Math.max(1, sessions.filter((session) => ["confirmed", "tentative", "missed"].includes(session.status)).length)) * 100)
      : null,
    medianRecoveryMs,
    recoverySampleCount: recoverySamples.length,
    focusDelta,
    focusSampleCount: focusDeltas.length,
    daily: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    projects: [...projectMap.values()].sort((a, b) => b.durationMs - a.durationMs),
  };
}

export function startCalendarTrackingLifecycle() {
  if (lifecycleTimer) return;
  processCalendarLifecycle().catch((error) => console.error("[CalendarTracking] Initial lifecycle failed", error));
  lifecycleTimer = setInterval(() => {
    processCalendarLifecycle().catch((error) => console.error("[CalendarTracking] Lifecycle failed", error));
  }, 15_000);
  console.log("[CalendarTracking] Lifecycle scheduled every 15 seconds");
}
