import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { CalendarEvent } from "@prisma/client";
import { prisma } from "../prisma";
import { getCalendarTrackingSettings } from "./calendarTrackingService";

dayjs.extend(utc);
dayjs.extend(timezone);

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 18;
const FOCUS_WINDOW_MINUTES = 60;
const RECOVERY_BUFFER_MINUTES = 30;
const CHAIN_GAP_MINUTES = 15;
const MINUTE_MS = 60_000;

type BusyWindow = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string | null;
  eventType: string;
};

export type CalendarIntelligence = {
  timezone: string;
  workday: { startHour: number; endHour: number };
  summary: {
    pressureScore: number;
    pressureLevel: "low" | "balanced" | "high" | "critical";
    conflictCount: number;
    compressedGapCount: number;
    overloadedDayCount: number;
    focusWindowCount: number;
    availableFocusMs: number;
  };
  days: Array<{
    date: string;
    eventCount: number;
    busyMs: number;
    meetingLoadPercent: number;
    conflictCount: number;
    compressedGapCount: number;
    longestFocusMs: number;
    pressureScore: number;
  }>;
  conflicts: Array<{
    date: string;
    overlapMs: number;
    first: BusyWindow;
    second: BusyWindow;
  }>;
  focusWindows: Array<{
    date: string;
    startAt: Date;
    endAt: Date;
    durationMs: number;
    quality: "prime" | "good" | "available";
    reason: string;
  }>;
  recommendations: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    date?: string;
  }>;
};

function clipWindow(event: CalendarEvent, start: Date, end: Date): BusyWindow | null {
  const clippedStart = new Date(Math.max(start.getTime(), event.startAt.getTime()));
  const clippedEnd = new Date(Math.min(end.getTime(), event.endAt.getTime()));
  if (clippedEnd <= clippedStart) return null;
  return {
    id: event.id,
    title: event.title,
    start: clippedStart,
    end: clippedEnd,
    color: event.color,
    eventType: event.eventType,
  };
}

function mergeWindows(windows: BusyWindow[]) {
  const merged: Array<{ start: Date; end: Date }> = [];
  for (const window of windows) {
    const previous = merged[merged.length - 1];
    if (!previous || window.start > previous.end) {
      merged.push({ start: window.start, end: window.end });
    } else if (window.end > previous.end) {
      previous.end = window.end;
    }
  }
  return merged;
}

function pressureLevel(score: number): CalendarIntelligence["summary"]["pressureLevel"] {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "balanced";
  return "low";
}

export async function getCalendarIntelligence(userId: string, from: Date, to: Date, now = new Date()): Promise<CalendarIntelligence> {
  const settings = await getCalendarTrackingSettings(userId);
  const zone = settings.timezone || "Asia/Kolkata";
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      status: { not: "cancelled" },
      busy: true,
      allDay: false,
      startAt: { lte: to },
      endAt: { gte: from },
    },
    orderBy: [{ startAt: "asc" }, { endAt: "asc" }],
  });

  const firstDay = dayjs(from).tz(zone).startOf("day");
  const lastDay = dayjs(to).tz(zone).startOf("day");
  const days: CalendarIntelligence["days"] = [];
  const conflicts: CalendarIntelligence["conflicts"] = [];
  const focusWindows: CalendarIntelligence["focusWindows"] = [];
  const recommendations: CalendarIntelligence["recommendations"] = [];
  let cursor = firstDay;

  while (cursor.valueOf() <= lastDay.valueOf()) {
    if (cursor.day() === 0 || cursor.day() === 6) {
      cursor = cursor.add(1, "day");
      continue;
    }
    const date = cursor.format("YYYY-MM-DD");
    const workdayStart = cursor.hour(WORKDAY_START_HOUR).minute(0).second(0).millisecond(0).toDate();
    const workdayEnd = cursor.hour(WORKDAY_END_HOUR).minute(0).second(0).millisecond(0).toDate();
    const windows = events
      .map((event) => clipWindow(event, workdayStart, workdayEnd))
      .filter((window): window is BusyWindow => Boolean(window))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let dayConflictCount = 0;
    for (let index = 0; index < windows.length; index += 1) {
      for (let comparison = index + 1; comparison < windows.length; comparison += 1) {
        if (windows[comparison].start >= windows[index].end) break;
        const overlapMs = Math.min(windows[index].end.getTime(), windows[comparison].end.getTime()) - windows[comparison].start.getTime();
        if (overlapMs <= 0) continue;
        dayConflictCount += 1;
        conflicts.push({ date, overlapMs, first: windows[index], second: windows[comparison] });
      }
    }

    let compressedGapCount = 0;
    for (let index = 1; index < windows.length; index += 1) {
      const gapMinutes = (windows[index].start.getTime() - windows[index - 1].end.getTime()) / MINUTE_MS;
      if (gapMinutes >= 0 && gapMinutes < RECOVERY_BUFFER_MINUTES) compressedGapCount += 1;
    }

    const merged = mergeWindows(windows);
    const busyMs = merged.reduce((sum, window) => sum + window.end.getTime() - window.start.getTime(), 0);
    let focusCursor = workdayStart;
    const dayFocusWindows: CalendarIntelligence["focusWindows"] = [];
    for (const window of [...merged, { start: workdayEnd, end: workdayEnd }]) {
      const durationMs = window.start.getTime() - focusCursor.getTime();
      if (durationMs >= FOCUS_WINDOW_MINUTES * MINUTE_MS) {
        const durationMinutes = durationMs / MINUTE_MS;
        const hour = dayjs(focusCursor).tz(zone).hour();
        const quality = durationMinutes >= 120 && hour < 14 ? "prime" : durationMinutes >= 90 ? "good" : "available";
        dayFocusWindows.push({
          date,
          startAt: focusCursor,
          endAt: window.start,
          durationMs,
          quality,
          reason: quality === "prime" ? "Long morning window with low schedule fragmentation" : durationMinutes >= 90 ? "Enough room for a sustained focus block" : "Usable uninterrupted work window",
        });
      }
      if (window.end > focusCursor) focusCursor = window.end;
    }
    for (const window of dayFocusWindows) {
      const futureStart = new Date(Math.max(window.startAt.getTime(), now.getTime()));
      if (window.endAt.getTime() - futureStart.getTime() < FOCUS_WINDOW_MINUTES * MINUTE_MS) continue;
      focusWindows.push({ ...window, startAt: futureStart, durationMs: window.endAt.getTime() - futureStart.getTime() });
    }

    const workdayMs = (WORKDAY_END_HOUR - WORKDAY_START_HOUR) * 60 * MINUTE_MS;
    const meetingLoadPercent = Math.round((busyMs / workdayMs) * 100);
    const longestFocusMs = Math.max(0, ...dayFocusWindows.map((window) => window.durationMs));
    const chainPenalty = windows.slice(1).filter((window, index) => {
      const gap = window.start.getTime() - windows[index].end.getTime();
      return gap >= 0 && gap <= CHAIN_GAP_MINUTES * MINUTE_MS;
    }).length;
    const dayPressure = Math.min(100, Math.round(meetingLoadPercent * 0.65 + dayConflictCount * 18 + compressedGapCount * 7 + chainPenalty * 5));
    days.push({ date, eventCount: windows.length, busyMs, meetingLoadPercent, conflictCount: dayConflictCount, compressedGapCount, longestFocusMs, pressureScore: dayPressure });

    if (workdayEnd >= now) {
      if (dayConflictCount > 0) recommendations.push({ id: `conflict-${date}`, severity: "critical", title: `${dayConflictCount} schedule conflict${dayConflictCount === 1 ? "" : "s"}`, detail: "Resolve overlapping busy events before the day begins.", date });
      if (meetingLoadPercent >= 50) recommendations.push({ id: `load-${date}`, severity: "warning", title: "Meeting-heavy day", detail: `${meetingLoadPercent}% of the workday is already committed. Protect recovery and preparation time.`, date });
      if (compressedGapCount >= 2) recommendations.push({ id: `recovery-${date}`, severity: "warning", title: "Recovery time is compressed", detail: `${compressedGapCount} transitions leave less than ${RECOVERY_BUFFER_MINUTES} minutes between commitments.`, date });
      if (windows.length > 0 && longestFocusMs < FOCUS_WINDOW_MINUTES * MINUTE_MS) recommendations.push({ id: `fragmented-${date}`, severity: "warning", title: "No deep-work window", detail: `There is no uninterrupted ${FOCUS_WINDOW_MINUTES}-minute block inside the workday.`, date });
    }

    cursor = cursor.add(1, "day");
  }

  const availableFocusMs = focusWindows.reduce((sum, window) => sum + window.durationMs, 0);
  const overloadedDayCount = days.filter((day) => day.meetingLoadPercent >= 50 || day.pressureScore >= 60).length;
  const averagePressure = days.length > 0 ? Math.round(days.reduce((sum, day) => sum + day.pressureScore, 0) / days.length) : 0;
  const compressedGapCount = days.reduce((sum, day) => sum + day.compressedGapCount, 0);
  if (recommendations.length === 0) recommendations.push({ id: "balanced", severity: "info", title: "Schedule has breathing room", detail: "No material conflicts or high-pressure meeting patterns were found in this range." });

  return {
    timezone: zone,
    workday: { startHour: WORKDAY_START_HOUR, endHour: WORKDAY_END_HOUR },
    summary: {
      pressureScore: averagePressure,
      pressureLevel: pressureLevel(averagePressure),
      conflictCount: conflicts.length,
      compressedGapCount,
      overloadedDayCount,
      focusWindowCount: focusWindows.length,
      availableFocusMs,
    },
    days,
    conflicts: conflicts.slice(0, 20),
    focusWindows: focusWindows.sort((a, b) => {
      const quality = { prime: 3, good: 2, available: 1 };
      return quality[b.quality] - quality[a.quality] || b.durationMs - a.durationMs || a.startAt.getTime() - b.startAt.getTime();
    }).slice(0, 20),
    recommendations: recommendations.sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity])).slice(0, 12),
  };
}
