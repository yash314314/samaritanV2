import { Router } from "express";
import type { Session } from "@prisma/client";
import { prisma } from "../prisma";
import { 
  getDailyAnalytics, 
  getDeepWorkStreak,
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

const router = Router();

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ EXISTING ROUTES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

router.get("/daily", async (req, res) => {
  const { userId, date, from, to } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const daily = await getDailyAnalytics(
      userId,
      typeof from === "string" ? from : typeof date === "string" ? date : undefined,
      typeof to === "string" ? to : undefined,
    );
    const streak = await getDeepWorkStreak(userId);
    res.json({ ...daily, ...streak });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/daily-focus-trend", async (req, res) => {
  try {
    const { userId, date, bucketMinutes } = req.query;
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
    const data = await getDailyFocusTrend(
      userId,
      typeof date === "string" ? date : undefined,
      bucketMinutes ? Number(bucketMinutes) : 60
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Daily focus trend failed" });
  }
});

import { getHeatmapV2, type HeatmapColorMode } from "../services/analyticsService";

router.get("/heatmap", async (req, res) => {
  const { userId, from, to, colorMode, category } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const heatmap = await getHeatmapV2({
      userId,
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
      colorMode: (colorMode as HeatmapColorMode) ?? "score",
      categoryFilter: typeof category === "string" ? category : null,
    });
    res.json(heatmap);
  } catch (error) {
    console.error("Heatmap V2 error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/dashboard", async (req, res) => {
  const { userId, days } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const parsedDays = days === undefined ? undefined : Math.min(30, Math.max(1, Math.floor(Number(days))));
    if (days !== undefined && !Number.isFinite(parsedDays)) return res.status(400).json({ error: "Invalid days scope" });
    const data = await getDashboard(userId, parsedDays);
    res.json(data);
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/timeline", async (req, res) => {
  const { userId, date, from, to } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const data = await getTimeline(
      userId,
      typeof date === "string" ? date : undefined,
      typeof from === "string" ? from : undefined,
      typeof to === "string" ? to : undefined,
    );
    res.json(data);
  } catch (error) {
    console.error("Timeline error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/focus-blocks", async (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const blocks = await getFocusBlocks(userId as string, date as string);
  res.json(blocks);
});

router.get("/daily-summary", async (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const summary = await getDailySummary(userId as string, date as string);
  res.json(summary);
});

// â”€â”€â”€ READINESS ROUTE â”€â”€â”€

router.get("/readiness", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // Get recent sessions (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSessions = await prisma.session.findMany({
      where: { 
        userId,
        startTime: { gte: yesterday }
      },
      orderBy: { startTime: "desc" },
      take: 10,
    });

    const burnout = await getBurnoutRisk(userId).catch(() => null);
    const intel = await getAssistantInsights(userId).catch(() => null);

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // Time of day factor (peak hours: 9-11, 14-16)
    const timeFactor = (currentHour >= 9 && currentHour <= 11) || (currentHour >= 14 && currentHour <= 16) ? 85 :
                       (currentHour >= 7 && currentHour <= 18) ? 60 : 30;

    // Recent pattern (last session quality)
    const lastSession = recentSessions[0];
    const recentPattern = lastSession 
      ? (lastSession.focusScore > 70 ? 80 : lastSession.focusScore > 50 ? 60 : 35)
      : 50;

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
    if (recentSessions.length > 0 && recentSessions.filter(s => s.focusScore < 50).length >= 3) {
      riskFactors.push("Recent low-focus sessions");
    }
    if (currentHour < 7 || currentHour > 22) {
      riskFactors.push("Off-hours session");
    }

    // Recommended duration based on score
    const recommendedDuration = score >= 75 ? 90 : score >= 50 ? 60 : score >= 25 ? 30 : 0;

    // Best window (peak hour from recent sessions, or default)
    let peakHour = 9;
    if (recentSessions.length > 0) {
      const hourScores: Record<number, { total: number; count: number }> = {};
      recentSessions.forEach((s) => {
        const hour = new Date(s.startTime).getHours();
        if (!hourScores[hour]) hourScores[hour] = { total: 0, count: 0 };
        hourScores[hour].total += s.focusScore;
        hourScores[hour].count += 1;
      });
      let bestScore = 0;
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
        computedAt: new Date().toISOString(),
        sessionCount: recentSessions.length,
        currentHour: Math.floor(currentHour),
      }
    });

  } catch (error) {
    console.error("Readiness route error:", error);
    res.status(500).json({ error: "Failed to compute readiness score" });
  }
});

export default router;
