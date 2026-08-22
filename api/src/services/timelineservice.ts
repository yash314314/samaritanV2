import { prisma } from "../prisma";
import { getBaseFocus, getActivityProductivityScore } from "./metricEngine";

const IST_OFFSET = "+05:30";

function dateRange(from: string, to = from) {
  const start = new Date(`${from}T00:00:00${IST_OFFSET}`);
  const inclusiveEnd = new Date(`${to}T00:00:00${IST_OFFSET}`);
  const end = new Date(inclusiveEnd.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export async function getTimeline(userId: string, date?: string, from?: string, to?: string) {
  // Build where clause
  const where: any = {
    session: { userId },
  };
  let range: { start: Date; end: Date } | null = null;

  if (from || to) {
    range = dateRange(from ?? to!, to ?? from!);
  } else if (date) {
    range = dateRange(date);
  }

  if (range) {
    where.startTime = {
      lt: range.end,
    };
    where.endTime = {
      gt: range.start,
    };
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: {
      session: {
        select: { id: true, userId: true },
      },
    },
  });

  // Group into sessions by contiguous app usage
  const sessions: any[] = [];
  let currentSession: any = null;

  for (const activity of activities) {
    const activityStart = activity.startTime;
    const activityEnd = activity.endTime ?? new Date(activity.startTime.getTime() + activity.duration);
    const clippedStart = range
      ? new Date(Math.max(activityStart.getTime(), range.start.getTime()))
      : activityStart;
    const clippedEnd = range
      ? new Date(Math.min(activityEnd.getTime(), range.end.getTime()))
      : activityEnd;
    const clippedDuration = Math.max(0, clippedEnd.getTime() - clippedStart.getTime());
    if (clippedDuration <= 0) continue;

    const activityFocusScore = getBaseFocus(activity) * 100;
    const activityProductivityScore = getActivityProductivityScore(activity);

    if (
      !currentSession ||
      currentSession.appName !== activity.appName ||
      currentSession.category !== (activity.category ?? "unknown") ||
      currentSession.intent !== (activity.intent ?? "unknown") ||
      clippedStart.getTime() - new Date(currentSession.end).getTime() > 60000 // 1 min gap = new session
    ) {
      if (currentSession) sessions.push(currentSession);
      currentSession = {
        appName: activity.appName,
        iconUrl: activity.iconUrl,
        domain: activity.domain,
        url: activity.url,
        start: clippedStart,
        end: clippedEnd,
        duration: 0,
        category: activity.category ?? "unknown",
        intent: activity.intent ?? "unknown",
        confidence: activity.confidence ?? 0,
        focusImpact: activity.focusImpact ?? 0.25,
        focusScore: activityFocusScore,
        productivityScore: activityProductivityScore,
        activityIds: [],
        items: [],
      };
    }

    currentSession.end = clippedEnd;
    currentSession.duration = new Date(currentSession.end).getTime() - new Date(currentSession.start).getTime();
    currentSession.activityIds.push(activity.id);
    currentSession.items.push({
      id: activity.id,
      title: activity.windowTitle ?? activity.appName,
      iconUrl: activity.iconUrl,
      domain: activity.domain,
      url: activity.url,
      category: activity.category ?? "unknown",
      intent: activity.intent ?? "unknown",
      confidence: activity.confidence ?? 0,
      focusImpact: activity.focusImpact ?? 0.25,
      focusScore: activityFocusScore,
      productivityScore: activityProductivityScore,
      start: clippedStart,
      end: clippedEnd,
      duration: clippedDuration,
    });

    currentSession.confidence = Math.min(
      currentSession.confidence,
      activity.confidence ?? 0
    );
    const weightedDuration = currentSession.items.reduce(
      (sum: number, item: any) => sum + Number(item.duration ?? 0),
      0
    );
    currentSession.focusImpact = weightedDuration > 0
      ? currentSession.items.reduce(
          (sum: number, item: any) => sum + Number(item.focusImpact ?? 0.25) * Number(item.duration ?? 0),
          0
        ) / weightedDuration
      : activity.focusImpact ?? 0.25;
    currentSession.focusScore = weightedDuration > 0
      ? currentSession.items.reduce(
          (sum: number, item: any) => sum + Number(item.focusScore ?? 0) * Number(item.duration ?? 0),
          0
        ) / weightedDuration
      : activityFocusScore;
    currentSession.productivityScore = weightedDuration > 0
      ? currentSession.items.reduce(
          (sum: number, item: any) => sum + Number(item.productivityScore ?? 0) * Number(item.duration ?? 0),
          0
        ) / weightedDuration
      : activityProductivityScore;
  }

  if (currentSession) sessions.push(currentSession);

  return sessions;
}


/* -------------------------------------------------------------------------- */
/*                          ACTIVITY MERGING ENGINE                           */
/* -------------------------------------------------------------------------- */

function mergeActivities(activities: any[]) {

  if (!activities.length) return [];

  const merged: any[] = [];
  let current: any = null;

  for (const a of activities) {

    if (!current) {

      current = {
        appName: a.appName,
        iconUrl: a.iconUrl,
        domain: a.domain,
        url: a.url,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration,
        category: a.category,
        items: [
          {
            title: a.windowTitle,
            iconUrl: a.iconUrl,
            domain: a.domain,
            url: a.url,
            start: a.startTime,
            end: a.endTime,
            duration: a.duration
          }
        ]
      };

      continue;
    }

    /* ---------- SAME APP MERGE ---------- */

    if (current.appName === a.appName) {

      current.end = a.endTime;
      current.duration += a.duration;
      current.iconUrl = current.iconUrl ?? a.iconUrl;
      current.domain = current.domain ?? a.domain;
      current.url = current.url ?? a.url;

      current.items.push({
        title: a.windowTitle,
        iconUrl: a.iconUrl,
        domain: a.domain,
        url: a.url,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration
      });

    }

    /* ---------- NEW APP ---------- */

    else {

      merged.push(current);

      current = {
        appName: a.appName,
        iconUrl: a.iconUrl,
        domain: a.domain,
        url: a.url,
        start: a.startTime,
        end: a.endTime,
        duration: a.duration,
        category: a.category,
        items: [
          {
            title: a.windowTitle,
            iconUrl: a.iconUrl,
            domain: a.domain,
            url: a.url,
            start: a.startTime,
            end: a.endTime,
            duration: a.duration
          }
        ]
      };

    }

  }

  if (current) merged.push(current);

  return merged;

}
