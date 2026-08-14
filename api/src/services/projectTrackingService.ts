import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { prisma } from "../prisma";
import { emitGoalProgress, emitProjectChanged } from "../websocket/broadcaster";
import { getCalendarTrackingSettings } from "./calendarTrackingService";
import { listGoalsWithProgress, updateAndEmitGoalProgress } from "./goalProgressService";
import { calculateProjectTime, getProjectTimeIntervals } from "./projectTimeService";

dayjs.extend(utc);
dayjs.extend(timezone);

const MINUTE_MS = 60_000;

function clippedMinutes(item: { startTime: Date; endTime: Date; duration: number }, from: Date, to: Date) {
  const overlap = Math.max(0, Math.min(item.endTime.getTime(), to.getTime()) - Math.max(item.startTime.getTime(), from.getTime()));
  return Math.min(overlap, Math.max(0, item.duration)) / MINUTE_MS;
}

function groupActivities<T extends { durationMinutes: number }>(items: T[], key: (item: T) => string, limit = 8) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(key(item), (totals.get(key(item)) || 0) + item.durationMinutes);
  return [...totals.entries()]
    .map(([name, minutes]) => ({ name, minutes: Number(minutes.toFixed(1)) }))
    .sort((left, right) => right.minutes - left.minutes)
    .slice(0, limit);
}

function intervalTotals(
  intervals: Awaited<ReturnType<typeof getProjectTimeIntervals>>,
  from: Date,
  to: Date
) {
  return calculateProjectTime(intervals
    .filter((interval) => interval.start < to && interval.end > from)
    .map((interval) => ({ ...interval, start: new Date(Math.max(from.getTime(), interval.start.getTime())), end: new Date(Math.min(to.getTime(), interval.end.getTime())) })));
}

export async function getProjectDashboard(userId: string, projectId: string, days = 14, now = new Date()) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { rules: { orderBy: { id: "asc" } } },
  });
  if (!project) throw new Error("Project not found");

  const settings = await getCalendarTrackingSettings(userId);
  const safeDays = Math.min(Math.max(Math.floor(days), 7), 60);
  const localNow = dayjs(now).tz(settings.timezone);
  const to = localNow.add(1, "day").startOf("day");
  const from = to.subtract(safeDays, "day");
  const previousFrom = from.subtract(safeDays, "day");
  const weekStart = localNow.subtract((localNow.day() + 6) % 7, "day").startOf("day");
  const todayStart = localNow.startOf("day");

  const [projectIntervals, rawActivities, focusSessions, allGoals] = await Promise.all([
    getProjectTimeIntervals(userId, previousFrom.toDate(), to.toDate(), now, projectId),
    prisma.activity.findMany({
      where: { session: { userId }, projectId, startTime: { lt: to.toDate() }, endTime: { gt: from.toDate() } },
      orderBy: { startTime: "desc" },
      take: 2_000,
      select: { id: true, appName: true, windowTitle: true, domain: true, category: true, intent: true, focusImpact: true, startTime: true, endTime: true, duration: true, iconUrl: true },
    }),
    prisma.deepWorkSession.findMany({
      where: { userId, projectId, startedAt: { gte: from.toDate(), lt: to.toDate() } },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: { id: true, goal: true, status: true, plannedMinutes: true, startedAt: true, endedAt: true, focusScore: true, productivityScore: true, violationCount: true },
    }),
    listGoalsWithProgress(userId),
  ]);

  const rangeTotals = intervalTotals(projectIntervals, from.toDate(), to.toDate());
  const previousTotals = intervalTotals(projectIntervals, previousFrom.toDate(), from.toDate());
  const weekTotals = intervalTotals(projectIntervals, weekStart.toDate(), weekStart.add(7, "day").toDate());
  const todayTotals = intervalTotals(projectIntervals, todayStart.toDate(), todayStart.add(1, "day").toDate());

  const activities = rawActivities.map((activity) => ({
    ...activity,
    durationMinutes: clippedMinutes(activity, from.toDate(), to.toDate()),
  }));
  const range = rangeTotals.get(projectId) ?? { minutes: 0, activityMinutes: 0, calendarMinutes: 0 };
  const previous = previousTotals.get(projectId)?.minutes ?? 0;
  const week = weekTotals.get(projectId)?.minutes ?? 0;
  const today = todayTotals.get(projectId)?.minutes ?? 0;

  const daily = Array.from({ length: safeDays }, (_, index) => {
    const start = from.add(index, "day");
    const end = start.add(1, "day");
    const totals = intervalTotals(projectIntervals, start.toDate(), end.toDate());
    const value = totals.get(projectId) ?? { minutes: 0, activityMinutes: 0, calendarMinutes: 0 };
    return {
      date: start.format("YYYY-MM-DD"),
      minutes: Number(value.minutes.toFixed(1)),
      activityMinutes: Number(value.activityMinutes.toFixed(1)),
      calendarMinutes: Number(value.calendarMinutes.toFixed(1)),
    };
  });

  const weightedDuration = activities.reduce((sum, item) => sum + item.durationMinutes, 0);
  const focusImpact = weightedDuration > 0
    ? activities.reduce((sum, item) => sum + (item.focusImpact ?? 0.5) * item.durationMinutes, 0) / weightedDuration * 100
    : 0;
  const completedFocus = focusSessions.filter((session) => session.status === "completed");
  const avgFocus = completedFocus.length
    ? completedFocus.reduce((sum, session) => sum + session.focusScore, 0) / completedFocus.length
    : 0;
  const goalMinutes = Math.max(0, project.weeklyHourGoal * 60);

  return {
    project,
    summary: {
      todayMinutes: Number(today.toFixed(1)),
      weekMinutes: Number(week.toFixed(1)),
      rangeMinutes: Number(range.minutes.toFixed(1)),
      activityMinutes: Number(range.activityMinutes.toFixed(1)),
      calendarMinutes: Number(range.calendarMinutes.toFixed(1)),
      weeklyGoalMinutes: goalMinutes,
      weeklyProgress: goalMinutes > 0 ? Math.round(week / goalMinutes * 100) : 0,
      changePercent: previous > 0 ? Math.round((range.minutes - previous) / previous * 100) : range.minutes > 0 ? 100 : 0,
      focusQuality: Math.round(avgFocus || focusImpact),
      focusSessions: focusSessions.length,
      completedFocusSessions: completedFocus.length,
    },
    range: { from: from.format("YYYY-MM-DD"), to: to.subtract(1, "day").format("YYYY-MM-DD"), days: safeDays, timezone: settings.timezone },
    daily,
    topApps: groupActivities(activities, (item) => item.appName || "Unknown"),
    categories: groupActivities(activities, (item) => item.category || "uncategorized"),
    recentActivities: activities.slice(0, 80),
    focusSessions,
    goals: allGoals.filter((goal) => goal.projectId === projectId),
  };
}

export async function getUnassignedProjectActivities(userId: string, days = 7, now = new Date()) {
  const settings = await getCalendarTrackingSettings(userId);
  const from = dayjs(now).tz(settings.timezone).subtract(Math.min(Math.max(days, 1), 30), "day").startOf("day").toDate();
  const activities = await prisma.activity.findMany({
    where: { session: { userId }, projectId: null, startTime: { gte: from } },
    orderBy: { startTime: "desc" },
    take: 250,
    select: { id: true, appName: true, windowTitle: true, domain: true, category: true, intent: true, startTime: true, endTime: true, duration: true, iconUrl: true },
  });
  return activities.map((activity) => ({ ...activity, durationMinutes: Number((Math.max(0, activity.duration) / MINUTE_MS).toFixed(1)) }));
}

export async function assignActivitiesToProject(
  userId: string,
  activityIds: string[],
  projectId: string | null,
  remember = false
) {
  const ids = [...new Set(activityIds.filter(Boolean))].slice(0, 200);
  if (!ids.length) throw new Error("Select at least one activity");
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId, active: true }, select: { id: true } });
    if (!project) throw new Error("Project not found");
  }
  const activities = await prisma.activity.findMany({
    where: { id: { in: ids }, session: { userId } },
    select: { id: true, appName: true, domain: true },
  });
  if (activities.length !== ids.length) throw new Error("One or more activities were not found");

  await prisma.$transaction(async (tx) => {
    await tx.activity.updateMany({ where: { id: { in: ids } }, data: { projectId } });
    if (!remember || !projectId) return;
    for (const activity of activities) {
      const candidate = activity.domain
        ? { domain: activity.domain.toLowerCase(), appName: null }
        : { domain: null, appName: activity.appName };
      const exists = await tx.projectRule.findFirst({
        where: { projectId, domain: candidate.domain, appName: candidate.appName, titleKeyword: null },
      });
      if (!exists) {
        await tx.projectRule.create({
          data: { projectId, domain: candidate.domain, appName: candidate.appName, matchType: candidate.domain ? "contains" : "exact" },
        });
      }
    }
  });

  const goals = await updateAndEmitGoalProgress(userId);
  emitGoalProgress(userId, goals);
  emitProjectChanged(userId, "rules-updated", { projectId, activityIds: ids, remembered: remember });
  return { updated: ids.length, projectId, remembered: remember };
}
