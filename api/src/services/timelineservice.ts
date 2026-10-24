import { getBaseFocus, getActivityProductivityScore } from "./metricEngine";
import { loadResolvedActivities } from "./rangeActivityQuery";
import type { ISTDateRange } from "../utils/time";

/**
 * Activities overlapping the inclusive IST day range, grouped into contiguous
 * same-app/category/intent sessions. Each item is clipped to the range and only
 * carries the time it owns after overlap resolution, so the sum of session
 * durations equals active + idle seconds from /analytics/daily for the range.
 * `duration` of a session is the sum of its items; gaps of up to one minute
 * between items keep them in one session but are not counted as tracked time.
 */
export async function getTimeline(userId: string, range: ISTDateRange) {
  const items = await loadResolvedActivities(userId, range.start, range.end);

  const sessions: any[] = [];
  let currentSession: any = null;

  for (const item of items) {
    const { activity } = item;
    const clippedStart = new Date(item.startMs);
    const clippedEnd = new Date(item.endMs);
    const clippedDuration = item.ms;
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

    if (clippedEnd > currentSession.end) currentSession.end = clippedEnd;
    currentSession.duration += clippedDuration;
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
      (sum: number, entry: any) => sum + Number(entry.duration ?? 0),
      0
    );
    currentSession.focusImpact = weightedDuration > 0
      ? currentSession.items.reduce(
          (sum: number, entry: any) => sum + Number(entry.focusImpact ?? 0.25) * Number(entry.duration ?? 0),
          0
        ) / weightedDuration
      : activity.focusImpact ?? 0.25;
    currentSession.focusScore = weightedDuration > 0
      ? currentSession.items.reduce(
          (sum: number, entry: any) => sum + Number(entry.focusScore ?? 0) * Number(entry.duration ?? 0),
          0
        ) / weightedDuration
      : activityFocusScore;
    currentSession.productivityScore = weightedDuration > 0
      ? currentSession.items.reduce(
          (sum: number, entry: any) => sum + Number(entry.productivityScore ?? 0) * Number(entry.duration ?? 0),
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
