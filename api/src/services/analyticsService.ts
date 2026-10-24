import type { Activity } from "@prisma/client";
import { prisma } from "../prisma";
import { getActivityProductivityScore, getBaseFocus } from "./metricEngine";
import {
  addDaysToDateKey,
  getISTHour,
  istDayStart,
  nextISTHourBoundary,
  overlapMs,
  toISTDateKey,
  type ISTDateRange,
} from "../utils/time";
import {
  activeMsBySession,
  deepWorkMsByISTDay,
  deepWorkStreak,
  focusScoreOf,
  resolveActivityTime,
  summarizeActivities,
  type EffectiveActivity,
  type StreakResult,
} from "./rangeMetrics";
import { loadResolvedActivities } from "./rangeActivityQuery";

// ─── Daily Analytics ────────────────────────────────────

/**
 * Totals for the inclusive IST day range. Activity time is clipped to the
 * range and overlaps are resolved, so active + idle never exceeds wall clock
 * and the sum over single days equals the multi-day total.
 */
export async function getDailyAnalytics(userId: string, range: ISTDateRange, now = new Date()) {
  const { start, end } = range;
  const [items, protectedWork] = await Promise.all([
    loadResolvedActivities(userId, start, end),
    prisma.deepWorkSession.findMany({
      where: {
        userId,
        startedAt: { lt: end },
        OR: [{ endedAt: null }, { endedAt: { gt: start } }],
      },
      select: { startedAt: true, endedAt: true },
    }),
  ]);

  const totals = summarizeActivities(items);
  const sessionIds = [...new Set(items.map((item) => item.activity.sessionId))];
  const sessionActiveMs = activeMsBySession(items);
  const sessions = sessionIds.length
    ? await prisma.session.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, burnoutScore: true, entropyScore: true },
      })
    : [];

  // Session-level scores are weighted by the session's active time inside the range.
  let weightedBurnout = 0;
  let weightedEntropy = 0;
  let totalMetricWeight = 0;
  for (const session of sessions) {
    const weight = sessionActiveMs.get(session.id) ?? 0;
    if (weight <= 0) continue;
    weightedBurnout += (session.burnoutScore ?? 0) * weight;
    weightedEntropy += (session.entropyScore ?? 0) * weight;
    totalMetricWeight += weight;
  }

  const totalSessions = sessionIds.length;
  const totalSwitches = totals.switches;
  const averageFocus = focusScoreOf(totals);
  const averageBurnout = totalMetricWeight > 0 ? weightedBurnout / totalMetricWeight : 0;
  const averageEntropy = totalMetricWeight > 0 ? weightedEntropy / totalMetricWeight : 0;
  const totalActiveSeconds = Math.round(totals.activeMs / 1000);
  const totalIdleSeconds = Math.round(totals.idleMs / 1000);
  const trackedSeconds = totalActiveSeconds + totalIdleSeconds;
  const idleRatio = trackedSeconds > 0 ? totalIdleSeconds / trackedSeconds : 0;
  const activeHours = totalActiveSeconds / 3600;
  const switchesPerHour = activeHours > 0 ? totalSwitches / activeHours : 0;

  const breakBalance = trackedSeconds < 15 * 60
    ? 0
    : idleRatio < 0.15
      ? Math.min(100, (idleRatio / 0.15) * 100)
      : idleRatio <= 0.3
        ? 100
        : Math.max(20, 100 - ((idleRatio - 0.3) / 0.5) * 80);
  const strainReserve = Math.max(0, 100 - averageBurnout);
  const stability = Math.max(0, 100 - averageEntropy);
  const switchControl = Math.max(0, Math.min(100, 100 - ((switchesPerHour - 8) / 22) * 100));
  const recoveryScore = trackedSeconds < 15 * 60
    ? 0
    : Math.max(0, Math.min(100,
        strainReserve * 0.3 +
        stability * 0.2 +
        averageFocus * 0.2 +
        breakBalance * 0.15 +
        switchControl * 0.15
      ));

  const recoveryStatus = trackedSeconds < 15 * 60
    ? "Building baseline"
    : recoveryScore >= 75
      ? "Ready"
      : recoveryScore >= 55
        ? "Balanced"
        : recoveryScore >= 35
          ? "Recovery due"
          : "Overextended";

  let recoveryAction = "Pace is sustainable. Keep the next block intentional.";
  if (trackedSeconds < 15 * 60) recoveryAction = "Keep tracking to establish today's baseline.";
  else if (averageBurnout >= 65) recoveryAction = "Take a 10-15 minute off-screen recovery break.";
  else if (idleRatio < 0.08 && activeHours >= 1.5) recoveryAction = "Add a short recovery gap before the next work block.";
  else if (averageEntropy >= 65 || switchesPerHour >= 24) recoveryAction = "Reduce switching and protect one single-context block.";
  else if (averageFocus < 45) recoveryAction = "Reset around one clear task before adding more work.";

  const rangeEndMs = Math.min(end.getTime(), now.getTime());
  const protectedInRange = protectedWork
    .map((session) => overlapMs(
      session.startedAt.getTime(),
      (session.endedAt ?? now).getTime(),
      start.getTime(),
      rangeEndMs
    ))
    .filter((ms) => ms > 0);
  const totalDeepWorkSeconds = protectedInRange.reduce((sum, ms) => sum + ms / 1000, 0);

  return {
    totalSessions,
    totalSwitches,
    totalIdleSeconds,
    totalActiveSeconds,
    averageFocusScore: Number(averageFocus.toFixed(2)),
    averageBurnoutScore: Number(averageBurnout.toFixed(2)),
    appUsage: totals.appUsage,
    productivityBreakdown: {
      productiveCount: totals.productiveCount,
      distractingCount: totals.distractingCount,
      neutralCount: totals.neutralCount,
      productiveDurationMs: totals.productiveMs,
      distractingDurationMs: totals.distractingMs,
      neutralDurationMs: totals.neutralMs,
    },
    averageEntropyScore: Number(averageEntropy.toFixed(2)),
    deepWorkSessions: protectedInRange.length,
    totalDeepWorkSeconds: Math.round(totalDeepWorkSeconds),
    recovery: {
      score: Number(recoveryScore.toFixed(1)),
      status: recoveryStatus,
      action: recoveryAction,
      continuouslyUpdated: true,
      factors: {
        breakBalance: Number(breakBalance.toFixed(1)),
        strainReserve: Number(strainReserve.toFixed(1)),
        stability: Number(stability.toFixed(1)),
        switchControl: Number(switchControl.toFixed(1)),
      },
      idleRatio: Number((idleRatio * 100).toFixed(1)),
      switchesPerHour: Number(switchesPerHour.toFixed(1)),
    },
    range: { from: range.from, to: range.to, days: range.days },
  };
}

// ─── Deep Work Streak ───────────────────────────────────

/**
 * Deep-work streak in IST days, ending on `todayKey`. A day counts once it
 * holds DEEP_WORK_DAY_THRESHOLD_MS of deep_work time (idle overlaps removed),
 * the same quantity the dashboard growth chart reports as deepWorkMinutes.
 */
export async function getDeepWorkStreakDays(userId: string, todayKey = toISTDateKey(new Date())): Promise<StreakResult> {
  const end = istDayStart(addDaysToDateKey(todayKey, 1));
  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { lt: end },
      OR: [{ category: "deep_work" }, { category: "idle" }, { type: "idle" }, { appName: "System Idle" }],
    },
    orderBy: { startTime: "asc" },
  });
  if (!activities.some((activity) => activity.category === "deep_work")) return { current: 0, longest: 0 };
  const items = resolveActivityTime(activities, activities[0].startTime.getTime(), end.getTime());
  return deepWorkStreak(deepWorkMsByISTDay(items), todayKey, todayKey >= toISTDateKey(new Date()));
}

export async function getDeepWorkStreak(userId: string, todayKey?: string) {
  const streak = await getDeepWorkStreakDays(userId, todayKey);
  return { currentStreak: streak.current, longestStreak: streak.longest };
}

// ─── Heatmap ────────────────────────────────────────────

type HeatmapBucket = {
  totalProductivity: number;
  totalFocus: number;
  totalMs: number;
  idleMs: number;
  appDurations: Record<string, number>;
  appCategoryDurations: Record<string, Record<string, number>>;
  categoryDurations: Record<string, number>;
  intentDurations: Record<string, number>;
};

/** Bucket resolved activity time into IST (date, hour) cells; every cell is at most one hour. */
function buildHourBuckets(items: EffectiveActivity<Activity>[], categoryFilter?: string | null) {
  const heatmap: Record<string, Record<number, HeatmapBucket>> = {};

  for (const item of items) {
    const { activity } = item;
    if (categoryFilter && activity.category !== categoryFilter) continue;

    const score = getActivityProductivityScore(activity);
    const focusImpact = getBaseFocus(activity);
    const appName = activity.appName ?? "Unknown";
    const category = activity.category ?? "unknown";
    const intent = activity.intent ?? "unknown";

    for (const segment of item.segments) {
      let current = segment.startMs;
      while (current < segment.endMs) {
        const segmentEnd = Math.min(nextISTHourBoundary(current), segment.endMs);
        const segmentMs = segmentEnd - current;
        const dateKey = toISTDateKey(current);
        const hour = getISTHour(current);

        if (!heatmap[dateKey]) heatmap[dateKey] = {};
        if (!heatmap[dateKey][hour]) {
          heatmap[dateKey][hour] = {
            totalProductivity: 0,
            totalFocus: 0,
            totalMs: 0,
            idleMs: 0,
            appDurations: {},
            appCategoryDurations: {},
            categoryDurations: {},
            intentDurations: {},
          };
        }

        const bucket = heatmap[dateKey][hour];
        bucket.totalProductivity += score * segmentMs;
        bucket.totalFocus += focusImpact * segmentMs;
        bucket.totalMs += segmentMs;
        if (item.idle) bucket.idleMs += segmentMs;

        bucket.appDurations[appName] = (bucket.appDurations[appName] || 0) + segmentMs;
        if (!bucket.appCategoryDurations[appName]) bucket.appCategoryDurations[appName] = {};
        bucket.appCategoryDurations[appName][category] =
          (bucket.appCategoryDurations[appName][category] || 0) + segmentMs;
        bucket.categoryDurations[category] = (bucket.categoryDurations[category] || 0) + segmentMs;
        bucket.intentDurations[intent] = (bucket.intentDurations[intent] || 0) + segmentMs;

        current = segmentEnd;
      }
    }
  }

  return heatmap;
}

const getDominantKey = (values: Record<string, number>) => {
  const [key] = Object.entries(values).sort((a, b) => b[1] - a[1])[0] ?? [];
  return key ?? null;
};

const getTopEntries = (values: Record<string, number>, totalMs: number, limit: number) =>
  Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, duration]) => ({
      name,
      duration,
      minutes: Number((duration / 60000).toFixed(1)),
      percentage: totalMs > 0 ? Number(((duration / totalMs) * 100).toFixed(1)) : 0,
    }));

const getTopApps = (
  values: Record<string, number>,
  categoriesByApp: Record<string, Record<string, number>>,
  totalMs: number,
  limit: number
) => getTopEntries(values, totalMs, limit).map((app) => {
  const categories = getTopEntries(categoriesByApp[app.name] ?? {}, app.duration, limit);
  return {
    ...app,
    category: categories[0]?.name ?? "unknown",
    categories,
  };
});

/** Legacy all-time heatmap (no range, no color mode). */
export async function getHeatmap(userId: string) {
  const activities = await prisma.activity.findMany({
    where: { session: { userId }, duration: { gt: 0 } },
    orderBy: { startTime: "asc" },
  });
  if (activities.length === 0) return {};
  const lastEnd = Math.max(...activities.map((activity) => activity.endTime.getTime()));
  const items = resolveActivityTime(activities, activities[0].startTime.getTime(), lastEnd);
  const heatmap = buildHourBuckets(items);

  const finalHeatmap: Record<string, Record<number, any>> = {};
  Object.entries(heatmap).forEach(([date, hours]) => {
    finalHeatmap[date] = {};
    Object.entries(hours).forEach(([hour, data]) => {
      // RAW SCORE — no cap. If metric engine returns 1.2, we show 1.2
      const rawScore = data.totalMs > 0 ? data.totalProductivity / data.totalMs : 0;

      finalHeatmap[date][Number(hour)] = {
        score: rawScore,
        productivity: rawScore,
        duration: data.totalMs,
        trackedMinutes: Number((data.totalMs / 60000).toFixed(1)),
        idleMinutes: Number((data.idleMs / 60000).toFixed(1)),
        dominantApp: getDominantKey(data.appDurations),
        dominantCategory: getDominantKey(data.categoryDurations),
        dominantIntent: getDominantKey(data.intentDurations),
        topApps: getTopApps(data.appDurations, data.appCategoryDurations, data.totalMs, 3),
        categoryBreakdown: getTopEntries(data.categoryDurations, data.totalMs, 3),
        intentBreakdown: getTopEntries(data.intentDurations, data.totalMs, 3),
      };
    });
  });

  return finalHeatmap;
}

// ═══════════════════════════════════════════════════════════
//  HEATMAP V2 — date ranges, color-by modes, category filter
// ═══════════════════════════════════════════════════════════

export const HEATMAP_COLOR_MODES = ["score", "productivity", "duration", "focus", "idle"] as const;
export type HeatmapColorMode = (typeof HEATMAP_COLOR_MODES)[number];

interface HeatmapV2Options {
  userId: string;
  /** Inclusive IST day range; activity time is clipped to it. */
  range: ISTDateRange;
  colorMode?: HeatmapColorMode;
  categoryFilter?: string | null;
}

export async function getHeatmapV2(options: HeatmapV2Options) {
  const { userId, range, colorMode = "score", categoryFilter } = options;
  const items = await loadResolvedActivities(userId, range.start, range.end);
  const heatmap = buildHourBuckets(items, categoryFilter);

  const finalHeatmap: Record<string, Record<number, any>> = {};

  Object.entries(heatmap).forEach(([date, hours]) => {
    finalHeatmap[date] = {};
    Object.entries(hours).forEach(([hour, data]) => {
      const rawScore = data.totalMs > 0 ? data.totalProductivity / data.totalMs : 0;
      const rawFocus = data.totalMs > 0 ? data.totalFocus / data.totalMs : 0;
      const idleRatio = data.totalMs > 0 ? data.idleMs / data.totalMs : 0;

      // Compute color value based on mode
      let colorValue = rawScore;
      if (colorMode === "focus") colorValue = rawFocus;
      else if (colorMode === "duration") colorValue = data.totalMs / 3600000; // hours
      else if (colorMode === "idle") colorValue = idleRatio;
      // productivity = rawScore (default)

      finalHeatmap[date][Number(hour)] = {
        score: rawScore,
        productivity: rawScore,
        focus: rawFocus,
        duration: data.totalMs,
        idleRatio,
        trackedMinutes: Number((data.totalMs / 60000).toFixed(1)),
        idleMinutes: Number((data.idleMs / 60000).toFixed(1)),
        colorValue,              // ← what the grid uses for coloring
        colorMode,               // ← so frontend knows what it's looking at
        dominantApp: getDominantKey(data.appDurations),
        dominantCategory: getDominantKey(data.categoryDurations),
        dominantIntent: getDominantKey(data.intentDurations),
        topApps: getTopApps(data.appDurations, data.appCategoryDurations, data.totalMs, 5),
        categoryBreakdown: getTopEntries(data.categoryDurations, data.totalMs, 5),
        intentBreakdown: getTopEntries(data.intentDurations, data.totalMs, 5),
      };
    });
  });

  return finalHeatmap;
}
