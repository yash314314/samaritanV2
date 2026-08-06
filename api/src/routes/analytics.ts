import { Router } from "express";
import type { Session } from "@prisma/client";
import { prisma } from "../prisma";
import { 
  getDailyAnalytics, 
  getDeepWorkStreak,
  getWeeklyAnalytics, 
  getHeatmap 
} from "../services/analyticsService";

import {
  getDailyComparison,
  getWeeklyGrowthTrend,
  getIntentHeatmap,
  getBurnoutRisk,
  getGrowthTrend,
  getDailyFocusTrend,
  getAssistantInsights,
  getDashboard,
  getDailySummary
} from "../services/intelligenceService";

import { getTimeline } from "../services/timelineservice";
import { getFocusBlocks } from "../services/activityService";

const router = Router();

// ─── EXISTING ROUTES ───

router.get("/compare", async (req, res) => {
  const { userId } = req.query;
  const data = await getDailyComparison(userId as string);
  res.json(data);
});

router.get("/growth", async (req, res) => {
  const { userId } = req.query;
  const data = await getWeeklyGrowthTrend(userId as string);
  res.json(data);
});

router.get("/intents", async (req, res) => {
  const { userId } = req.query;
  const data = await getIntentHeatmap(userId as string);
  res.json(data);
});

router.get("/burnout", async (req, res) => {
  const { userId } = req.query;
  const data = await getBurnoutRisk(userId as string);
  res.json(data);
});

router.get("/daily", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const daily = await getDailyAnalytics(userId);
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

router.get("/weekly", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const weekly = await getWeeklyAnalytics(userId);
    res.json(weekly);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
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

router.get("/assistant", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const insights = await getAssistantInsights(userId);
    res.json(insights);
  } catch (error) {
    console.error("Assistant analytics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/dashboard", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }
  try {
    const data = await getDashboard(userId);
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

// ─── ENHANCED INTELLIGENCE ROUTE ───

router.get("/intelligence", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // ─── EXISTING: Regular Sessions ───
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { startTime: "asc" },
      include: {
        activities: {
          orderBy: { startTime: "asc" }
        }
      }
    });

    // ─── NEW: Deep Work Sessions (last 30 days) ───
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const deepWorkSessions = await prisma.deepWorkSession.findMany({
      where: { 
        userId, 
        startedAt: { gte: thirtyDaysAgo } 
      },
      orderBy: { startedAt: "desc" },
      include: { 
        interventions: { orderBy: { detectedAt: "asc" } },
        minuteLogs: { orderBy: { minuteIndex: "asc" } }
      }
    });

    const activeDeepWork = await prisma.deepWorkSession.findFirst({
      where: { userId, status: "active" },
      include: {
        interventions: { orderBy: { detectedAt: "asc" } },
      },
    });

    // ─── EXISTING COMPUTATIONS (preserved exactly) ───
    let declines = 0;
    for (let i = 1; i < sessions.length; i++) {
      if (sessions[i].focusScore < sessions[i - 1].focusScore) declines++;
    }
    const driftScore = (declines / Math.max(1, sessions.length - 1)) * 100;

    let entropyRise = 0;
    for (let i = 1; i < sessions.length; i++) {
      if (sessions[i].entropyScore > sessions[i - 1].entropyScore) entropyRise++;
    }
    const entropyTrend = (entropyRise / Math.max(1, sessions.length - 1)) * 100;

    const hourMap: Record<number, { total: number; count: number }> = {};
    sessions.forEach((session: Session) => {
      const hour = new Date(session.startTime).getHours();
      if (!hourMap[hour]) hourMap[hour] = { total: 0, count: 0 };
      hourMap[hour].total += session.focusScore;
      hourMap[hour].count += 1;
    });
    let peakHour = null;
    let bestScore = 0;
    Object.entries(hourMap).forEach(([hour, data]) => {
      const avg = data.total / data.count;
      if (avg > bestScore) { bestScore = avg; peakHour = Number(hour); }
    });

    const highPerformanceSessions = sessions.filter(s => s.focusScore > 75 && s.burnoutScore < 40).length;
    const highPerformanceProbability = sessions.length > 0 ? highPerformanceSessions / sessions.length : 0;

    const cognitiveStability = Math.max(0, 100 - driftScore);

    let rapidSwitches = 0;
    let totalActivityGaps = 0;
    sessions.forEach(session => {
      const activities = session.activities || [];
      for (let i = 1; i < activities.length; i++) {
        const gap = new Date(activities[i].startTime).getTime() - new Date(activities[i - 1].endTime).getTime();
        if (gap < 5 * 60 * 1000) rapidSwitches++;
        totalActivityGaps++;
      }
    });
    const fragmentationScore = totalActivityGaps > 0 ? (rapidSwitches / totalActivityGaps) * 100 : 0;

    const totalHours = sessions.reduce((sum, s) => {
      if (!s.endTime) return sum;
      const duration = s.endTime.getTime() - s.startTime.getTime();
      return sum + duration / (1000 * 60 * 60);
    }, 0);
    const totalActivities = sessions.reduce((sum, s) => sum + (s.activities?.length || 0), 0);
    const switchingRate = totalHours > 0 ? totalActivities / totalHours : 0;

    const deepWorkThreshold = 45;
    const deepWorkSessionsRegular = sessions.filter(s => {
      if (!s.endTime) return false;
      const duration = s.endTime.getTime() - s.startTime.getTime();
      return duration >= deepWorkThreshold * 60 * 1000 && s.focusScore > 70;
    }).length;
    const deepWorkRatio = sessions.length > 0 ? (deepWorkSessionsRegular / sessions.length) * 100 : 0;

    const focusBlocks = sessions.filter(s => s.focusScore > 60);
    const avgFocusBlockMinutes = focusBlocks.length > 0
      ? focusBlocks.reduce((sum, s) => {
          if (!s.endTime) return sum;
          return sum + (s.endTime.getTime() - s.startTime.getTime());
        }, 0) / (focusBlocks.length * 60 * 1000)
      : 0;

    const avgBurnout = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + s.burnoutScore, 0) / sessions.length 
      : 0;
    const energyScore = -((avgBurnout - 50) / 50);

    const communicationActivities = sessions.reduce((sum, s) => {
      const comms = (s.activities || []).filter((a: any) => {
        const intent = (a.intent || "").toLowerCase();
        return intent.includes("chat") || intent.includes("email") || intent.includes("meeting") || intent.includes("call");
      }).length;
      return sum + comms;
    }, 0);
    const totalActivityCount = sessions.reduce((sum, s) => sum + (s.activities?.length || 0), 0);
    const communicationRatio = totalActivityCount > 0 ? (communicationActivities / totalActivityCount) * 100 : 0;

    const productivityScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.productivityScore || s.focusScore * 0.8), 0) / sessions.length
      : 0;
    const focusScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length
      : 0;

    // ─── NEW: Deep Work Computations ───
    const completedDWS = deepWorkSessions.filter(s => s.status === "completed");
    const abandonedDWS = deepWorkSessions.filter(s => s.status === "abandoned");

    const totalPlannedMinutes = deepWorkSessions.reduce((sum, s) => sum + (s.plannedMinutes || 0), 0);
    const totalActualMinutes = completedDWS.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      return sum + ((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / (60 * 1000));
    }, 0);

    const avgDWFocus = deepWorkSessions.length > 0
      ? deepWorkSessions.reduce((sum, s) => sum + (s.focusScore || 0), 0) / deepWorkSessions.length
      : 0;
    const avgDWProductivity = deepWorkSessions.length > 0
      ? deepWorkSessions.reduce((sum, s) => sum + (s.productivityScore || 0), 0) / deepWorkSessions.length
      : 0;

    const totalProductiveMs = deepWorkSessions.reduce((sum, s) => sum + (s.productiveMs || 0), 0);
    const totalDistractionMs = deepWorkSessions.reduce((sum, s) => sum + (s.distractionMs || 0), 0);
    const totalIdleMs = deepWorkSessions.reduce((sum, s) => sum + (s.idleMs || 0), 0);
    const totalInterruptionMs = deepWorkSessions.reduce((sum, s) => sum + (s.interruptionMs || 0), 0);

    const enforcementEffectiveness = (totalProductiveMs + totalDistractionMs + totalIdleMs) > 0
      ? (totalProductiveMs / (totalProductiveMs + totalDistractionMs + totalIdleMs)) * 100
      : 0;

    const totalViolations = deepWorkSessions.reduce((sum, s) => sum + (s.violationCount || 0), 0);
    const avgViolations = deepWorkSessions.length > 0 ? totalViolations / deepWorkSessions.length : 0;
    const totalInterventions = deepWorkSessions.reduce((sum, s) => sum + (s.interventions?.length || 0), 0);

    // Deep work streak
    const dwDays = new Set(completedDWS.map(s => new Date(s.startedAt).toISOString().split("T")[0]));
    let deepWorkStreak = 0;
    const checkDate = new Date();
    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (dwDays.has(dateStr)) {
        deepWorkStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }

    // Best deep work hour
    const dwHourMap: Record<number, { total: number; count: number }> = {};
    deepWorkSessions.forEach(s => {
      const hour = new Date(s.startedAt).getHours();
      if (!dwHourMap[hour]) dwHourMap[hour] = { total: 0, count: 0 };
      dwHourMap[hour].total += (s.focusScore || 0);
      dwHourMap[hour].count++;
    });
    let bestDeepWorkHour = null;
    let bestDWScore = 0;
    Object.entries(dwHourMap).forEach(([hour, data]) => {
      const avg = data.total / data.count;
      if (avg > bestDWScore) { bestDWScore = avg; bestDeepWorkHour = Number(hour); }
    });

    // 7-day trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    const deepWorkTrend = last7Days.map(date => {
      const daySessions = deepWorkSessions.filter(s => new Date(s.startedAt).toISOString().split("T")[0] === date);
      const dayCompleted = daySessions.filter(s => s.status === "completed");
      return {
        date,
        completed: dayCompleted.length,
        abandoned: daySessions.filter(s => s.status === "abandoned").length,
        focus: daySessions.length > 0 
          ? daySessions.reduce((sum, s) => sum + (s.focusScore || 0), 0) / daySessions.length 
          : 0,
        productivity: daySessions.length > 0
          ? daySessions.reduce((sum, s) => sum + (s.productivityScore || 0), 0) / daySessions.length
          : 0,
        plannedMinutes: daySessions.reduce((sum, s) => sum + (s.plannedMinutes || 0), 0),
        actualMinutes: dayCompleted.reduce((sum, s) => {
          if (!s.endedAt) return sum;
          return sum + ((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / (60 * 1000));
        }, 0),
      };
    });

    // Active session live data
    const activeSessionDetail = activeDeepWork ? {
      id: activeDeepWork.id,
      goal: activeDeepWork.goal,
      plannedMinutes: activeDeepWork.plannedMinutes,
      elapsedMinutes: Math.floor((Date.now() - new Date(activeDeepWork.startedAt).getTime()) / (60 * 1000)),
      remainingMinutes: Math.max(0, activeDeepWork.plannedMinutes - Math.floor((Date.now() - new Date(activeDeepWork.startedAt).getTime()) / (60 * 1000))),
      enforcement: activeDeepWork.enforcement,
      focusScore: Number((activeDeepWork.focusScore || 0).toFixed(2)),
      productivityScore: Number((activeDeepWork.productivityScore || 0).toFixed(2)),
      violationCount: activeDeepWork.violationCount || 0,
      productiveMs: activeDeepWork.productiveMs || 0,
      distractionMs: activeDeepWork.distractionMs || 0,
      idleMs: activeDeepWork.idleMs || 0,
      interventionCount: activeDeepWork.interventions?.length || 0,
    } : null;

    // Last session
    const lastSession = deepWorkSessions[0] ? {
      id: deepWorkSessions[0].id,
      goal: deepWorkSessions[0].goal,
      plannedMinutes: deepWorkSessions[0].plannedMinutes,
      status: deepWorkSessions[0].status,
      focusScore: Number((deepWorkSessions[0].focusScore || 0).toFixed(2)),
      productivityScore: Number((deepWorkSessions[0].productivityScore || 0).toFixed(2)),
      violationCount: deepWorkSessions[0].violationCount || 0,
      startedAt: deepWorkSessions[0].startedAt,
      endedAt: deepWorkSessions[0].endedAt,
      enforcement: deepWorkSessions[0].enforcement,
    } : null;

    // ─── ENHANCED SUGGESTION ENGINE ───
    let suggestion = "";
    if (activeSessionDetail) {
      const remaining = activeSessionDetail.remainingMinutes;
      const progress = (activeSessionDetail.elapsedMinutes / activeSessionDetail.plannedMinutes) * 100;
      if (activeSessionDetail.violationCount > 0) {
        suggestion = `Session "${activeSessionDetail.goal}" active. ${remaining}m left. ${activeSessionDetail.violationCount} violation(s) detected — stay on track.`;
      } else if (progress > 75) {
        suggestion = `Final stretch! ${remaining} minutes left in your deep work block. Close out strong.`;
      } else {
        suggestion = `Deep work "${activeSessionDetail.goal}" in progress. ${remaining} minutes remaining.`;
      }
    } else if (deepWorkSessions.length === 0) {
      suggestion = "No deep work sessions recorded. Start a 45-minute block to build focus endurance.";
    } else if ((completedDWS.length / Math.max(1, deepWorkSessions.length)) < 0.5) {
      suggestion = "Most deep work sessions are abandoned. Try 30-minute blocks to build consistency.";
    } else if (avgViolations > 3) {
      suggestion = "High violation rate during deep work. Tighten your blocked apps list or use stricter enforcement.";
    } else if (enforcementEffectiveness < 60) {
      suggestion = "Deep work effectiveness is below 60%. Review allowances — too many distractions are getting through.";
    } else if (deepWorkStreak >= 3) {
      suggestion = `🔥 ${deepWorkStreak}-day deep work streak! Your cognitive discipline is compounding.`;
    } else if (deepWorkRatio < 20) {
      suggestion = "Deep work ratio is low. Schedule a protected block during your peak hours.";
    } else if (fragmentationScore > 50) {
      suggestion = "High fragmentation detected. Use app blocking during focus sessions.";
    } else if (communicationRatio > 40) {
      suggestion = "Communication-heavy day. Consider async check-ins to protect deep work.";
    } else if (energyScore < -0.3) {
      suggestion = "Energy levels declining. Take a 15-minute break before your next session.";
    } else if (cognitiveStability > 70) {
      suggestion = "Excellent cognitive stability. Ideal conditions for extended deep work.";
    } else {
      suggestion = "Moderate conditions. Start with a 45-minute focused block.";
    }

    // ─── RESPONSE ───
    res.json({
      // Existing metrics
      driftScore: Number(driftScore.toFixed(2)),
      entropyTrend: Number(entropyTrend.toFixed(2)),
      peakHour,
      peakFocusScore: Number(bestScore.toFixed(2)),
      highPerformanceProbability: Number(highPerformanceProbability.toFixed(2)),
      cognitiveStability: Number(cognitiveStability.toFixed(1)),
      fragmentationScore: Number(fragmentationScore.toFixed(1)),
      switchingRate: Number(switchingRate.toFixed(1)),
      deepWorkRatio: Number(deepWorkRatio.toFixed(1)),
      avgFocusBlockMinutes: Number(avgFocusBlockMinutes.toFixed(1)),
      energyScore: Number(energyScore.toFixed(2)),
      communicationRatio: Number(communicationRatio.toFixed(1)),
      productivityScore: Number(productivityScore.toFixed(1)),
      focusScore: Number(focusScore.toFixed(1)),
      suggestion,

      // NEW: Deep Work Intelligence
      deepWork: {
        sessionCount: deepWorkSessions.length,
        completedCount: completedDWS.length,
        abandonedCount: abandonedDWS.length,
        completionRate: deepWorkSessions.length > 0 
          ? Number(((completedDWS.length / deepWorkSessions.length) * 100).toFixed(1)) 
          : 0,
        totalPlannedMinutes,
        totalActualMinutes: Number(totalActualMinutes.toFixed(1)),
        adherenceRate: totalPlannedMinutes > 0 
          ? Number(((totalActualMinutes / totalPlannedMinutes) * 100).toFixed(1)) 
          : 0,
        avgFocusScore: Number(avgDWFocus.toFixed(2)),
        avgProductivityScore: Number(avgDWProductivity.toFixed(2)),
        totalProductiveMinutes: Math.round(totalProductiveMs / (60 * 1000)),
        totalDistractionMinutes: Math.round(totalDistractionMs / (60 * 1000)),
        totalIdleMinutes: Math.round(totalIdleMs / (60 * 1000)),
        totalInterruptionMinutes: Math.round(totalInterruptionMs / (60 * 1000)),
        enforcementEffectiveness: Number(enforcementEffectiveness.toFixed(1)),
        totalViolations,
        avgViolations: Number(avgViolations.toFixed(2)),
        totalInterventions,
        deepWorkStreak,
        bestDeepWorkHour,
        bestDeepWorkScore: Number(bestDWScore.toFixed(2)),
        trend: deepWorkTrend,
        lastSession,
        activeSession: activeSessionDetail,
      }
    });

  } catch (error) {
    console.error("Intelligence route error:", error);
    res.status(500).json({ error: "Failed to compute intelligence metrics" });
  }
});

// ─── NEW: READINESS ROUTE ───

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

// ─── NEW: PATTERNS ROUTE ───

router.get("/patterns", async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // Get last 14 days of activities with intent
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const activities = await prisma.activity.findMany({
      where: {
        session: { userId: userId }, // FIXED: Activity has no userId; filter via session relation
        startTime: { gte: twoWeeksAgo }, // FIXED: was "start"
        intent: { not: null }
      },
      include: {
        session: true
      }
    });

    if (activities.length === 0) {
      return res.json({
        patterns: [],
        topPerformer: null,
        worstPerformer: null,
        timeOfDayWinner: null,
        correlations: []
      });
    }

    // Group by intent
    const intentGroups: Record<string, { 
      activities: typeof activities; 
      totalFocus: number; 
      totalDuration: number; 
      count: number;
    }> = {};

    activities.forEach(a => {
      const intent = a.intent || "unknown";
      if (!intentGroups[intent]) {
        intentGroups[intent] = { activities: [], totalFocus: 0, totalDuration: 0, count: 0 };
      }
      intentGroups[intent].activities.push(a);
      intentGroups[intent].totalFocus += a.session?.focusScore || 0;
      intentGroups[intent].totalDuration += a.duration || 0;
      intentGroups[intent].count++;
    });

    // Compute per-intent stats
    const intentStats = Object.entries(intentGroups).map(([intent, data]) => ({
      intent,
      avgFocus: data.count > 0 ? data.totalFocus / data.count : 0,
      totalHours: data.totalDuration / (1000 * 60 * 60),
      count: data.count,
    })).sort((a, b) => b.avgFocus - a.avgFocus);

    const topPerformer = intentStats[0] || null;
    const worstPerformer = intentStats[intentStats.length - 1] || null;

    // Time of day analysis
    const hourStats: Record<number, { totalFocus: number; count: number }> = {};
    activities.forEach(a => {
      const hour = new Date(a.startTime).getHours(); // FIXED: was a.start
      if (!hourStats[hour]) hourStats[hour] = { totalFocus: 0, count: 0 };
      hourStats[hour].totalFocus += a.session?.focusScore || 0;
      hourStats[hour].count++;
    });

    const hourlyAvgs = Object.entries(hourStats)
      .map(([hour, data]) => ({
        hour: Number(hour),
        avgFocus: data.count > 0 ? data.totalFocus / data.count : 0,
      }))
      .sort((a, b) => b.avgFocus - a.avgFocus);

    const timeOfDayWinner = hourlyAvgs[0] || null;

    // Generate correlation patterns
    const patterns = [];

    // Communication vs Focus correlation
    const commIntents = ["chat", "email", "meeting", "call", "slack", "discord"];
    const commActivities = activities.filter(a => 
      commIntents.some(ci => (a.intent || "").toLowerCase().includes(ci))
    );
    const nonCommActivities = activities.filter(a => 
      !commIntents.some(ci => (a.intent || "").toLowerCase().includes(ci))
    );

    const commAvgFocus = commActivities.length > 0
      ? commActivities.reduce((s, a) => s + (a.session?.focusScore || 0), 0) / commActivities.length
      : 0;
    const nonCommAvgFocus = nonCommActivities.length > 0
      ? nonCommActivities.reduce((s, a) => s + (a.session?.focusScore || 0), 0) / nonCommActivities.length
      : 0;

    if (commAvgFocus > 0 && nonCommAvgFocus > 0) {
      const impact = Math.round(((nonCommAvgFocus - commAvgFocus) / commAvgFocus) * 100);
      patterns.push({
        type: impact > 0 ? "positive" : "negative",
        metric: "Non-communication tasks",
        condition: `vs ${commIntents.join("/")}`,
        impact: Math.abs(impact),
        confidence: 85,
        recommendation: impact > 20 
          ? "Batch communications into 2 blocks/day to protect focus."
          : "Communication and focus are well balanced.",
      });
    }

    // Deep work correlation
    const deepWorkIntents = ["coding", "debugging", "writing", "design", "research"];
    const deepWorkActivities = activities.filter(a =>
      deepWorkIntents.some(di => (a.intent || "").toLowerCase().includes(di))
    );
    const shallowActivities = activities.filter(a =>
      !deepWorkIntents.some(di => (a.intent || "").toLowerCase().includes(di)) &&
      !commIntents.some(ci => (a.intent || "").toLowerCase().includes(ci))
    );

    const deepAvgFocus = deepWorkActivities.length > 0
      ? deepWorkActivities.reduce((s, a) => s + (a.session?.focusScore || 0), 0) / deepWorkActivities.length
      : 0;
    const shallowAvgFocus = shallowActivities.length > 0
      ? shallowActivities.reduce((s, a) => s + (a.session?.focusScore || 0), 0) / shallowActivities.length
      : 0;

    if (deepAvgFocus > 0 && shallowAvgFocus > 0) {
      const impact = Math.round(((deepAvgFocus - shallowAvgFocus) / shallowAvgFocus) * 100);
      patterns.push({
        type: "positive",
        metric: "Deep work intents",
        condition: "vs shallow tasks",
        impact: Math.abs(impact),
        confidence: 80,
        recommendation: "Schedule deep work intents during peak hours for maximum leverage.",
      });
    }

    // Duration correlation
    const longActivities = activities.filter(a => a.duration > 30 * 60 * 1000);
    const shortActivities = activities.filter(a => a.duration <= 10 * 60 * 1000);
    const longAvgFocus = longActivities.length > 0
      ? longActivities.reduce((s, a) => s + (a.session?.focusScore || 0), 0) / longActivities.length
      : 0;
    const shortAvgFocus = shortActivities.length > 0
      ? shortActivities.reduce((s, a) => s + (a.session?.focusScore || 0), 0) / shortActivities.length
      : 0;

    if (longAvgFocus > 0 && shortAvgFocus > 0) {
      const impact = Math.round(((longAvgFocus - shortAvgFocus) / shortAvgFocus) * 100);
      patterns.push({
        type: impact > 0 ? "positive" : "negative",
        metric: "Long sessions (>30min)",
        condition: "vs quick tasks (<10min)",
        impact: Math.abs(impact),
        confidence: 75,
        recommendation: impact > 15
          ? "Longer sessions correlate with better focus. Batch quick tasks."
          : "Short tasks are working well for you. Keep the momentum.",
      });
    }

    res.json({
      patterns,
      topPerformer: topPerformer ? {
        intent: topPerformer.intent,
        avgFocus: Math.round(topPerformer.avgFocus),
        hours: Math.round(topPerformer.totalHours * 10) / 10,
      } : null,
      worstPerformer: worstPerformer ? {
        intent: worstPerformer.intent,
        avgFocus: Math.round(worstPerformer.avgFocus),
        hours: Math.round(worstPerformer.totalHours * 10) / 10,
      } : null,
      timeOfDayWinner: timeOfDayWinner ? {
        hour: timeOfDayWinner.hour,
        avgFocus: Math.round(timeOfDayWinner.avgFocus),
      } : null,
      correlations: [
        { type: "timeOfDay", data: hourlyAvgs.slice(0, 5) },
        { type: "intent", data: intentStats.slice(0, 5) },
      ]
    });

  } catch (error) {
    console.error("Patterns route error:", error);
    res.status(500).json({ error: "Failed to compute patterns" });
  }
});

// ─── EXISTING ROUTES (continued) ───

router.get("/growth-trend", async (req, res) => {
  try {
    const userId = String(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const data = await getWeeklyGrowthTrend(userId);
    res.json(data);
  } catch (err) {
    console.error("Growth trend error:", err);
    res.status(500).json({ error: "Failed to fetch growth trend" });
  }
});

router.get("/burnout-risk", async (req, res) => {
  try {
    const userId = String(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const data = await getBurnoutRisk(userId);
    res.json(data);
  } catch (err) {
    console.error("Burnout risk error:", err);
    res.status(500).json({ error: "Failed to fetch burnout risk" });
  }
});

router.get("/intent-heatmap", async (req, res) => {
  try {
    const userId = String(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const data = await getIntentHeatmap(userId);
    res.json(data);
  } catch (err) {
    console.error("Intent heatmap error:", err);
    res.status(500).json({ error: "Failed to fetch intent heatmap" });
  }
});

export default router;