import { prisma } from "../prisma";
import { getISTDayRange } from "../utils/time";
import type { Request, Response } from "express";
export async function getAssistantInsights(userId: string) {

  const { start, end } = getISTDayRange();

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { gte: start, lt: end }
    }
  });

  if (activities.length === 0) {
    return {
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
  }

  const totalDuration = activities.reduce((s,a)=>s+a.duration,0);

  /* ---------- Deep Work ---------- */

  const deepActivities =
    activities.filter(a=>a.category==="deep_work");

  const deepWorkDuration =
    deepActivities.reduce((s,a)=>s+a.duration,0);

  const deepWorkRatio =
    deepWorkDuration / totalDuration;

  const deepWorkSessions = deepActivities.length;

  /* ---------- Communication ---------- */

  const communicationDuration =
    activities
      .filter(a=>a.category==="communication")
      .reduce((s,a)=>s+a.duration,0);

  const communicationRatio =
    communicationDuration / totalDuration;

  /* ---------- Focus ---------- */

  const weightedFocus =
    activities.reduce(
      (s,a)=>s+(a.focusImpact ?? 0.5)*a.duration,
      0
    ) / totalDuration;

  const focusScore = weightedFocus * 100;

  /* ---------- Fragmentation ---------- */

  const minutes = totalDuration / 60000;

  const switchingRate =
    activities.length / Math.max(minutes,1);

  const fragmentationScore =
    Math.min(100,switchingRate * 100);

  /* ---------- Energy ---------- */

  const weightedEnergy =
    activities.reduce(
      (s,a)=>s+(a.energyImpact ?? 0)*a.duration,
      0
    ) / totalDuration;

  const energyScore = weightedEnergy;

  /* ---------- Avg Focus Block ---------- */

  const avgFocusBlock =
    deepActivities.length
      ? deepWorkDuration / deepActivities.length
      : 0;

  /* ---------- Cognitive Stability ---------- */

  const cognitiveStability =
    Math.max(0,100-fragmentationScore);

  /* ---------- Productivity ---------- */

  const productivityScore =
    Math.max(
      0,
      Math.min(
        100,
        focusScore * 0.5 +
        deepWorkRatio * 100 * 0.3 -
        communicationRatio * 100 * 0.1 -
        fragmentationScore * 0.1
      )
    );

  const suggestion =
    generateAssistantSuggestion({
      productivityScore,
      deepWorkRatio,
      communicationRatio,
      fragmentationScore,
      energyScore
    });

  return {

    productivityScore: Number(productivityScore.toFixed(2)),
    focusScore: Number(focusScore.toFixed(2)),

    deepWorkRatio:
      Number((deepWorkRatio*100).toFixed(2)),

    communicationRatio:
      Number((communicationRatio*100).toFixed(2)),

    fragmentationScore:
      Number(fragmentationScore.toFixed(2)),

    energyScore:
      Number(energyScore.toFixed(2)),

    deepWorkSessions,

    avgFocusBlockMinutes:
      Math.round(avgFocusBlock/60000),

    switchingRate:
      Number(switchingRate.toFixed(2)),

    cognitiveStability:
      Number(cognitiveStability.toFixed(2)),

    suggestion

  };

}
function generateAssistantSuggestion(metrics: {
  productivityScore: number;
  deepWorkRatio: number;
  communicationRatio: number;
  fragmentationScore: number;
  energyScore: number;
}) {

  if (metrics.fragmentationScore > 60)
    return "High task fragmentation detected. Reduce switching and batch similar tasks.";

  if (metrics.communicationRatio > 0.45)
    return "Communication is dominating your day. Consider fixed message windows.";

  if (metrics.deepWorkRatio < 0.25)
    return "Deep work time is low. Schedule a 60-minute uninterrupted block.";

  if (metrics.energyScore < -0.4)
    return "Energy drain detected. Take a structured break before continuing.";

  if (metrics.productivityScore > 80)
    return "High-performance pattern detected. Protect this structure.";

  return "Work pattern stable. Maintain structure.";
}


export async function getDailyComparison(userId: string) {

  /* ---------- IST DAY RANGES ---------- */

  const todayRange =
    getISTDayRange(new Date());

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const yesterdayRange =
    getISTDayRange(yesterdayDate);

  /* ---------- FETCH ACTIVITIES ---------- */

  const todayActivities = await prisma.activity.findMany({
    where:{
      session:{ userId },
      startTime:{
        gte: todayRange.start,
        lt: todayRange.end
      }
    }
  });

  const yesterdayActivities = await prisma.activity.findMany({
    where:{
      session:{ userId },
      startTime:{
        gte: yesterdayRange.start,
        lt: yesterdayRange.end
      }
    }
  });

  /* ---------- METRIC ENGINE ---------- */

  function computeMetrics(activities:any[]){

    if(activities.length === 0)
      return {
        focus:0,
        deepWork:0,
        communication:0,
        fragmentation:0
      };

    const totalDuration =
      activities.reduce((s,a)=>s+a.duration,0);

    if(totalDuration === 0){
      return {
        focus:0,
        deepWork:0,
        communication:0,
        fragmentation:0
      };
    }

    const weightedFocus =
      activities.reduce(
        (s,a)=>s+(a.focusImpact ?? 0.5)*a.duration,
        0
      ) / totalDuration;

    const deepWork =
      activities
        .filter(a=>a.category==="deep_work")
        .reduce((s,a)=>s+a.duration,0) / totalDuration;

    const communication =
      activities
        .filter(a=>a.category==="communication")
        .reduce((s,a)=>s+a.duration,0) / totalDuration;

    const minutes =
      totalDuration / 60000;

    const fragmentation =
      minutes > 0
        ? activities.length / minutes
        : 0;

    return {
      focus: weightedFocus * 100,
      deepWork,
      communication,
      fragmentation
    };

  }

  const today = computeMetrics(todayActivities);
  const yesterday = computeMetrics(yesterdayActivities);

  const change = today.focus - yesterday.focus;

  const reason =
    generateFocusReason(today,yesterday);

  return {

    todayFocusScore:
      Number(today.focus.toFixed(2)),

    yesterdayFocusScore:
      Number(yesterday.focus.toFixed(2)),

    change:
      Number(change.toFixed(2)),

    reason

  };

}
function generateFocusReason(today:any,yesterday:any){

  const insights:string[] = [];

  if(today.deepWork > yesterday.deepWork + 0.1)
    insights.push("longer deep-work blocks");

  if(today.communication > yesterday.communication + 0.1)
    insights.push("increased communication load");

  if(today.fragmentation > yesterday.fragmentation + 0.2)
    insights.push("higher task switching");

  if(today.deepWork < yesterday.deepWork - 0.1)
    insights.push("reduced deep-work time");

  if(insights.length === 0)
    return "Work pattern remained similar to yesterday.";

  return insights.join(" and ");

}
export async function getWeeklyGrowthTrend(userId:string){

  const start = new Date();
  start.setDate(start.getDate()-7);

  const sessions = await prisma.session.findMany({
    where:{
      userId,
      startTime:{ gte:start }
    }
  });

  const dayMap:Record<string,{focus:number,count:number,entropy:number}> = {};

  sessions.forEach(s=>{

    const day =
      s.startTime.toISOString().split("T")[0];

    if(!dayMap[day]){
      dayMap[day] = {
        focus:0,
        entropy:0,
        count:0
      };
    }

    dayMap[day].focus += s.focusScore;
    dayMap[day].entropy += s.entropyScore;
    dayMap[day].count++;

  });

  const trend = Object.entries(dayMap).map(([date,d])=>({

    date,

    focus:
      d.focus/d.count,

    entropy:
      d.entropy/d.count

  }));

  trend.sort((a,b)=>
    new Date(a.date).getTime()
    -
    new Date(b.date).getTime()
  );

  return trend;

}
export async function getIntentHeatmap(userId:string){

  const activities = await prisma.activity.findMany({
    where:{ session:{ userId } }
  });

  const map:Record<string,{
    duration:number
    focus:number
  }> = {};

  activities.forEach(a=>{

    const intent = a.intent ?? "unknown";

    if(!map[intent]){
      map[intent] = { duration:0, focus:0 };
    }

    map[intent].duration += a.duration;
    map[intent].focus += (a.focusImpact ?? 0.5)*a.duration;

  });

  const total =
    Object.values(map)
      .reduce((s,v)=>s+v.duration,0);

  return Object.entries(map).map(([intent,data])=>({

    intent,

    percentage:
      Number(((data.duration/total)*100).toFixed(2)),

    avgFocus:
      Number((data.focus/data.duration*100).toFixed(2))

  }));

}

export async function getBurnoutRisk(userId:string){

  const sessions = await prisma.session.findMany({
    where:{ userId },
    orderBy:{ startTime:"desc" },
    take:10
  });

  if(sessions.length===0){
    return { burnoutRisk:"low" };
  }

  const avgBurnout =
    sessions.reduce(
      (s,a)=>s+(a.burnoutScore ?? 0),
      0
    )/sessions.length;

  const avgEntropy =
    sessions.reduce(
      (s,a)=>s+(a.entropyScore ?? 0),
      0
    )/sessions.length;

  const avgDuration =
    sessions.reduce(
      (s,a)=>s+(a.totalDuration ?? 0),
      0
    )/sessions.length;

  let risk="low";

  if(avgBurnout>60) risk="high";
  else if(avgBurnout>35) risk="moderate";

  const recommendation =
    risk==="high"
      ? "Reduce session length and introduce recovery breaks."
      : risk==="moderate"
      ? "Monitor workload and avoid late night work."
      : "Workload appears sustainable.";

  return {

    burnoutRisk:risk,

    burnoutScore:
      Number(avgBurnout.toFixed(2)),

    entropyLoad:
      Number(avgEntropy.toFixed(2)),

    avgSessionMinutes:
      Math.round(avgDuration/60000),

    recommendation

  };

}
import {
  clamp,
  getBaseFocus,
  isIdleActivity
} from "./metricEngine";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getISTParts(date: Date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);

  return {
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes()
  };
}
function getWorkFocusImpact(activity: any) {
  if (isIdleActivity(activity)) return 0;

  const allowedCategories = new Set([
    "deep_work",
    "research",
    "productivity",
    "development_tools"
  ]);

  if (!allowedCategories.has(activity.category)) {
    return 0;
  }

  return getBaseFocus(activity);
}
export async function getDailyFocusTrend(
  userId: string,
  date?: string,
  bucketMinutes = 60
) {
  const targetDate =
    date ? new Date(date + "T00:00:00") : new Date();

  const { start, end } = getISTDayRange(targetDate);
  const safeBucketMinutes =
    Number.isFinite(bucketMinutes)
      ? Math.min(60, Math.max(1, Math.floor(bucketMinutes)))
      : 60;

  const bucketMs = safeBucketMinutes * MINUTE_MS;
  const bucketCount = Math.ceil(DAY_MS / bucketMs);

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { lt: end },
      endTime: { gt: start },
      duration: {
        gt: 0
      }
    },
    orderBy: {
      startTime: "asc"
    }
  });

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketMs);
    const bucketEnd = new Date(
      Math.min(bucketStart.getTime() + bucketMs, end.getTime())
    );
    const { hour, minute } = getISTParts(bucketStart);

    return {
      index,
      hour,
      minute,
      label:
        `${String(hour).padStart(2, "0")}:` +
        `${String(minute).padStart(2, "0")}`,
      start: bucketStart,
      end: bucketEnd,
      focus: 0,
      duration: 0
    };
  });

  for (const activity of activities) {
    const impact = getWorkFocusImpact(activity);

    const activityStart = new Date(activity.startTime).getTime();
    const recordedEnd =
      activity.endTime > activity.startTime
        ? new Date(activity.endTime).getTime()
        : activityStart + activity.duration;

    let currentMs = Math.max(activityStart, start.getTime());
    const activityEndMs = Math.min(recordedEnd, end.getTime());

    while (currentMs < activityEndMs) {
      const bucketIndex = Math.floor(
        (currentMs - start.getTime()) / bucketMs
      );

      const bucket = buckets[bucketIndex];

      if (!bucket) break;

      const segmentEndMs = Math.min(
        bucket.end.getTime(),
        activityEndMs
      );

      const segmentMs = segmentEndMs - currentMs;

      if (segmentMs <= 0) break;

      bucket.focus += impact * segmentMs;
      bucket.duration += segmentMs;

      currentMs = segmentEndMs;
    }
  }

  return buckets.map(bucket => {
    const avg =
      bucket.duration > 0
        ? (bucket.focus / bucket.duration) * 100
        : 0;

    return {
      index: bucket.index,
      hour: bucket.hour,
      minute: bucket.minute,
      label: bucket.label,
      start: bucket.start,
      end: bucket.end,
      duration: bucket.duration,
      focus: Number(clamp(avg).toFixed(2))
    };
  });
}
export async function getWeeklyInsights(userId: string) {

  const now = new Date();
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - 7);

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { gte: weekStart }
    }
  });

  if (activities.length === 0) {
    return {
      weeklyFocusScore: 0,
      weeklyDeepWorkRatio: 0,
      weeklyCommunicationRatio: 0,
      peakProductiveHour: null
    };
  }

  const totalDuration = activities.reduce((s, a) => s + a.duration, 0);

  const deepWorkDuration = activities
    .filter(a => a.category === "deep_work")
    .reduce((s, a) => s + a.duration, 0);

  const communicationDuration = activities
    .filter(a => a.category === "communication")
    .reduce((s, a) => s + a.duration, 0);

  const weightedFocus =
    activities.reduce(
      (s, a) => s + (a.focusImpact ?? 0.5) * a.duration,
      0
    ) / totalDuration;

  // Peak hour calculation
  const hourMap: Record<number, { score: number; duration: number }> = {};

  activities.forEach(a => {

    const hour = new Date(a.startTime).getHours();

    if (!hourMap[hour]) {
      hourMap[hour] = { score: 0, duration: 0 };
    }

    hourMap[hour].score += (a.focusImpact ?? 0.5) * a.duration;
    hourMap[hour].duration += a.duration;

  });

  let peakHour = 0;
  let bestScore = 0;

  Object.entries(hourMap).forEach(([hour, data]) => {

    const avg = data.score / data.duration;

    if (avg > bestScore) {
      bestScore = avg;
      peakHour = Number(hour);
    }

  });

  return {
    weeklyFocusScore: Number((weightedFocus * 100).toFixed(2)),
    weeklyDeepWorkRatio: Number(((deepWorkDuration / totalDuration) * 100).toFixed(2)),
    weeklyCommunicationRatio: Number(((communicationDuration / totalDuration) * 100).toFixed(2)),
    peakProductiveHour: peakHour
  };
}

export async function getDashboard(userId: string) {

  const [
    assistant,
    weekly,
    comparison,
    growth,
    intents,
    burnout,
    streak
  ] = await Promise.all([
    getAssistantInsights(userId),
    getWeeklyInsights(userId),
    getDailyComparison(userId),
    getWeeklyGrowthTrend(userId),
    getIntentHeatmap(userId),
    getBurnoutRisk(userId),
    getDeepWorkStreak(userId)
  ]);

  return {
    assistant,
    weekly,
    comparison,
    growth,
    intents,
    burnout,
    streak,
    meta:{
      generatedAt:new Date(),
      system:"samaritan-intelligence"
    }
  };
}
export async function getDeepWorkStreak(userId: string) {

  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { startTime: "asc" }
  });

  if (sessions.length === 0) {
    return {
      currentDeepWorkStreak: 0,
      longestDeepWorkStreak: 0
    };
  }

  const dailyDeepWork: Record<string, number> = {};

  sessions.forEach(session => {

    const date = session.startTime.toISOString().split("T")[0];

    if (!dailyDeepWork[date]) {
      dailyDeepWork[date] = 0;
    }

    dailyDeepWork[date] += session.deepWorkScore ?? 0;

  });

  const days = Object.keys(dailyDeepWork).sort();

  let current = 0;
  let longest = 0;

  days.forEach(day => {

    if (dailyDeepWork[day] > 30) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }

  });

  return {
    currentDeepWorkStreak: current,
    longestDeepWorkStreak: longest
  };
}
export async function getDailySummary(userId: string, date: string) {

  const { start, end } =
    getISTDayRange(new Date(date + "T00:00:00"));

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    }
  });

  if (activities.length === 0) {
    return { message: "No activity recorded." };
  }

  const totalDuration = activities.reduce((s,a)=>s+a.duration,0);

  const deepWorkDuration = activities
    .filter(a=>a.category==="deep_work")
    .reduce((s,a)=>s+a.duration,0);

  const focusWeighted =
    activities.reduce(
      (s,a)=>s+(a.focusImpact ?? 0.5)*a.duration,
      0
    ) / totalDuration;

  const focusScore = focusWeighted * 100;

  // intent calculation
  const intentMap: Record<string,number> = {};

  activities.forEach(a=>{
    const intent = a.intent ?? "unknown";
    intentMap[intent] = (intentMap[intent] || 0) + a.duration;
  });

  const topIntent =
    Object.entries(intentMap)
      .sort((a,b)=>b[1]-a[1])[0][0];

  // longest focus block
  const deepActivities =
    activities.filter(a=>a.category==="deep_work");

  let longestFocusBlock = 0;

  deepActivities.forEach(a=>{
    if(a.duration > longestFocusBlock){
      longestFocusBlock = a.duration;
    }
  });

  return {

    date,

    deepWorkHours:
      Number((deepWorkDuration/3600000).toFixed(2)),

    focusScore:
      Number(focusScore.toFixed(2)),

    longestFocusBlockMinutes:
      Math.round(longestFocusBlock/60000),

    totalActivities:
      activities.length,

    dominantIntent: topIntent

  };
}
import dayjs from "dayjs";
export async function getGrowthTrend(req: Request, res: Response) {

  const { userId } = req.query;

  try {

    const activities = await prisma.activity.findMany({
      where: {
        session: { userId: String(userId) }
      }
    });

    const result: any = {};

    activities.forEach((a) => {

      const day = dayjs(a.startTime).format("YYYY-MM-DD");

      if (!result[day]) {
        result[day] = 0;
      }

      result[day] += a.duration;

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
