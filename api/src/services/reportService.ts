import type { Activity } from "@prisma/client";
import { prisma } from "../prisma";
import {
  addDaysToDateKey,
  lastISTDays,
  toISTDateKey,
  type ISTDateRange,
} from "../utils/time";
import {
  activeMsBySession,
  productivityScoreOf,
  summarizeActivities,
  type EffectiveActivity,
} from "./rangeMetrics";
import { loadResolvedActivities } from "./rangeActivityQuery";
import { getProjectTimeRange } from "./projectTimeService";

export type ReportPeriod = "daily" | "weekly" | "monthly";

export const REPORT_PERIODS: readonly ReportPeriod[] = ["daily", "weekly", "monthly"];

const PERIOD_DAYS: Record<ReportPeriod, number> = { daily: 1, weekly: 7, monthly: 30 };

export interface ReportSummaryPayload {
  userId: string;
  period: ReportPeriod;
  startDate: Date;
  endDate: Date;
  focusHours: number;
  productivityPct: number;
  burnoutIndex: number;
  totalDurationHours: number;
  categoryBreakdown: Record<string, number>;
  topApps: Array<{ appName: string; durationMinutes: number; category: string }>;
  projectBreakdown: Array<{ projectName: string; minutes: number }>;
}

/**
 * IST window of a report. `completed` covers the period that just ended
 * (yesterday, or the 7/30 days before today) for scheduled reports; otherwise
 * the period ends today and the report covers it up to `now`.
 */
export function reportPeriodRange(period: ReportPeriod, now = new Date(), completed = false): ISTDateRange {
  const todayKey = toISTDateKey(now);
  return lastISTDays(PERIOD_DAYS[period], completed ? addDaysToDateKey(todayKey, -1) : todayKey);
}

/**
 * Pure summary of resolved (clipped, overlap-free) activities. Durations are
 * milliseconds in, minutes/hours out. Idle time is excluded; "focus hours" is
 * time in productive categories, the same definition as productivityScore.
 */
export function summarizeReportActivities(
  items: EffectiveActivity<Activity>[],
  sessionBurnout: Map<string, number>,
  projectMinutes: Array<{ projectName: string; minutes: number }>
) {
  const totals = summarizeActivities(items);

  let burnoutWeighted = 0;
  let burnoutWeight = 0;
  for (const [sessionId, activeMs] of activeMsBySession(items)) {
    if (activeMs <= 0) continue;
    burnoutWeighted += (sessionBurnout.get(sessionId) ?? 0) * activeMs;
    burnoutWeight += activeMs;
  }

  const appCategories = new Map<string, Record<string, number>>();
  for (const item of items) {
    if (item.idle) continue;
    const appName = item.activity.appName || "Unknown";
    const category = item.activity.category || "unknown";
    const categories = appCategories.get(appName) ?? {};
    categories[category] = (categories[category] ?? 0) + item.ms;
    appCategories.set(appName, categories);
  }

  const topApps = Object.entries(totals.appUsage)
    .map(([appName, ms]) => ({
      appName: appName || "Unknown",
      durationMinutes: Math.round(ms / 60000),
      category: Object.entries(appCategories.get(appName || "Unknown") ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown",
    }))
    .sort((a, b) => b.durationMinutes - a.durationMinutes)
    .slice(0, 7);

  const categoryBreakdown: Record<string, number> = {};
  for (const [category, ms] of Object.entries(totals.categoryMs)) {
    categoryBreakdown[category] = Math.round(ms / 60000);
  }

  return {
    focusHours: Math.round((totals.productiveMs / 3600000) * 10) / 10,
    productivityPct: Math.round(productivityScoreOf(totals)),
    burnoutIndex: burnoutWeight > 0 ? Math.round((burnoutWeighted / burnoutWeight) * 10) / 10 : 0,
    totalDurationHours: Math.round((totals.activeMs / 3600000) * 10) / 10,
    categoryBreakdown,
    topApps,
    projectBreakdown: projectMinutes,
  };
}

const TITLE_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" });

export async function generateUserReport(
  userId: string,
  period: ReportPeriod,
  customStart?: Date,
  customEnd?: Date,
  now = new Date()
) {
  const window = reportPeriodRange(period, now);
  const startDate = customStart ?? window.start;
  const endDate = customEnd ?? new Date(Math.min(window.end.getTime(), now.getTime()));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error("Invalid report range");
  }

  const items = await loadResolvedActivities(userId, startDate, endDate);
  const sessionIds = [...new Set(items.map((item) => item.activity.sessionId))];
  const [sessions, projectTotals] = await Promise.all([
    sessionIds.length
      ? prisma.session.findMany({ where: { id: { in: sessionIds } }, select: { id: true, burnoutScore: true } })
      : Promise.resolve([]),
    getProjectTimeRange(userId, startDate, endDate, now),
  ]);
  const projects = projectTotals.size
    ? await prisma.project.findMany({ where: { id: { in: [...projectTotals.keys()] } }, select: { id: true, name: true } })
    : [];
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const projectBreakdown = [...projectTotals.entries()]
    .map(([projectId, value]) => ({ projectName: projectNames.get(projectId) ?? "Unknown project", minutes: Math.round(value.minutes) }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const summary = summarizeReportActivities(
    items,
    new Map(sessions.map((session) => [session.id, session.burnoutScore ?? 0])),
    projectBreakdown
  );

  const summaryJson: ReportSummaryPayload = {
    userId,
    period,
    startDate,
    endDate,
    ...summary,
  };

  const title = `${period.toUpperCase()} Activity & Focus Report - ${TITLE_DATE.format(startDate)}`;

  const report = await prisma.report.create({
    data: {
      userId,
      title,
      period,
      startDate,
      endDate,
      summaryJson: summaryJson as any,
      productivityPct: summary.productivityPct,
      focusHours: summary.focusHours,
      burnoutIndex: summary.burnoutIndex,
    },
  });

  return report;
}
