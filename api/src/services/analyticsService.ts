import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  getActivityProductivityScore,
  isIdleActivity
} from "./metricEngine";

// ─── IST Helpers ────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIST(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function fromIST(istDate: Date): Date {
  return new Date(istDate.getTime() - IST_OFFSET_MS);
}

function getISTDayRange(date?: Date) {
  const base = date ? new Date(date) : new Date();
  const ist = toIST(base);
  ist.setUTCHours(0, 0, 0, 0);
  const start = fromIST(ist);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function getISTDateKey(date: Date): string {
  const ist = toIST(date);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

// ─── Daily Analytics ────────────────────────────────────

export async function getDailyAnalytics(userId: string) {
  const { start, end } = getISTDayRange();

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startTime: { gte: start, lt: end },
    },
    include: { activities: true },
  });

  let totalSwitches = 0;
  let totalIdleMs = 0;
  let totalFocusScore = 0;
  let totalBurnout = 0;
  let totalActiveSeconds = 0;
  let totalDeepWorkSeconds = 0;
  let deepWorkSessions = 0;
  let totalEntropy = 0;

  let productiveCount = 0;
  let distractingCount = 0;
  let neutralCount = 0;
  const appUsage: Record<string, number> = {};

  sessions.forEach((session) => {
    totalSwitches += session.switchCount;
    totalIdleMs += session.idleTime;
    totalFocusScore += session.focusScore;
    totalBurnout += session.burnoutScore ?? 0;
    totalEntropy += session.entropyScore ?? 0;

    if (session.isDeepWork) {
      deepWorkSessions++;
      if (session.endTime) {
        const duration = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
        totalDeepWorkSeconds += duration;
      }
    }

    session.activities.forEach((activity) => {
      appUsage[activity.appName] = (appUsage[activity.appName] || 0) + 1;
      if (activity.category === "productive") productiveCount++;
      if (activity.category === "distracting") distractingCount++;
      if (activity.category === "neutral") neutralCount++;
    });

    if (session.endTime) {
      const duration = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
      totalActiveSeconds += duration;
    }
  });

  const totalSessions = sessions.length;
  const averageFocus = totalSessions > 0 ? totalFocusScore / totalSessions : 0;
  const averageBurnout = totalSessions > 0 ? totalBurnout / totalSessions : 0;

  return {
    totalSessions,
    totalSwitches,
    totalIdleSeconds: Math.round(totalIdleMs / 1000),
    totalActiveSeconds,
    averageFocusScore: Number(averageFocus.toFixed(2)),
    averageBurnoutScore: Number(averageBurnout.toFixed(2)),
    appUsage,
    productivityBreakdown: { productiveCount, distractingCount, neutralCount },
    averageEntropyScore: totalSessions > 0 ? Number((totalEntropy / totalSessions).toFixed(2)) : 0,
  };
}

// ─── Deep Work Streak ───────────────────────────────────

export async function getDeepWorkStreak(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, isDeepWork: true },
    orderBy: { startTime: "asc" },
  });

  if (sessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const deepWorkDays = new Set<string>();
  sessions.forEach((s) => deepWorkDays.add(getISTDateKey(s.startTime)));

  const sortedDays = Array.from(deepWorkDays).sort();

  let longestStreak = 0;
  let temp = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      temp = 1;
    } else {
      const prev = new Date(sortedDays[i - 1] + "T00:00:00Z");
      const curr = new Date(sortedDays[i] + "T00:00:00Z");
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      temp = diff === 1 ? temp + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, temp);
  }

  const today = new Date();
  const todayIST = toIST(today);
  todayIST.setUTCHours(0, 0, 0, 0);

  let streak = 0;
  let check = new Date(todayIST.getTime());

  while (true) {
    const key = `${check.getUTCFullYear()}-${String(check.getUTCMonth() + 1).padStart(2, "0")}-${String(check.getUTCDate()).padStart(2, "0")}`;
    if (!deepWorkDays.has(key)) break;
    streak++;
    check.setUTCDate(check.getUTCDate() - 1);
  }

  return { currentStreak: streak, longestStreak };
}

// ─── Weekly Analytics ───────────────────────────────────

export async function getWeeklyAnalytics(userId: string) {
  const { start } = getISTDayRange();
  const startDate = new Date(start);
  startDate.setDate(startDate.getDate() - 6);

  const sessions = await prisma.session.findMany({
    where: { userId, startTime: { gte: startDate } },
  });

  const dailyMap: Record<string, any> = {};

  sessions.forEach((session) => {
    const dateKey = getISTDateKey(session.startTime);

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        focusTotal: 0,
        burnoutTotal: 0,
        entropyTotal: 0,
        deepWorkSeconds: 0,
        sessionCount: 0,
      };
    }

    dailyMap[dateKey].focusTotal += session.focusScore;
    dailyMap[dateKey].burnoutTotal += session.burnoutScore ?? 0;
    dailyMap[dateKey].entropyTotal += session.entropyScore ?? 0;
    dailyMap[dateKey].sessionCount++;

    if (session.isDeepWork && session.endTime) {
      const duration = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
      dailyMap[dateKey].deepWorkSeconds += duration;
    }
  });

  return Object.entries(dailyMap).map(([date, data]) => ({
    date,
    averageFocus: data.focusTotal / data.sessionCount,
    averageBurnout: data.burnoutTotal / data.sessionCount,
    averageEntropy: data.entropyTotal / data.sessionCount,
    deepWorkSeconds: data.deepWorkSeconds,
  }));
}

// ─── Heatmap ────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;

function getISTBucket(date: Date) {
  const ist = toIST(date);
  return {
    dateKey: `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`,
    hour: ist.getUTCHours(),
  };
}

function nextISTHourBoundary(date: Date) {
  const istMs = date.getTime() + IST_OFFSET_MS;
  const nextIstHour = Math.floor(istMs / HOUR_MS) * HOUR_MS + HOUR_MS;
  return new Date(nextIstHour - IST_OFFSET_MS);
}

export async function getHeatmap(userId: string) {
  const activities = await prisma.activity.findMany({
    where: { session: { userId }, duration: { gt: 0 } },
    orderBy: { startTime: "asc" },
  });

  const heatmap: Record<string, Record<number, any>> = {};

  for (const activity of activities) {
    const score = getActivityProductivityScore(activity);

    let current = new Date(activity.startTime);
    const end =
      activity.endTime > activity.startTime
        ? new Date(activity.endTime)
        : new Date(activity.startTime.getTime() + activity.duration);

    while (current < end) {
      const boundary = nextISTHourBoundary(current);
      const segmentEnd = boundary < end ? boundary : end;
      const segmentMs = segmentEnd.getTime() - current.getTime();

      const { dateKey, hour } = getISTBucket(current);

      if (!heatmap[dateKey]) heatmap[dateKey] = {};
      if (!heatmap[dateKey][hour]) {
        heatmap[dateKey][hour] = {
          totalProductivity: 0,
          totalMs: 0,
          idleMs: 0,
          appDurations: {},
          categoryDurations: {},
          intentDurations: {},
        };
      }

      const bucket = heatmap[dateKey][hour];
      const appName = activity.appName ?? "Unknown";
      const category = activity.category ?? "unknown";
      const intent = activity.intent ?? "unknown";

      bucket.totalProductivity += score * segmentMs;
      bucket.totalMs += segmentMs;

      if (isIdleActivity(activity)) {
        bucket.idleMs += segmentMs;
      }

      bucket.appDurations[appName] = (bucket.appDurations[appName] || 0) + segmentMs;
      bucket.categoryDurations[category] = (bucket.categoryDurations[category] || 0) + segmentMs;
      bucket.intentDurations[intent] = (bucket.intentDurations[intent] || 0) + segmentMs;

      current = segmentEnd;
    }
  }

  const getDominantKey = (values: Record<string, number>) => {
    const [key] = Object.entries(values).sort((a, b) => b[1] - a[1])[0] ?? [];
    return key ?? null;
  };

  const getTopEntries = (values: Record<string, number>, totalMs: number) =>
    Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, duration]) => ({
        name,
        duration,
        minutes: Number((duration / 60000).toFixed(1)),
        percentage: totalMs > 0 ? Number(((duration / totalMs) * 100).toFixed(1)) : 0,
      }));

  const finalHeatmap: Record<string, Record<number, any>> = {};

  Object.entries(heatmap).forEach(([date, hours]) => {
    finalHeatmap[date] = {};
    Object.entries(hours).forEach(([hour, data]) => {
      // RAW SCORE — no cap. If metric engine returns 1.2, we show 1.2
      const rawScore = data.totalMs > 0 ? data.totalProductivity / data.totalMs : 0;

      finalHeatmap[date][Number(hour)] = {
        score: rawScore,           // raw, uncapped
        productivity: rawScore,    // same as score
        duration: data.totalMs,
        trackedMinutes: Number((data.totalMs / 60000).toFixed(1)),
        idleMinutes: Number((data.idleMs / 60000).toFixed(1)),
        dominantApp: getDominantKey(data.appDurations),
        dominantCategory: getDominantKey(data.categoryDurations),
        dominantIntent: getDominantKey(data.intentDurations),
        topApps: getTopEntries(data.appDurations, data.totalMs),
        categoryBreakdown: getTopEntries(data.categoryDurations, data.totalMs),
        intentBreakdown: getTopEntries(data.intentDurations, data.totalMs),
      };
    });
  });

  return finalHeatmap;
}
// ═══════════════════════════════════════════════════════════
//  HEATMAP V2 — date ranges, color-by modes, category filter
// ═══════════════════════════════════════════════════════════

export type HeatmapColorMode = "score" | "productivity" | "duration" | "focus" | "idle";

interface HeatmapV2Options {
  userId: string;
  from?: string;        // ISO date string (inclusive)
  to?: string;          // ISO date string (inclusive)
  colorMode?: HeatmapColorMode;
  categoryFilter?: string | null;
}

export async function getHeatmapV2(options: HeatmapV2Options) {
  const { userId, from, to, colorMode = "score", categoryFilter } = options;

  // Build date filter
  const where: Prisma.ActivityWhereInput = {
    session: { userId },
    duration: { gt: 0 },
  };

  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from + "T00:00:00");
    if (to) where.startTime.lt = new Date(to + "T23:59:59.999");
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { startTime: "asc" },
  });

  const heatmap: Record<string, Record<number, any>> = {};

  for (const activity of activities) {
    // Category filter
    if (categoryFilter && activity.category !== categoryFilter) continue;

    const score = getActivityProductivityScore(activity);
    const focusImpact = activity.focusImpact ?? 0.5;

    let current = new Date(activity.startTime);
    const end =
      activity.endTime > activity.startTime
        ? new Date(activity.endTime)
        : new Date(activity.startTime.getTime() + activity.duration);

    while (current < end) {
      const boundary = nextISTHourBoundary(current);
      const segmentEnd = boundary < end ? boundary : end;
      const segmentMs = segmentEnd.getTime() - current.getTime();

      const { dateKey, hour } = getISTBucket(current);

      if (!heatmap[dateKey]) heatmap[dateKey] = {};
      if (!heatmap[dateKey][hour]) {
        heatmap[dateKey][hour] = {
          totalProductivity: 0,
          totalFocus: 0,
          totalMs: 0,
          idleMs: 0,
          appDurations: {},
          categoryDurations: {},
          intentDurations: {},
        };
      }

      const bucket = heatmap[dateKey][hour];
      const appName = activity.appName ?? "Unknown";
      const category = activity.category ?? "unknown";
      const intent = activity.intent ?? "unknown";

      bucket.totalProductivity += score * segmentMs;
      bucket.totalFocus += focusImpact * segmentMs;
      bucket.totalMs += segmentMs;

      if (isIdleActivity(activity)) {
        bucket.idleMs += segmentMs;
      }

      bucket.appDurations[appName] = (bucket.appDurations[appName] || 0) + segmentMs;
      bucket.categoryDurations[category] = (bucket.categoryDurations[category] || 0) + segmentMs;
      bucket.intentDurations[intent] = (bucket.intentDurations[intent] || 0) + segmentMs;

      current = segmentEnd;
    }
  }

  const getDominantKey = (values: Record<string, number>) => {
    const [key] = Object.entries(values).sort((a, b) => b[1] - a[1])[0] ?? [];
    return key ?? null;
  };

  const getTopEntries = (values: Record<string, number>, totalMs: number) =>
    Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, duration]) => ({
        name,
        duration,
        minutes: Number((duration / 60000).toFixed(1)),
        percentage: totalMs > 0 ? Number(((duration / totalMs) * 100).toFixed(1)) : 0,
      }));

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
        topApps: getTopEntries(data.appDurations, data.totalMs),
        categoryBreakdown: getTopEntries(data.categoryDurations, data.totalMs),
        intentBreakdown: getTopEntries(data.intentDurations, data.totalMs),
      };
    });
  });

  return finalHeatmap;
}