import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getOrCreateActiveSession } from "./sessionService";
import { classifyActivity } from "./contextClassifier";
import { getISTDayRange } from "../utils/time";
import {
  clamp,
  clamp01,
  getBaseFocus,
  getActivityProductivityScore,
  isIdleActivity
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
      confidence: classification.confidence
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

  const weightedFocus =
    normalizedActivities.reduce((sum, a) => {
      const impact = isIdleActivity(a) ? 0 : getBaseFocus(a);
      return sum + impact * a.durationMs;
    }, 0) / totalDuration;

  const focusScore = clamp(weightedFocus * 100);

  const deepWorkDuration = activeActivities
    .filter(a => a.category === "deep_work")
    .reduce((sum, a) => sum + a.durationMs, 0);

  const deepWorkScore =
    activeDuration > 0
      ? clamp((deepWorkDuration / activeDuration) * 100)
      : 0;

  const isDeepWork =
    deepWorkDuration >= 10 * 60 * 1000 || deepWorkScore >= 50;

  const productivityScore = clamp(
    normalizedActivities.reduce(
      (sum, a) =>
        sum + getActivityProductivityScore(a) * a.durationMs,
      0
    ) / totalDuration
  );

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

  const burnoutScore = clamp(
    durationFactor * 35 +
    switchFactor * 25 +
    entropyFactor * 20 +
    communicationRatio * 20
  );

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

export async function getTimeline(userId: string, date: string) {

  const { start, end } =
    getISTDayRange(new Date(date + "T00:00:00"));

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: { startTime: "asc" }
  });
  console.log("[Timeline Fetch]", {
    userId,
    date,
    start,
    end,
    count: activities.length
  });
  return compressTimeline(activities);

}

/* -------------------------------------------------------------------------- */
/*                              DEEP WORK BLOCKS                              */
/* -------------------------------------------------------------------------- */

export async function getFocusBlocks(userId: string, date: string) {

  const { start, end } =
    getISTDayRange(new Date(date + "T00:00:00"));

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: { startTime: "asc" }
  });

  return detectFocusBlocks(activities);

}

function detectFocusBlocks(activities: any[]) {

  const MIN_BLOCK_DURATION = 10 * 60 * 1000;

  const blocks: any[] = [];

  let currentBlock: any = null;

  for (const activity of activities) {

    const isDeepWork =
      activity.category === "deep_work";

    if (!isDeepWork) {

      if (currentBlock) {

        finalizeBlock(
          currentBlock,
          blocks,
          MIN_BLOCK_DURATION
        );

        currentBlock = null;

      }

      continue;

    }

    if (!currentBlock) {

      currentBlock = {
        start: activity.startTime,
        end: activity.endTime,
        duration: activity.duration
      };

    } else {

      currentBlock.end = activity.endTime;
      currentBlock.duration += activity.duration;

    }

  }

  if (currentBlock) {

    finalizeBlock(
      currentBlock,
      blocks,
      MIN_BLOCK_DURATION
    );

  }

  return blocks;

}

function finalizeBlock(
  block: any,
  blocks: any[],
  minDuration: number
) {

  if (block.duration >= minDuration) {

    blocks.push({
      start: block.start,
      end: block.end,
      duration: block.duration
    });

  }

}