import { Router } from "express";
import type { Session } from "@prisma/client";
import { prisma } from "../prisma";
import { getDailyAnalytics, getDeepWorkStreak,getWeeklyAnalytics , getHeatmap} from "../services/analyticsService";

import {
  getDailyComparison,
  getWeeklyGrowthTrend,
  getIntentHeatmap,
  getBurnoutRisk,
  getGrowthTrend,
  getDailyFocusTrend
} from "../services/intelligenceService";
const router = Router();
router.get("/compare", async (req,res)=>{
  const {userId} = req.query;
  const data = await getDailyComparison(userId as string);
  res.json(data);
});

router.get("/growth", async (req,res)=>{
  const {userId} = req.query;
  const data = await getWeeklyGrowthTrend(userId as string);
  res.json(data);
});

router.get("/intents", async (req,res)=>{
  const {userId} = req.query;
  const data = await getIntentHeatmap(userId as string);
  res.json(data);
});

router.get("/burnout", async (req,res)=>{
  const {userId} = req.query;
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
  
      res.json({
        ...daily,
        ...streak
      });
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
  
      res.status(500).json({
        error: "Daily focus trend failed"
      });
  
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
  router.get("/heatmap", async (req, res) => {
    const { userId } = req.query;
  
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
  
    try {
      const heatmap = await getHeatmap(userId);
      res.json(heatmap);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  });
  
export default router;
import { getAssistantInsights } from "../services/intelligenceService";

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
import { getDashboard } from "../services/intelligenceService";
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
import { getTimeline } from "../services/timelineservice";  
router.get("/timeline", async (req,res)=>{

  const { userId, date } = req.query;

  const data = await getTimeline(
    userId as string,
    date as string
  );

  res.json(data);

});
import { getFocusBlocks } from "../services/activityService";

router.get("/focus-blocks", async (req, res) => {

  const { userId, date } = req.query;

  if (!userId || !date) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const blocks = await getFocusBlocks(
    userId as string,
    date as string
  );

  res.json(blocks);

});
import { getDailySummary } from "../services/intelligenceService";

router.get("/daily-summary", async (req,res)=>{

  const { userId, date } = req.query;

  if(!userId || !date){
    return res.status(400).json({error:"Missing parameters"});
  }

  const summary = await getDailySummary(
    userId as string,
    date as string
  );

  res.json(summary);
});
router.get("/intelligence", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { startTime: "asc" }
    });

    if (sessions.length === 0) {
      return res.json({
        driftScore: 0,
        entropyTrend: 0,
        peakHour: null,
        peakFocusScore: 0,
        highPerformanceProbability: 0
      });
    }

    // ---- Drift Score ----
    let declines = 0;

    for (let i = 1; i < sessions.length; i++) {
      if (sessions[i].focusScore < sessions[i - 1].focusScore) {
        declines++;
      }
    }

    const driftScore =
      (declines / Math.max(1, sessions.length - 1)) * 100;

    // ---- Entropy Trend ----
    let entropyRise = 0;

    for (let i = 1; i < sessions.length; i++) {
      if (sessions[i].entropyScore > sessions[i - 1].entropyScore) {
        entropyRise++;
      }
    }

    const entropyTrend =
      (entropyRise / Math.max(1, sessions.length - 1)) * 100;

    // ---- Peak Focus Hour ----
    const hourMap: Record<number, { total: number; count: number }> = {};

    sessions.forEach((session: Session) => {
      const hour = new Date(session.startTime).getHours();

      if (!hourMap[hour]) {
        hourMap[hour] = { total: 0, count: 0 };
      }

      hourMap[hour].total += session.focusScore;
      hourMap[hour].count += 1;
    });

    let peakHour = null;
    let bestScore = 0;

    Object.entries(hourMap).forEach(([hour, data]) => {
      const avg = data.total / data.count;

      if (avg > bestScore) {
        bestScore = avg;
        peakHour = Number(hour);
      }
    });

    // ---- Performance Probability ----
    const highPerformanceSessions = sessions.filter(
      s => s.focusScore > 75 && s.burnoutScore < 40
    ).length;

    const highPerformanceProbability =
      highPerformanceSessions / sessions.length;

    res.json({
      driftScore: Number(driftScore.toFixed(2)),
      entropyTrend: Number(entropyTrend.toFixed(2)),
      peakHour,
      peakFocusScore: Number(bestScore.toFixed(2)),
      highPerformanceProbability: Number(
        highPerformanceProbability.toFixed(2)
      )
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Failed to compute intelligence metrics"
    });

  }
});

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