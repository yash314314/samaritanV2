import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getOrCreateActiveSession } from "./sessionService";
import { classifyActivity } from "./contextClassifier";
import { tagActivityToProject } from "./projectTagger";
import type { ISTDateRange } from "../utils/time";
import { loadResolvedActivities } from "./rangeActivityQuery";
import { detectDeepWorkBlocks } from "./rangeMetrics";
import {
  clamp,
  clamp01,
  isIdleActivity,
  updateSmoothMetricState
} from "./metricEngine";
const IDLE_THRESHOLD_MS = 60 * 1000;

/* -------------------------------------------------------------------------- */
/*                                  ACTIVITY                                  */
/* -------------------------------------------------------------------------- */

export async function handleActivity(
  userId: string,
  appName: string,
  windowTitle: string,
  startTime?: Date,
  endTime?: Date,
  duration?: number,
  type?: string
) {

  const session = await getOrCreateActiveSession(userId);

  const classification = await classifyActivity(appName, windowTitle);

  const effectiveStart = startTime ?? new Date();
  const effectiveEnd = endTime ?? new Date();
  const effectiveDuration = duration ?? 0;
  const effectiveType = type ?? "active";

  // Auto-tag activity to project based on matching rules
  const tagResult = await tagActivityToProject(userId, appName, null, windowTitle);
  const projectId = tagResult.projectId;

  const activity = await prisma.activity.create({
    data: {
      sessionId: session.id,
      appName,
      windowTitle,
      startTime: effectiveStart,
      endTime: effectiveEnd,
      duration: effectiveDuration,
      type: effectiveType,
      category: classification.category,
      intent: classification.intent,
      focusImpact: classification.focusImpact,
      energyImpact: classification.energyImpact,
      confidence: classification.confidence,
      projectId: projectId ?? null
    }
  });

  await recalculateSessionMetrics(session.id);

  return activity;

}

/* -------------------------------------------------------------------------- */
/*                            SESSION METRIC ENGINE                           */
/* -------------------------------------------------------------------------- */



export async function recalculateSessionMetrics(sessionId: string) {
  const activities = await prisma.activity.findMany({
    where: { sessionId },
    orderBy: { startTime: "asc" }
  });

  if (activities.length === 0) return;

  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) return;

  const normalizedActivities = activities
    .map(a => ({
      ...a,
      durationMs: Math.max(0, a.duration ?? 0)
    }))
    .filter(a => a.durationMs > 0);

  const totalDuration = normalizedActivities.reduce(
    (sum, a) => sum + a.durationMs,
    0
  );

  if (totalDuration === 0) return;

  const activeActivities = normalizedActivities.filter(
    a => !isIdleActivity(a)
  );

  const activeDuration = activeActivities.reduce(
    (sum, a) => sum + a.durationMs,
    0
  );

  const idleDuration = totalDuration - activeDuration;

  const smoothState = normalizedActivities.reduce(
    (state, activity) => updateSmoothMetricState(state, activity),
    {
      focusScore: 0,
      productivityScore: 0,
      deepWorkScore: 0,
      burnoutScore: 0
    }
  );

  const focusScore = smoothState.focusScore;

  const deepWorkDuration = activeActivities
    .filter(a => a.category === "deep_work")
    .reduce((sum, a) => sum + a.durationMs, 0);

  const deepWorkScore = smoothState.deepWorkScore;

  const isDeepWork =
    deepWorkDuration >= 10 * 60 * 1000 || deepWorkScore >= 50;

  const productivityScore = smoothState.productivityScore;

  let switchCount = 0;
  let previousContext: string | null = null;

  for (const activity of activeActivities) {
    const context = `${activity.appName}::${activity.windowTitle ?? ""}`;

    if (previousContext && previousContext !== context) {
      switchCount++;
    }

    previousContext = context;
  }

  const appDurations: Record<string, number> = {};

  activeActivities.forEach(a => {
    appDurations[a.appName] =
      (appDurations[a.appName] || 0) + a.durationMs;
  });

  const appCount = Object.keys(appDurations).length;

  let entropyScore = 0;

  if (activeDuration > 0 && appCount > 1) {
    let entropy = 0;

    Object.values(appDurations).forEach(duration => {
      const p = duration / activeDuration;
      entropy -= p * Math.log2(p);
    });

    const maxEntropy = Math.log2(appCount);
    entropyScore = clamp((entropy / maxEntropy) * 100);
  }

  const activeDurationSeconds = activeDuration / 1000;
  const activeHours = activeDurationSeconds / 3600;

  const communicationDuration = activeActivities
    .filter(a => a.category === "communication")
    .reduce((sum, a) => sum + a.durationMs, 0);

  const communicationRatio =
    activeDuration > 0 ? communicationDuration / activeDuration : 0;

  const switchesPerHour =
    activeHours > 0 ? switchCount / activeHours : 0;

  const durationFactor = clamp01(activeDurationSeconds / 14400);
  const switchFactor = clamp01(switchesPerHour / 20);
  const entropyFactor = entropyScore / 100;

  const behavioralBurnoutScore = clamp(
    durationFactor * 35 +
    switchFactor * 25 +
    entropyFactor * 20 +
    communicationRatio * 20
  );
  const burnoutScore = clamp(Math.max(smoothState.burnoutScore, behavioralBurnoutScore));

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      focusScore,
      deepWorkScore,
      burnoutScore,
      entropyScore,
      switchCount,
      idleTime: idleDuration,
      totalDuration,
      productivityScore,
      isDeepWork
    }
  });
}
/* -------------------------------------------------------------------------- */
/*                              TIMELINE ENGINE                               */
/* -------------------------------------------------------------------------- */

function compressTimeline(activities: any[]) {

  if (!activities.length) return [];

  const groups: Record<string, any[]> = {};

  for (const a of activities) {

    if (!groups[a.appName]) {
      groups[a.appName] = [];
    }

    groups[a.appName].push(a);

  }

  const timeline: any[] = [];

  for (const appName of Object.keys(groups)) {

    const group = groups[appName];

    let start = group[0].startTime;
    let end = group[0].endTime;
    let duration = 0;
    const category = group[0].category;

    const items: Record<string, number> = {};

    for (const a of group) {

      duration += a.duration;

      if (a.startTime < start)
        start = a.startTime;

      if (a.endTime > end)
        end = a.endTime;

      items[a.windowTitle] =
        (items[a.windowTitle] || 0) + a.duration;

    }

    timeline.push({
      appName,
      category,
      start,
      end,
      duration,
      items: Object.entries(items)
        .map(([title,duration])=>({title,duration}))
        .sort((a,b)=>b.duration-a.duration)
    });

  }

  return timeline;

}

/* -------------------------------------------------------------------------- */
/*                                TIMELINE API                                */
/* -------------------------------------------------------------------------- */

export async function getTimeline(userId: string, range: ISTDateRange) {

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: range.start,
        lt: range.end
      }
    },
    orderBy: { startTime: "asc" }
  });
  return compressTimeline(activities);

}

/* -------------------------------------------------------------------------- */
/*                              DEEP WORK BLOCKS                              */
/* -------------------------------------------------------------------------- */

const MIN_FOCUS_BLOCK_MS = 10 * 60 * 1000;

/**
 * Contiguous deep_work blocks of at least ten minutes inside the IST day range.
 * Blocks break on any other activity (including idle) or a gap over two
 * minutes; `duration` is owned deep-work time in ms, clipped to the range.
 */
export async function getFocusBlocks(userId: string, range: ISTDateRange) {
  const items = await loadResolvedActivities(userId, range.start, range.end);
  return detectDeepWorkBlocks(items).filter((block) => block.duration >= MIN_FOCUS_BLOCK_MS);
}
