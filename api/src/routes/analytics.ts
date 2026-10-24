import { Router } from "express";
import { prisma } from "../prisma";
import {
  HEATMAP_COLOR_MODES,
  getDailyAnalytics,
  getDeepWorkStreak,
  getHeatmapV2,
} from "../services/analyticsService";
import {
  getBurnoutRisk,
  getDailyFocusTrend,
  getAssistantInsights,
  getDashboard,
  getDailySummary
} from "../services/intelligenceService";
import { getTimeline } from "../services/timelineservice";
import { getFocusBlocks } from "../services/activityService";
import { loadResolvedActivities } from "../services/rangeActivityQuery";
import { focusScoreOf, summarizeActivities } from "../services/rangeMetrics";
import {
  DAY_MS,
  InvalidRequestError,
  getISTHour,
  getISTHourFraction,
  parseDateKey,
  resolveISTDateRange,
  toISTDateKey,
} from "../utils/time";
import { parseEnumParam, parseIntegerParam, parseUserId, sendRouteError } from "../utils/requestParams";

const router = Router();

// ─── RANGE ROUTES ───
// Dates are IST calendar days (YYYY-MM-DD); `from`/`to` are inclusive.

router.get("/daily", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const range = resolveISTDateRange(req.query);
    const [daily, streak] = await Promise.all([
      getDailyAnalytics(userId, range),
      getDeepWorkStreak(userId, range.to),
    ]);
    res.json({ ...daily, ...streak });
  } catch (error) {
    sendRouteError(res, error, "Server error", "Daily analytics error:");
  }
});

router.get("/daily-focus-trend", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const range = resolveISTDateRange({ date: req.query.date }, { maxDays: 1 });
    const bucketMinutes = parseIntegerParam(req.query.bucketMinutes, {
      name: "bucketMinutes",
      min: 1,
      max: 60,
      fallback: 60,
    });
    res.json(await getDailyFocusTrend(userId, range.from, bucketMinutes));
  } catch (error) {
    sendRouteError(res, error, "Daily focus trend failed", "Daily focus trend error:");
  }
});

router.get("/heatmap", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const range = resolveISTDateRange(req.query);
    const colorMode = parseEnumParam(req.query.colorMode, {
      name: "colorMode",
      allowed: HEATMAP_COLOR_MODES,
      fallback: "score",
    });
    const category = req.query.category;
    if (category !== undefined && typeof category !== "string") {
      throw new InvalidRequestError("Invalid category");
    }
    res.json(await getHeatmapV2({
      userId,
      range,
      colorMode,
      categoryFilter: category || null,
    }));
  } catch (error) {
    sendRouteError(res, error, "Server error", "Heatmap V2 error:");
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const days = req.query.days === undefined
      ? undefined
      : parseIntegerParam(req.query.days, { name: "days scope", min: 1, max: 30, fallback: 7 });
    const today = toISTDateKey(new Date());
    const to = req.query.to === undefined || req.query.to === "" ? today : parseDateKey(req.query.to, "to");
    if (to > today) throw new InvalidRequestError("Invalid to: date is in the future");
    res.json(await getDashboard(userId, days, to));
  } catch (error) {
    sendRouteError(res, error, "Server error", "Dashboard analytics error:");
  }
});

router.get("/timeline", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const range = resolveISTDateRange(req.query);
    res.json(await getTimeline(userId, range));
  } catch (error) {
    sendRouteError(res, error, "Server error", "Timeline error:");
  }
});

router.get("/focus-blocks", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const range = resolveISTDateRange({ date: req.query.date }, { required: true, maxDays: 1 });
    res.json(await getFocusBlocks(userId, range));
  } catch (error) {
    sendRouteError(res, error, "Server error", "Focus blocks error:");
  }
});

router.get("/daily-summary", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const range = resolveISTDateRange({ date: req.query.date }, { required: true, maxDays: 1 });
    res.json(await getDailySummary(userId, range));
  } catch (error) {
    sendRouteError(res, error, "Server error", "Daily summary error:");
  }
});

// ─── READINESS ROUTE ───
// All hours are IST, independent of the API host timezone.

router.get("/readiness", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const now = new Date();
    const windowStart = new Date(now.getTime() - DAY_MS);

    const [recentSessions, items, burnout, intel] = await Promise.all([
      prisma.session.findMany({
        where: {
          userId,
          startTime: { gte: windowStart }
        },
        orderBy: { startTime: "desc" },
        take: 10,
      }),
      loadResolvedActivities(userId, windowStart, now),
      getBurnoutRisk(userId).catch(() => null),
      getAssistantInsights(userId).catch(() => null),
    ]);

    const currentHour = getISTHourFraction(now);

    // Time of day factor (peak hours: 9-11, 14-16)
    const timeFactor = (currentHour >= 9 && currentHour <= 11) || (currentHour >= 14 && currentHour <= 16) ? 85 :
                       (currentHour >= 7 && currentHour <= 18) ? 60 : 30;

    // Focus of each recent session from its active (non-idle) time in the last 24h.
    const sessionFocus = new Map<string, number>();
    for (const session of recentSessions) {
      const totals = summarizeActivities(items.filter((item) => item.activity.sessionId === session.id));
      if (totals.activeMs > 0) sessionFocus.set(session.id, focusScoreOf(totals));
    }
    const activeSessions = recentSessions.filter((session) => sessionFocus.has(session.id));

    // Recent pattern (last session quality)
    const lastFocus = activeSessions.length ? sessionFocus.get(activeSessions[0].id)! : null;
    const recentPattern = lastFocus === null
      ? 50
      : lastFocus > 70 ? 80 : lastFocus > 50 ? 60 : 35;

    // Burnout buffer (inverted risk)
    const burnoutScore = burnout?.burnoutScore ?? 0;
    const burnoutFactor = burnoutScore > 70 ? 20 : burnoutScore > 40 ? 50 : 85;

    // Last session quality (today's deep work ratio from assistant insights)
    const deepWorkRatio = intel?.deepWorkRatio ?? 0;
    const lastFactor = deepWorkRatio > 40 ? 80 : deepWorkRatio > 20 ? 55 : 30;

    // Compute composite score
    const score = Math.round((timeFactor + recentPattern + burnoutFactor + lastFactor) / 4);

    // Risk factors
    const riskFactors: string[] = [];
    if (burnoutScore > 60) riskFactors.push("Elevated burnout risk detected");
    if (activeSessions.filter((session) => sessionFocus.get(session.id)! < 50).length >= 3) {
      riskFactors.push("Recent low-focus sessions");
    }
    if (currentHour < 7 || currentHour > 22) {
      riskFactors.push("Off-hours session");
    }

    // Recommended duration based on score
    const recommendedDuration = score >= 75 ? 90 : score >= 50 ? 60 : score >= 25 ? 30 : 0;

    // Best window (IST start hour of the best recent sessions, or default)
    let peakHour = 9;
    if (activeSessions.length > 0) {
      const hourScores: Record<number, { total: number; count: number }> = {};
      activeSessions.forEach((session) => {
        const hour = getISTHour(session.startTime);
        if (!hourScores[hour]) hourScores[hour] = { total: 0, count: 0 };
        hourScores[hour].total += sessionFocus.get(session.id)!;
        hourScores[hour].count += 1;
      });
      let bestScore = -1;
      Object.entries(hourScores).forEach(([hour, data]) => {
        const avg = data.total / data.count;
        if (avg > bestScore) {
          bestScore = avg;
          peakHour = Number(hour);
        }
      });
    }
    const bestWindow = score >= 50 ? {
      start: peakHour,
      end: peakHour + 3
    } : null;

    res.json({
      score,
      factors: {
        timeOfDay: timeFactor,
        recentPattern,
        burnoutRisk: burnoutFactor,
        lastSessionQuality: lastFactor,
      },
      recommendedDuration,
      bestWindow,
      riskFactors,
      metadata: {
        computedAt: now.toISOString(),
        sessionCount: recentSessions.length,
        currentHour: Math.floor(currentHour),
        timezone: "Asia/Kolkata",
      }
    });

  } catch (error) {
    sendRouteError(res, error, "Failed to compute readiness score", "Readiness route error:");
  }
});

export default router;
