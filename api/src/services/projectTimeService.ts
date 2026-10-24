import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "../prisma";
import { getCalendarTrackingSettings } from "./calendarTrackingService";
import { findActivitiesOverlapping } from "./rangeActivityQuery";
import { resolveActivityTime, type RangeActivity } from "./rangeMetrics";

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

/**
 * Activity intervals of each project in [fromMs, toMs): the instants its
 * activities own after overlap resolution (idle wins, see rangeMetrics), so the
 * idle the tracker backdates over the last foreground row is not project time.
 * Pass every activity of the range, project or not, so ownership is complete.
 */
export function projectActivityIntervals(
  activities: Array<RangeActivity & { projectId?: string | null }>,
  fromMs: number,
  toMs: number,
  projectId?: string
): ProjectTimeInterval[] {
  return resolveActivityTime(activities, fromMs, toMs)
    .filter((item) => {
      const owner = item.activity.projectId;
      return !item.idle && Boolean(owner) && (!projectId || owner === projectId) && item.activity.category !== "distracting";
    })
    .flatMap((item) => item.segments.map((segment) => ({
      projectId: item.activity.projectId!,
      start: new Date(segment.startMs),
      end: new Date(segment.endMs),
      source: "activity" as const,
    })));
}

export async function getProjectTimeIntervals(userId: string, from: Date, to: Date, now = new Date(), projectId?: string) {
  const activityEnd = new Date(Math.min(to.getTime(), now.getTime()));
  const [activities, calendarSessions] = await Promise.all([
    activityEnd > from ? findActivitiesOverlapping(userId, from, activityEnd) : Promise.resolve([]),
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

  const activityIntervals = projectActivityIntervals(activities, from.getTime(), activityEnd.getTime(), projectId);
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
