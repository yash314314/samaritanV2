import type { Goal } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { prisma } from "../prisma";
import { getCalendarTrackingSettings } from "./calendarTrackingService";
import { getProjectTimeRange } from "./projectTimeService";
import { parseCalendarDate } from "./calendarTimeService";
import { loadResolvedActivities } from "./rangeActivityQuery";
import { summarizeActivities, type EffectiveActivity, type RangeActivity } from "./rangeMetrics";
import { InvalidRequestError, isValidDateKey } from "../utils/time";

dayjs.extend(utc);
dayjs.extend(timezone);

const MINUTE_MS = 60_000;

export type GoalRange = { start: Date; end: Date };

/**
 * Goal start/end dates are stored as UTC midnight of the account-timezone
 * calendar day (goalPeriodRange reads them back with toISOString()). A plain
 * YYYY-MM-DD is that day; a datetime is converted to its day in `timeZone`
 * first, so "2026-10-22T00:00:00+05:30" stays 2026-10-22 instead of
 * slipping to the 21st. Empty input clears the date; garbage is rejected.
 */
export function goalDateFromInput(value: unknown, timeZone: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InvalidRequestError("Invalid goal date");
  const input = value.trim();
  let dateKey: string | null = null;
  if (isValidDateKey(input)) {
    dateKey = input;
  } else {
    const parsed = parseCalendarDate(input, timeZone);
    if (parsed) dateKey = dayjs(parsed).tz(timeZone).format("YYYY-MM-DD");
  }
  if (!dateKey || !isValidDateKey(dateKey)) throw new InvalidRequestError("Invalid goal date");
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function goalPeriodRange(
  goal: Pick<Goal, "period" | "startDate" | "endDate">,
  timezoneName: string,
  now = new Date()
): GoalRange {
  if (goal.startDate && goal.endDate) {
    const startKey = goal.startDate.toISOString().slice(0, 10);
    const endKey = goal.endDate.toISOString().slice(0, 10);
    return {
      start: dayjs.tz(startKey, timezoneName).startOf("day").toDate(),
      end: dayjs.tz(endKey, timezoneName).endOf("day").toDate(),
    };
  }

  const local = dayjs(now).tz(timezoneName);
  if (goal.period === "weekly") {
    const daysSinceMonday = (local.day() + 6) % 7;
    const start = local.subtract(daysSinceMonday, "day").startOf("day");
    return { start: start.toDate(), end: start.add(7, "day").subtract(1, "millisecond").toDate() };
  }
  if (goal.period === "monthly") {
    const start = local.startOf("month");
    return { start: start.toDate(), end: start.add(1, "month").subtract(1, "millisecond").toDate() };
  }
  const start = local.startOf("day");
  return { start: start.toDate(), end: start.add(1, "day").subtract(1, "millisecond").toDate() };
}

/**
 * Minutes in productive categories (the time behind productivityScore and
 * report focus hours) of resolved activities: clipped to the period, overlaps
 * resolved, idle excluded. With `projectId`, only that project's activities.
 */
export function productiveMinutesOf(
  items: EffectiveActivity<RangeActivity & { projectId?: string | null }>[],
  projectId?: string | null
) {
  const scoped = projectId ? items.filter((item) => item.activity.projectId === projectId) : items;
  return summarizeActivities(scoped).productiveMs / MINUTE_MS;
}

function previousAnchor(range: GoalRange) {
  return new Date(range.start.getTime() - 1);
}

async function progressForGoal(goal: Goal, range: GoalRange, now = new Date()) {
  const endExclusive = new Date(range.end.getTime() + 1);
  const projectFilter = goal.projectId ? { projectId: goal.projectId } : {};

  if (goal.type === "focus_minutes") {
    const sessions = await prisma.deepWorkSession.findMany({
      where: {
        userId: goal.userId,
        ...projectFilter,
        status: { in: ["active", "completed"] },
        startedAt: { lt: endExclusive },
        OR: [{ endedAt: { gt: range.start } }, { status: "active", endedAt: null }],
      },
      select: { startedAt: true, endedAt: true, plannedMinutes: true },
    });
    return sessions.reduce((sum, session) => {
      const sessionEnd = session.endedAt ?? new Date(Math.min(now.getTime(), session.startedAt.getTime() + session.plannedMinutes * MINUTE_MS));
      const overlap = Math.max(0, Math.min(sessionEnd.getTime(), endExclusive.getTime()) - Math.max(session.startedAt.getTime(), range.start.getTime()));
      return sum + overlap / MINUTE_MS;
    }, 0);
  }

  if (goal.type === "sessions") {
    return prisma.deepWorkSession.count({
      where: {
        userId: goal.userId,
        ...projectFilter,
        status: "completed",
        startedAt: { gte: range.start, lt: endExclusive },
      },
    });
  }

  if (goal.type === "hours" || goal.type === "project_minutes") {
    const totals = await getProjectTimeRange(goal.userId, range.start, endExclusive, now);
    const minutes = goal.projectId
      ? totals.get(goal.projectId)?.minutes ?? 0
      : [...totals.values()].reduce((sum, value) => sum + value.minutes, 0);
    return goal.type === "hours" ? minutes / 60 : minutes;
  }

  // productive_minutes: every activity is resolved, project or not, so idle
  // backdated over an active row is not counted twice.
  const items = await loadResolvedActivities(goal.userId, range.start, endExclusive);
  return productiveMinutesOf(items, goal.projectId);
}

async function upsertSnapshot(goal: Goal, range: GoalRange, progress: number, now = new Date()) {
  const completed = goal.target > 0 && progress >= goal.target;
  const completionTime = range.end < now ? range.end : now;
  const existing = await prisma.goalProgress.findUnique({
    where: { goalId_periodStart: { goalId: goal.id, periodStart: range.start } },
  });
  return prisma.goalProgress.upsert({
    where: { goalId_periodStart: { goalId: goal.id, periodStart: range.start } },
    create: {
      goalId: goal.id,
      periodStart: range.start,
      periodEnd: range.end,
      progress,
      target: goal.target,
      completed,
      completedAt: completed ? completionTime : null,
    },
    update: {
      periodEnd: range.end,
      progress,
      target: goal.target,
      completed,
      completedAt: completed ? existing?.completedAt ?? completionTime : null,
    },
  });
}

async function streakForGoal(goalId: string, currentStart: Date) {
  const snapshots = await prisma.goalProgress.findMany({
    where: { goalId },
    orderBy: { periodStart: "desc" },
    take: 90,
    select: { periodStart: true, completed: true },
  });
  let streak = 0;
  for (const snapshot of snapshots) {
    const currentIncomplete = snapshot.periodStart.getTime() === currentStart.getTime() && !snapshot.completed;
    if (currentIncomplete) continue;
    if (!snapshot.completed) break;
    streak += 1;
  }
  return streak;
}

async function hydrateWithTimezone<T extends Goal>(goal: T, timezoneName: string, now = new Date()) {
  const range = goalPeriodRange(goal, timezoneName, now);
  const progress = await progressForGoal(goal, range, now);
  const snapshot = await upsertSnapshot(goal, range, progress, now);
  const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - range.start.getTime()) / Math.max(1, range.end.getTime() - range.start.getTime())));
  const progressRatio = goal.target > 0 ? progress / goal.target : 0;
  const paceRatio = elapsedRatio > 0 ? progressRatio / elapsedRatio : progressRatio > 0 ? 1 : 0;
  const status = snapshot.completed ? "completed" : progressRatio + 0.08 >= elapsedRatio ? "on_track" : "at_risk";
  const streak = await streakForGoal(goal.id, range.start);

  if (Math.abs(goal.progress - progress) > 0.01 || Boolean(goal.completedAt) !== snapshot.completed) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: { progress, completedAt: snapshot.completed ? snapshot.completedAt : null },
    });
  }

  return {
    ...goal,
    progress: Number(progress.toFixed(2)),
    progressRatio: Math.min(1, progressRatio),
    rawProgressRatio: progressRatio,
    remaining: Number(Math.max(0, goal.target - progress).toFixed(2)),
    status,
    pacePercent: Math.round(paceRatio * 100),
    expectedProgress: Number((goal.target * elapsedRatio).toFixed(2)),
    forecast: Number((elapsedRatio > 0 ? progress / elapsedRatio : progress).toFixed(2)),
    streak,
    periodStart: range.start,
    periodEnd: range.end,
    timezone: timezoneName,
  };
}

export async function hydrateGoalProgress<T extends Goal>(goal: T, now = new Date()) {
  const settings = await getCalendarTrackingSettings(goal.userId);
  return hydrateWithTimezone(goal, settings.timezone, now);
}

export async function listGoalsWithProgress(userId: string, period?: string, includeArchived = false, now = new Date()) {
  const [goals, settings] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, ...(includeArchived ? {} : { active: true }), ...(period ? { period } : {}) },
      include: { project: { select: { id: true, name: true, color: true } } },
      orderBy: [{ active: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    }),
    getCalendarTrackingSettings(userId),
  ]);
  return Promise.all(goals.map((goal) => hydrateWithTimezone(goal, settings.timezone, now)));
}

export async function getGoalHistory(userId: string, goalId: string, periods = 14, now = new Date()) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw new Error("Goal not found");
  const settings = await getCalendarTrackingSettings(userId);
  const ranges: GoalRange[] = [];
  let anchor = now;
  const count = goal.startDate && goal.endDate ? 1 : Math.min(Math.max(periods, 1), 90);
  for (let index = 0; index < count; index += 1) {
    const range = goalPeriodRange(goal, settings.timezone, anchor);
    ranges.push(range);
    anchor = previousAnchor(range);
  }
  const history = [];
  for (const range of ranges.reverse()) {
    const progress = await progressForGoal(goal, range, now);
    history.push(await upsertSnapshot(goal, range, progress, now));
  }
  return { goal: await hydrateWithTimezone(goal, settings.timezone, now), history };
}

export async function getGoalsDashboard(userId: string, period?: string, now = new Date()) {
  const goals = await listGoalsWithProgress(userId, period, false, now);
  return {
    goals,
    summary: {
      active: goals.length,
      completed: goals.filter((goal) => goal.status === "completed").length,
      onTrack: goals.filter((goal) => goal.status === "on_track").length,
      atRisk: goals.filter((goal) => goal.status === "at_risk").length,
      averageProgress: goals.length ? Math.round(goals.reduce((sum, goal) => sum + goal.progressRatio, 0) / goals.length * 100) : 0,
      bestStreak: goals.reduce((best, goal) => Math.max(best, goal.streak), 0),
    },
  };
}

export async function updateAndEmitGoalProgress(userId: string) {
  return listGoalsWithProgress(userId);
}
