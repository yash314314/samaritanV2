import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "../prisma";
import { getCalendarTrackingSettings } from "./calendarTrackingService";
import { isIdleActivity } from "./metricEngine";

dayjs.extend(utc);
dayjs.extend(timezone);

const MINUTE_MS = 60_000;

export type ProjectTimeInterval = {
  projectId: string;
  start: Date;
  end: Date;
  source: "activity" | "calendar";
};

export type ProjectTimeBreakdown = {
  minutes: number;
  activityMinutes: number;
  calendarMinutes: number;
};

function addProjectDuration(
  totals: Map<string, { totalMs: number; activityMs: number; calendarMs: number }>,
  projectId: string,
  durationMs: number,
  source: ProjectTimeInterval["source"]
) {
  const current = totals.get(projectId) ?? { totalMs: 0, activityMs: 0, calendarMs: 0 };
  current.totalMs += durationMs;
  if (source === "calendar") current.calendarMs += durationMs;
  else current.activityMs += durationMs;
  totals.set(projectId, current);
}

/**
 * Attribute each instant once. Confirmed calendar sessions outrank foreground
 * activity because presenting and multitasking should remain meeting time.
 * Equal-priority overlaps across different projects are split evenly.
 */
export function calculateProjectTime(intervals: ProjectTimeInterval[]) {
  const valid = intervals.filter((interval) => interval.projectId && interval.end > interval.start);
  const boundaries = [...new Set(valid.flatMap((interval) => [interval.start.getTime(), interval.end.getTime()]))]
    .sort((left, right) => left - right);
  const totals = new Map<string, { totalMs: number; activityMs: number; calendarMs: number }>();

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startMs = boundaries[index];
    const endMs = boundaries[index + 1];
    if (endMs <= startMs) continue;
    const active = valid.filter((interval) => interval.start.getTime() < endMs && interval.end.getTime() > startMs);
    if (!active.length) continue;
    const source: ProjectTimeInterval["source"] = active.some((interval) => interval.source === "calendar")
      ? "calendar"
      : "activity";
    const projects = [...new Set(active.filter((interval) => interval.source === source).map((interval) => interval.projectId))];
    const shareMs = (endMs - startMs) / projects.length;
    for (const projectId of projects) addProjectDuration(totals, projectId, shareMs, source);
  }

  return new Map<string, ProjectTimeBreakdown>(
    [...totals.entries()].map(([projectId, value]) => [projectId, {
      minutes: value.totalMs / MINUTE_MS,
      activityMinutes: value.activityMs / MINUTE_MS,
      calendarMinutes: value.calendarMs / MINUTE_MS,
    }])
  );
}

export async function getProjectTimeIntervals(userId: string, from: Date, to: Date, now = new Date(), projectId?: string) {
  const [activities, calendarSessions] = await Promise.all([
    prisma.activity.findMany({
      where: {
        session: { userId },
        projectId: projectId ?? { not: null },
        OR: [{ category: { not: "distracting" } }, { category: null }],
        startTime: { lt: to },
        endTime: { gt: from },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.calendarSession.findMany({
      where: {
        userId,
        projectId: projectId ?? { not: null },
        type: { in: ["meeting", "focus"] },
        status: { in: ["confirmed", "active"] },
        actualStart: { lt: to },
        OR: [{ actualEnd: { gt: from } }, { status: "active", actualEnd: null }],
      },
      orderBy: { actualStart: "asc" },
    }),
  ]);

  const activityIntervals: ProjectTimeInterval[] = activities
    .filter((activity) => activity.projectId && !isIdleActivity(activity))
    .map((activity) => {
      const durationEnd = new Date(activity.startTime.getTime() + Math.max(0, activity.duration));
      const rawEnd = activity.endTime > activity.startTime ? activity.endTime : durationEnd;
      return {
        projectId: activity.projectId!,
        start: new Date(Math.max(from.getTime(), activity.startTime.getTime())),
        end: new Date(Math.min(to.getTime(), now.getTime(), rawEnd.getTime(), durationEnd.getTime())),
        source: "activity" as const,
      };
    });
  const sessionIntervals: ProjectTimeInterval[] = calendarSessions
    .filter((session) => session.projectId && session.actualStart)
    .map((session) => ({
      projectId: session.projectId!,
      start: new Date(Math.max(from.getTime(), session.actualStart!.getTime())),
      end: new Date(Math.min(to.getTime(), now.getTime(), (session.actualEnd ?? now).getTime())),
      source: "calendar" as const,
    }));

  return [...activityIntervals, ...sessionIntervals].filter((interval) => interval.end > interval.start);
}

export async function getProjectTimeRange(userId: string, from: Date, to: Date, now = new Date()) {
  return calculateProjectTime(await getProjectTimeIntervals(userId, from, to, now));
}

export async function getCurrentProjectWeek(userId: string, now = new Date()) {
  const settings = await getCalendarTrackingSettings(userId);
  const localNow = dayjs(now).tz(settings.timezone);
  const daysSinceMonday = (localNow.day() + 6) % 7;
  const start = localNow.subtract(daysSinceMonday, "day").startOf("day");
  const end = start.add(7, "day");
  const totals = await getProjectTimeRange(userId, start.toDate(), end.toDate(), now);
  return {
    timezone: settings.timezone,
    from: start.format("YYYY-MM-DD"),
    to: end.subtract(1, "day").format("YYYY-MM-DD"),
    totals,
  };
}

/** Rebuild one timezone-local day and delete stale snapshots for that day. */
export async function aggregateProjectTime(userId: string, date: string) {
  const settings = await getCalendarTrackingSettings(userId);
  const start = dayjs.tz(date, settings.timezone).startOf("day");
  if (!start.isValid() || start.format("YYYY-MM-DD") !== date) throw new Error("Invalid project aggregation date");
  const end = start.add(1, "day");
  const totals = await getProjectTimeRange(userId, start.toDate(), end.toDate());
  const entries = [...totals.entries()];

  await prisma.$transaction([
    prisma.projectTime.deleteMany({ where: { userId, date } }),
    ...entries.map(([projectId, value]) => prisma.projectTime.create({
      data: { userId, projectId, date, minutes: value.minutes },
    })),
  ]);

  return {
    date,
    projectsUpdated: entries.length,
    totalMinutes: entries.reduce((sum, [, value]) => sum + value.minutes, 0),
  };
}

export async function aggregateAllUsersProjectTime(date?: string, now = new Date()) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = [];
  for (const user of users) {
    try {
      const effectiveDate = date ?? dayjs(now)
        .tz((await getCalendarTrackingSettings(user.id)).timezone)
        .subtract(1, "day")
        .format("YYYY-MM-DD");
      const result = await aggregateProjectTime(user.id, effectiveDate);
      results.push({ userId: user.id, ...result });
    } catch (error) {
      console.error(`Failed to aggregate for user ${user.id}:`, error);
      results.push({ userId: user.id, error: true });
    }
  }
  return results;
}
