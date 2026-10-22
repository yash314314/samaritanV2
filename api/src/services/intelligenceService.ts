import type { Request, Response } from "express";
import type { Activity } from "@prisma/client";
import { prisma } from "../prisma";
import { clamp, getBaseFocus } from "./metricEngine";
import {
  DAY_MS,
  addDaysToDateKey,
  buildISTDateRange,
  istDayStart,
  lastISTDays,
  toISTDateKey,
  type ISTDateRange,
} from "../utils/time";
import {
  PRODUCTIVE_CATEGORIES,
  activeMsBySession,
  detectDeepWorkBlocks,
  energyScoreOf,
  focusScoreOf,
  intentDistribution,
  productivityScoreOf,
  rawEnergyOf,
  resolveActivityTime,
  sliceEffective,
  splitByISTDay,
  summarizeActivities,
  switchingRateOf,
  fragmentationScoreOf,
  peakProductiveHourOf,
  type ActivityTotals,
  type EffectiveActivity,
} from "./rangeMetrics";
import { findActivitiesOverlapping, loadResolvedActivities } from "./rangeActivityQuery";
import { getDeepWorkStreakDays } from "./analyticsService";

type Items = EffectiveActivity<Activity>[];

const MINUTE_MS = 60 * 1000;
/** Buckets with less active time than this report productivity as null (no signal). */
const MIN_SCORED_ACTIVE_MS = 1000;

/** Dashboard windows are 1-30 IST days ending on `toKey` (default today). */
export function clampDashboardDays(days: number | undefined, fallback: number) {
  if (days === undefined || !Number.isFinite(days)) return fallback;
  return Math.min(30, Math.max(1, Math.floor(days)));
}

function sliceRange(items: Items, range: ISTDateRange) {
  return sliceEffective(items, range.start.getTime(), range.end.getTime());
}

/* ---------- Assistant insights ---------- */

const EMPTY_ASSISTANT = {
  productivityScore: 0,
  focusScore: 0,
  deepWorkRatio: 0,
  communicationRatio: 0,
  fragmentationScore: 0,
  energyScore: 0,
  dominantIntent: "none",
  deepWorkSessions: 0,
  avgFocusBlockMinutes: 0,
  cognitiveStability: 0,
  switchingRate: 0,
  suggestion: "No structured work recorded yet."
};

/**
 * Scores are 0-100 over active (non-idle) time:
 *   focusScore        duration-weighted base focus
 *   productivityScore share of active time in productive categories
 *                     (same as /analytics/daily productivityBreakdown)
 *   energyScore       mean energy impact mapped to 0-100 (50 = neutral)
 */
function assistantFromItems(items: Items) {
  const totals = summarizeActivities(items);
  if (totals.activeMs <= 0) return { ...EMPTY_ASSISTANT };

  const deepWorkRatio = totals.deepWorkMs / totals.activeMs;
  const communicationRatio = totals.communicationMs / totals.activeMs;
  const focusScore = focusScoreOf(totals);
  const productivityScore = productivityScoreOf(totals);
  const switchingRate = switchingRateOf(totals);
  const fragmentationScore = fragmentationScoreOf(switchingRate);
  const cognitiveStability = Math.max(0, 100 - fragmentationScore);
  const energyScore = energyScoreOf(totals);
  const blocks = detectDeepWorkBlocks(items);
  const avgFocusBlock = blocks.length
    ? blocks.reduce((sum, block) => sum + block.duration, 0) / blocks.length
    : 0;
  const dominantIntent = intentDistribution(totals)[0]?.intent ?? "none";

  const suggestion = generateAssistantSuggestion({
    productivityScore,
    deepWorkRatio,
    communicationRatio,
    fragmentationScore,
    energy: rawEnergyOf(totals)
  });

  return {
    productivityScore: Number(productivityScore.toFixed(2)),
    focusScore: Number(focusScore.toFixed(2)),
    deepWorkRatio: Number((deepWorkRatio * 100).toFixed(2)),
    communicationRatio: Number((communicationRatio * 100).toFixed(2)),
    fragmentationScore: Number(fragmentationScore.toFixed(2)),
    energyScore: Number(energyScore.toFixed(2)),
    dominantIntent,
    deepWorkSessions: blocks.length,
    avgFocusBlockMinutes: Math.round(avgFocusBlock / 60000),
    switchingRate: Number(switchingRate.toFixed(2)),
    cognitiveStability: Number(cognitiveStability.toFixed(2)),
    suggestion
  };
}

export async function getAssistantInsights(userId: string, days?: number, toKey?: string) {
  const range = lastISTDays(clampDashboardDays(days, 1), toKey);
  return assistantFromItems(await loadResolvedActivities(userId, range.start, range.end));
}

function generateAssistantSuggestion(metrics: {
  productivityScore: number;
  deepWorkRatio: number;
  communicationRatio: number;
  fragmentationScore: number;
  energy: number;
}) {

  if (metrics.fragmentationScore > 60)
    return "High task fragmentation detected. Reduce switching and batch similar tasks.";

  if (metrics.communicationRatio > 0.45)
    return "Communication is dominating your day. Consider fixed message windows.";

  if (metrics.deepWorkRatio < 0.25)
    return "Deep work time is low. Schedule a 60-minute uninterrupted block.";

  if (metrics.energy < -0.4)
    return "Energy drain detected. Take a structured break before continuing.";

  if (metrics.productivityScore > 80)
    return "High-performance pattern detected. Protect this structure.";

  return "Work pattern stable. Maintain structure.";
}

/* ---------- Daily comparison ---------- */

function comparisonMetrics(totals: ActivityTotals) {
  if (totals.activeMs <= 0) {
    return { focus: 0, deepWork: 0, communication: 0, fragmentation: 0 };
  }
  return {
    focus: focusScoreOf(totals),
    deepWork: totals.deepWorkMs / totals.activeMs,
    communication: totals.communicationMs / totals.activeMs,
    fragmentation: switchingRateOf(totals)
  };
}

function comparisonFromItems(dayItems: Items, previousDayItems: Items) {
  const today = comparisonMetrics(summarizeActivities(dayItems));
  const yesterday = comparisonMetrics(summarizeActivities(previousDayItems));
  const change = today.focus - yesterday.focus;

  return {
    todayFocusScore: Number(today.focus.toFixed(2)),
    yesterdayFocusScore: Number(yesterday.focus.toFixed(2)),
    change: Number(change.toFixed(2)),
    reason: generateFocusReason(today, yesterday)
  };
}

/** Focus on IST day `toKey` (default today) against the IST day before it. */
export async function getDailyComparison(userId: string, toKey = toISTDateKey(new Date())) {
  const previousKey = addDaysToDateKey(toKey, -1);
  const window = buildISTDateRange(previousKey, toKey);
  const items = await loadResolvedActivities(userId, window.start, window.end);
  return comparisonFromItems(
    sliceRange(items, buildISTDateRange(toKey, toKey)),
    sliceRange(items, buildISTDateRange(previousKey, previousKey))
  );
}

function generateFocusReason(today: any, yesterday: any) {

  const insights: string[] = [];

  if (today.deepWork > yesterday.deepWork + 0.1)
    insights.push("longer deep-work blocks");

  if (today.communication > yesterday.communication + 0.1)
    insights.push("increased communication load");

  if (today.fragmentation > yesterday.fragmentation + 0.2)
    insights.push("higher task switching");

  if (today.deepWork < yesterday.deepWork - 0.1)
    insights.push("reduced deep-work time");

  if (insights.length === 0)
    return "Work pattern was similar to the previous day.";

  const summary = insights.join(" and ");
  return `${summary.charAt(0).toUpperCase()}${summary.slice(1)} than the previous day.`;

}

/* ---------- Growth trend ---------- */

type SessionScores = Map<string, { entropyScore: number; burnoutScore: number }>;

async function loadSessionScores(items: Items): Promise<SessionScores> {
  const ids = [...new Set(items.map((item) => item.activity.sessionId))];
  if (ids.length === 0) return new Map();
  const sessions = await prisma.session.findMany({
    where: { id: { in: ids } },
    select: { id: true, entropyScore: true, burnoutScore: true },
  });
  return new Map(sessions.map((session) => [session.id, {
    entropyScore: session.entropyScore ?? 0,
    burnoutScore: session.burnoutScore ?? 0,
  }]));
}

/** Session score weighted by each session's active time inside `items`. */
function weightedSessionScore(items: Items, scores: SessionScores, key: "entropyScore" | "burnoutScore") {
  let weighted = 0;
  let weight = 0;
  for (const [sessionId, ms] of activeMsBySession(items)) {
    const score = scores.get(sessionId);
    if (!score || ms <= 0) continue;
    weighted += score[key] * ms;
    weight += ms;
  }
  return weight > 0 ? weighted / weight : 0;
}

/**
 * One entry per IST day of the window. focus and productivity use the same
 * 0-100 definitions as assistant.focusScore / productivityScore.
 * trackedMinutes is ACTIVE (non-idle) time, matching /analytics/daily
 * totalActiveSeconds; idleMinutes carries the idle time separately.
 */
function growthFromItems(items: Items, range: ISTDateRange, scores: SessionScores) {
  return [...splitByISTDay(items, range.from, range.to).entries()].map(([date, dayItems]) => {
    const totals = summarizeActivities(dayItems);
    return {
      date,
      focus: Number(focusScoreOf(totals).toFixed(2)),
      productivity: Number(productivityScoreOf(totals).toFixed(2)),
      entropy: Number(weightedSessionScore(dayItems, scores, "entropyScore").toFixed(2)),
      trackedMinutes: Number((totals.activeMs / 60000).toFixed(1)),
      deepWorkMinutes: Number((totals.deepWorkMs / 60000).toFixed(1)),
      switches: totals.switches,
      idleMinutes: Number((totals.idleMs / 60000).toFixed(1)),
    };
  });
}

export async function getWeeklyGrowthTrend(userId: string, rangeDays = 7, toKey?: string) {
  const range = lastISTDays(clampDashboardDays(rangeDays, 7), toKey);
  const items = await loadResolvedActivities(userId, range.start, range.end);
  return growthFromItems(items, range, await loadSessionScores(items));
}

/* ---------- Intents ---------- */

/** Intent mix of active time; with no `days`, all history up to `toKey`. */
export async function getIntentHeatmap(userId: string, days?: number, toKey = toISTDateKey(new Date())) {
  const range = days === undefined
    ? { start: new Date(0), end: istDayStart(addDaysToDateKey(toKey, 1)) }
    : lastISTDays(clampDashboardDays(days, 7), toKey);
  const items = await loadResolvedActivities(userId, range.start, range.end);
  return intentDistribution(summarizeActivities(items));
}

/* ---------- Burnout ---------- */

function burnoutFromWeights(entries: Array<{ burnoutScore: number; entropyScore: number; activeMs: number }>) {
  const weighted = entries.filter((entry) => entry.activeMs > 0);
  const weight = weighted.reduce((sum, entry) => sum + entry.activeMs, 0);
  const avgBurnout = weight > 0 ? weighted.reduce((sum, entry) => sum + entry.burnoutScore * entry.activeMs, 0) / weight : 0;
  const avgEntropy = weight > 0 ? weighted.reduce((sum, entry) => sum + entry.entropyScore * entry.activeMs, 0) / weight : 0;
  const avgActiveMs = weighted.length ? weight / weighted.length : 0;

  let risk = "low";
  if (avgBurnout > 60) risk = "high";
  else if (avgBurnout > 35) risk = "moderate";

  const recommendation =
    risk === "high"
      ? "Reduce session length and introduce recovery breaks."
      : risk === "moderate"
      ? "Monitor workload and avoid late night work."
      : "Workload appears sustainable.";

  return {
    burnoutRisk: risk,
    burnoutScore: Number(avgBurnout.toFixed(2)),
    entropyLoad: Number(avgEntropy.toFixed(2)),
    avgSessionMinutes: Math.round(avgActiveMs / 60000),
    recommendation
  };
}

function burnoutFromItems(items: Items, scores: SessionScores) {
  return burnoutFromWeights([...activeMsBySession(items).entries()].map(([sessionId, activeMs]) => ({
    burnoutScore: scores.get(sessionId)?.burnoutScore ?? 0,
    entropyScore: scores.get(sessionId)?.entropyScore ?? 0,
    activeMs,
  })));
}

/**
 * Session burnout/entropy weighted by active time. With `days`, sessions with
 * active time in the window; without, the 10 most recent sessions.
 */
export async function getBurnoutRisk(userId: string, days?: number, toKey?: string) {
  if (days !== undefined) {
    const range = lastISTDays(clampDashboardDays(days, 7), toKey);
    const items = await loadResolvedActivities(userId, range.start, range.end);
    return burnoutFromItems(items, await loadSessionScores(items));
  }

  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { startTime: "desc" },
    take: 10,
    select: { burnoutScore: true, entropyScore: true, totalDuration: true, idleTime: true },
  });
  return burnoutFromWeights(sessions.map((session) => ({
    burnoutScore: session.burnoutScore ?? 0,
    entropyScore: session.entropyScore ?? 0,
    activeMs: Math.max(0, (session.totalDuration ?? 0) - (session.idleTime ?? 0)),
  })));
}

/* ---------- Daily focus trend ---------- */

const WORK_FOCUS_CATEGORIES = new Set([
  "deep_work",
  "research",
  "productivity",
  "development_tools"
]);

function getWorkFocusImpact(item: EffectiveActivity) {
  if (item.idle || !WORK_FOCUS_CATEGORIES.has(item.activity.category ?? "")) return 0;
  return getBaseFocus(item.activity);
}

/**
 * Buckets of `bucketMinutes` across the IST day `dateKey`. Every bucket only
 * holds time it owns (clipped, overlaps resolved), so duration <= bucket length.
 *   focus         work focus over all tracked time in the bucket (0-100)
 *   productivity  productive share of active time (0-100), null below 1s of active time
 *   activeFocus   focus over active time only (0-100), the definition of the
 *                 dashboard's focusScore; null below 1s of active time
 *   activeMinutes active (non-idle) minutes in the bucket
 */
export async function getDailyFocusTrend(userId: string, dateKey: string, bucketMinutes = 60) {
  const range = buildISTDateRange(dateKey, dateKey);
  const safeBucketMinutes = Number.isFinite(bucketMinutes)
    ? Math.min(60, Math.max(1, Math.floor(bucketMinutes)))
    : 60;
  const bucketMs = safeBucketMinutes * MINUTE_MS;
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  const bucketCount = Math.ceil(DAY_MS / bucketMs);
  const items = await loadResolvedActivities(userId, range.start, range.end);

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(startMs + index * bucketMs);
    const bucketEnd = new Date(Math.min(bucketStart.getTime() + bucketMs, endMs));
    const istMinutes = Math.round((bucketStart.getTime() - startMs) / MINUTE_MS);
    const hour = Math.floor(istMinutes / 60);
    const minute = istMinutes % 60;
    return {
      index,
      hour,
      minute,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      start: bucketStart,
      end: bucketEnd,
      focusWeighted: 0,
      activeFocusWeighted: 0,
      duration: 0,
      activeMs: 0,
      productiveMs: 0,
    };
  });

  for (const item of items) {
    const impact = getWorkFocusImpact(item);
    const productive = !item.idle && PRODUCTIVE_CATEGORIES.has(item.activity.category ?? "");
    const baseFocus = item.idle ? 0 : getBaseFocus(item.activity);
    for (const segment of item.segments) {
      let currentMs = segment.startMs;
      while (currentMs < segment.endMs) {
        const bucket = buckets[Math.floor((currentMs - startMs) / bucketMs)];
        if (!bucket) break;
        const segmentEndMs = Math.min(bucket.end.getTime(), segment.endMs);
        const segmentMs = segmentEndMs - currentMs;
        if (segmentMs <= 0) break;
        bucket.focusWeighted += impact * segmentMs;
        bucket.duration += segmentMs;
        if (!item.idle) {
          bucket.activeMs += segmentMs;
          bucket.activeFocusWeighted += baseFocus * segmentMs;
        }
        if (productive) bucket.productiveMs += segmentMs;
        currentMs = segmentEndMs;
      }
    }
  }

  return buckets.map((bucket) => ({
    index: bucket.index,
    hour: bucket.hour,
    minute: bucket.minute,
    label: bucket.label,
    start: bucket.start,
    end: bucket.end,
    duration: bucket.duration,
    focus: Number(clamp(bucket.duration > 0 ? (bucket.focusWeighted / bucket.duration) * 100 : 0).toFixed(2)),
    productivity: bucket.activeMs >= MIN_SCORED_ACTIVE_MS
      ? Number(clamp((bucket.productiveMs / bucket.activeMs) * 100).toFixed(2))
      : null,
    activeFocus: bucket.activeMs >= MIN_SCORED_ACTIVE_MS
      ? Number(clamp((bucket.activeFocusWeighted / bucket.activeMs) * 100).toFixed(2))
      : null,
    activeMinutes: Number((bucket.activeMs / 60000).toFixed(2)),
  }));
}

/* ---------- Weekly insights ---------- */

function weeklyFromItems(items: Items) {
  const totals = summarizeActivities(items);
  if (totals.activeMs <= 0) {
    return {
      weeklyFocusScore: 0,
      weeklyDeepWorkRatio: 0,
      weeklyCommunicationRatio: 0,
      peakProductiveHour: null
    };
  }
  return {
    weeklyFocusScore: Number(focusScoreOf(totals).toFixed(2)),
    weeklyDeepWorkRatio: Number(((totals.deepWorkMs / totals.activeMs) * 100).toFixed(2)),
    weeklyCommunicationRatio: Number(((totals.communicationMs / totals.activeMs) * 100).toFixed(2)),
    // IST hour-of-day holding the most productive-category time; null without any.
    peakProductiveHour: peakProductiveHourOf(items)
  };
}

export async function getWeeklyInsights(userId: string, days = 7, toKey?: string) {
  const range = lastISTDays(clampDashboardDays(days, 7), toKey);
  return weeklyFromItems(await loadResolvedActivities(userId, range.start, range.end));
}

/* ---------- Dashboard ---------- */

/**
 * All dashboard sections share one window: `days` IST days ending on `toKey`
 * (default today). Without `days`, assistant covers `toKey` only, weekly and
 * growth the last 7 days, intents all history, burnout the last 10 sessions.
 * comparison always compares `toKey` with the day before it.
 */
export async function getDashboard(userId: string, days?: number, toKey = toISTDateKey(new Date())) {
  const scopedDays = days === undefined ? undefined : clampDashboardDays(days, 7);
  const window = lastISTDays(scopedDays ?? 7, toKey);
  const assistantRange = lastISTDays(scopedDays ?? 1, toKey);
  const dayRange = buildISTDateRange(toKey, toKey);
  const previousKey = addDaysToDateKey(toKey, -1);
  const previousDayRange = buildISTDateRange(previousKey, previousKey);
  const loadStart = new Date(Math.min(window.start.getTime(), previousDayRange.start.getTime()));

  const [activities, intents, burnout, streak] = await Promise.all([
    findActivitiesOverlapping(userId, loadStart, window.end),
    scopedDays === undefined ? getIntentHeatmap(userId, undefined, toKey) : Promise.resolve(null),
    scopedDays === undefined ? getBurnoutRisk(userId) : Promise.resolve(null),
    getDeepWorkStreakDays(userId, toKey),
  ]);
  const loaded = resolveActivityTime(activities, loadStart.getTime(), window.end.getTime());
  const windowItems = sliceRange(loaded, window);
  const scores = await loadSessionScores(windowItems);

  return {
    assistant: assistantFromItems(sliceRange(loaded, assistantRange)),
    weekly: weeklyFromItems(windowItems),
    comparison: comparisonFromItems(sliceRange(loaded, dayRange), sliceRange(loaded, previousDayRange)),
    growth: growthFromItems(windowItems, window, scores),
    intents: intents ?? intentDistribution(summarizeActivities(windowItems)),
    burnout: burnout ?? burnoutFromItems(windowItems, scores),
    streak: {
      currentDeepWorkStreak: streak.current,
      longestDeepWorkStreak: streak.longest
    },
    meta: {
      generatedAt: new Date(),
      system: "samaritan-intelligence",
      days: scopedDays ?? null,
      from: window.from,
      to: window.to,
    }
  };
}

/** Deep-work streak in IST days (see getDeepWorkStreakDays). */
export async function getDeepWorkStreak(userId: string, toKey?: string) {
  const streak = await getDeepWorkStreakDays(userId, toKey);
  return {
    currentDeepWorkStreak: streak.current,
    longestDeepWorkStreak: streak.longest
  };
}

/* ---------- Daily summary ---------- */

export async function getDailySummary(userId: string, range: ISTDateRange) {
  const items = await loadResolvedActivities(userId, range.start, range.end);

  if (items.length === 0) {
    return { message: "No activity recorded." };
  }

  const totals = summarizeActivities(items);
  const blocks = detectDeepWorkBlocks(items);
  const longestFocusBlock = blocks.reduce((longest, block) => Math.max(longest, block.duration), 0);

  return {
    date: range.from,
    deepWorkHours: Number((totals.deepWorkMs / 3600000).toFixed(2)),
    focusScore: Number(focusScoreOf(totals).toFixed(2)),
    longestFocusBlockMinutes: Math.round(longestFocusBlock / 60000),
    totalActivities: items.length,
    dominantIntent: intentDistribution(totals)[0]?.intent ?? "idle"
  };
}

/* ---------- Legacy growth trend handler ---------- */

export async function getGrowthTrend(req: Request, res: Response) {

  const { userId } = req.query;

  try {

    const activities = await prisma.activity.findMany({
      where: {
        session: { userId: String(userId) }
      }
    });

    const result: Record<string, number> = {};

    activities.forEach((a) => {
      const day = toISTDateKey(a.startTime);
      result[day] = (result[day] ?? 0) + a.duration;
    });

    const trend = Object.entries(result).map(([date, value]) => ({
      date,
      duration: value
    }));

    res.json(trend);

  } catch (err) {

    res.status(500).json({ error: "Growth trend failed" });

  }

}
