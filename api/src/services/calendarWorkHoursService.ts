import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { Activity } from "@prisma/client";
import { prisma } from "../prisma";
import { isIdleActivity } from "./metricEngine";
import { getCalendarTrackingSettings, type CalendarWorkHourInput } from "./calendarTrackingService";

dayjs.extend(utc);
dayjs.extend(timezone);

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

type ActivityInterval = {
  start: Date;
  end: Date;
};

export type CalendarWorkHoursDay = {
  date: string;
  dayOfWeek: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
  scheduledMs: number;
  elapsedScheduledMs: number;
  trackedMs: number;
  withinWorkHoursMs: number;
  offHoursMs: number;
  utilizationPercent: number;
  adherencePercent: number;
  firstActivityAt: Date | null;
  lastActivityAt: Date | null;
  status: "off" | "future" | "upcoming" | "active" | "complete";
};

export type CalendarWorkHoursUtilization = {
  timezone: string;
  from: string;
  to: string;
  summary: {
    scheduledMs: number;
    elapsedScheduledMs: number;
    trackedMs: number;
    withinWorkHoursMs: number;
    offHoursMs: number;
    utilizationPercent: number;
    adherencePercent: number;
    scheduledDayCount: number;
    elapsedDayCount: number;
    onTargetDayCount: number;
    offHoursDayCount: number;
  };
  days: CalendarWorkHoursDay[];
};

function nextDateKey(dateKey: string) {
  const [year, month, date] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function dateKeys(from: Date, to: Date, timeZone: string) {
  const first = dayjs(from).tz(timeZone).format("YYYY-MM-DD");
  const last = dayjs(new Date(Math.max(from.getTime(), to.getTime() - 1))).tz(timeZone).format("YYYY-MM-DD");
  const keys: string[] = [];
  let cursor = first;
  while (cursor <= last && keys.length < 370) {
    keys.push(cursor);
    cursor = nextDateKey(cursor);
  }
  return keys;
}

function zonedDateAtMinute(dateKey: string, minute: number, timeZone: string) {
  if (minute >= DAY_MINUTES) return dayjs.tz(nextDateKey(dateKey), timeZone).startOf("day").toDate();
  const hour = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutePart = String(minute % 60).padStart(2, "0");
  return dayjs.tz(`${dateKey}T${hour}:${minutePart}`, timeZone).toDate();
}

function overlapMs(start: Date, end: Date, windowStart: Date, windowEnd: Date) {
  return Math.max(0, Math.min(end.getTime(), windowEnd.getTime()) - Math.max(start.getTime(), windowStart.getTime()));
}

export function mergeCalendarActivityIntervals(intervals: ActivityInterval[]) {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  const merged: ActivityInterval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) {
      if (interval.end > previous.end) previous.end = interval.end;
      continue;
    }
    merged.push({ start: new Date(interval.start), end: new Date(interval.end) });
  }
  return merged;
}

function normalizedActivityInterval(activity: Pick<Activity, "startTime" | "endTime" | "duration">, now: Date) {
  const durationEnd = activity.duration > 0
    ? new Date(activity.startTime.getTime() + activity.duration)
    : activity.endTime;
  const end = new Date(Math.min(activity.endTime.getTime(), durationEnd.getTime(), now.getTime()));
  return end > activity.startTime ? { start: activity.startTime, end } : null;
}

export function calculateCalendarWorkHoursUtilization(input: {
  from: Date;
  to: Date;
  now: Date;
  timeZone: string;
  workHours: CalendarWorkHourInput[];
  intervals: ActivityInterval[];
}): CalendarWorkHoursUtilization {
  const rangeStart = input.from;
  const rangeEnd = input.to;
  const merged = mergeCalendarActivityIntervals(input.intervals.map((interval) => ({
    start: new Date(Math.max(interval.start.getTime(), rangeStart.getTime())),
    end: new Date(Math.min(interval.end.getTime(), rangeEnd.getTime(), input.now.getTime())),
  })));

  const days = dateKeys(rangeStart, rangeEnd, input.timeZone).map<CalendarWorkHoursDay>((date) => {
    const dayStart = dayjs.tz(date, input.timeZone).startOf("day").toDate();
    const dayEnd = dayjs.tz(nextDateKey(date), input.timeZone).startOf("day").toDate();
    const dayOfWeek = dayjs.tz(date, input.timeZone).day();
    const schedule = input.workHours.find((item) => item.dayOfWeek === dayOfWeek);
    const enabled = Boolean(schedule?.enabled && schedule.endMinute > schedule.startMinute);
    const startMinute = schedule?.startMinute ?? 0;
    const endMinute = schedule?.endMinute ?? 0;
    const workStart = enabled ? zonedDateAtMinute(date, startMinute, input.timeZone) : dayStart;
    const workEnd = enabled ? zonedDateAtMinute(date, endMinute, input.timeZone) : dayStart;
    const scheduledMs = enabled ? Math.max(0, workEnd.getTime() - workStart.getTime()) : 0;
    const elapsedScheduledMs = enabled
      ? overlapMs(workStart, workEnd, rangeStart, new Date(Math.min(rangeEnd.getTime(), input.now.getTime())))
      : 0;
    const dayIntervals = merged.filter((interval) => interval.end > dayStart && interval.start < dayEnd);
    const trackedMs = dayIntervals.reduce((sum, interval) => sum + overlapMs(interval.start, interval.end, dayStart, dayEnd), 0);
    const withinWorkHoursMs = enabled
      ? dayIntervals.reduce((sum, interval) => sum + overlapMs(interval.start, interval.end, workStart, workEnd), 0)
      : 0;
    const offHoursMs = Math.max(0, trackedMs - withinWorkHoursMs);
    const utilizationPercent = elapsedScheduledMs > 0
      ? Math.min(100, Math.round((withinWorkHoursMs / elapsedScheduledMs) * 100))
      : 0;
    const adherencePercent = trackedMs > 0 ? Math.round((withinWorkHoursMs / trackedMs) * 100) : 0;
    const firstActivityAt = dayIntervals.length
      ? new Date(Math.max(dayStart.getTime(), dayIntervals[0].start.getTime()))
      : null;
    const lastActivityAt = dayIntervals.length
      ? new Date(Math.min(dayEnd.getTime(), dayIntervals[dayIntervals.length - 1].end.getTime()))
      : null;
    let status: CalendarWorkHoursDay["status"] = "off";
    if (enabled && input.now < workStart) status = input.now < dayStart ? "future" : "upcoming";
    else if (enabled && input.now < workEnd) status = "active";
    else if (enabled) status = "complete";

    return {
      date,
      dayOfWeek,
      enabled,
      startMinute,
      endMinute,
      scheduledMs,
      elapsedScheduledMs,
      trackedMs,
      withinWorkHoursMs,
      offHoursMs,
      utilizationPercent,
      adherencePercent,
      firstActivityAt,
      lastActivityAt,
      status,
    };
  });

  const scheduledMs = days.reduce((sum, day) => sum + day.scheduledMs, 0);
  const elapsedScheduledMs = days.reduce((sum, day) => sum + day.elapsedScheduledMs, 0);
  const trackedMs = days.reduce((sum, day) => sum + day.trackedMs, 0);
  const withinWorkHoursMs = days.reduce((sum, day) => sum + day.withinWorkHoursMs, 0);
  const offHoursMs = days.reduce((sum, day) => sum + day.offHoursMs, 0);
  const elapsedDays = days.filter((day) => day.elapsedScheduledMs > 0);

  return {
    timezone: input.timeZone,
    from: dayjs(rangeStart).tz(input.timeZone).format("YYYY-MM-DD"),
    to: dayjs(new Date(Math.max(rangeStart.getTime(), rangeEnd.getTime() - 1))).tz(input.timeZone).format("YYYY-MM-DD"),
    summary: {
      scheduledMs,
      elapsedScheduledMs,
      trackedMs,
      withinWorkHoursMs,
      offHoursMs,
      utilizationPercent: elapsedScheduledMs > 0 ? Math.min(100, Math.round((withinWorkHoursMs / elapsedScheduledMs) * 100)) : 0,
      adherencePercent: trackedMs > 0 ? Math.round((withinWorkHoursMs / trackedMs) * 100) : 0,
      scheduledDayCount: days.filter((day) => day.enabled).length,
      elapsedDayCount: elapsedDays.length,
      onTargetDayCount: elapsedDays.filter((day) => day.utilizationPercent >= 80).length,
      offHoursDayCount: days.filter((day) => day.offHoursMs >= 15 * MINUTE_MS).length,
    },
    days,
  };
}

export async function getCalendarWorkHoursUtilization(userId: string, from: Date, to: Date, now = new Date()) {
  const settings = await getCalendarTrackingSettings(userId);
  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      duration: { gt: 0 },
      startTime: { lt: to },
      endTime: { gt: from },
    },
    orderBy: { startTime: "asc" },
  });
  const intervals = activities
    .filter((activity) => !isIdleActivity(activity))
    .map((activity) => normalizedActivityInterval(activity, now))
    .filter((interval): interval is ActivityInterval => Boolean(interval));

  return calculateCalendarWorkHoursUtilization({
    from,
    to,
    now,
    timeZone: settings.timezone,
    workHours: settings.workHours,
    intervals,
  });
}
