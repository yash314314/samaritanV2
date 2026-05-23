import { prisma } from "../prisma";
import { getISTDayRange } from "../utils/time";

export async function getTimeline(userId: string, date: string) {

  /* ---------- IST SAFE RANGE ---------- */

  const { start, end } =
    getISTDayRange(new Date(date + "T00:00:00"));

  /* ---------- FETCH ACTIVITIES ---------- */

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: {
      startTime: "asc"
    }
  });

  /* ---------- MERGE ---------- */

  const merged = mergeActivities(activities);

  const latestRaw = activities[activities.length - 1];
  const latestMerged = merged[merged.length - 1];
  const latestMergedItem = latestMerged?.items?.[latestMerged.items.length - 1];

  console.log("[Timeline Fetch]", {
    userId,
    date,
    rawCount: activities.length,
    mergedCount: merged.length,
    latestRaw: latestRaw
      ? {
          appName: latestRaw.appName,
          title: latestRaw.windowTitle,
          start: latestRaw.startTime,
          end: latestRaw.endTime,
          duration: latestRaw.duration
        }
      : null,
    latestMerged: latestMerged
      ? {
          appName: latestMerged.appName,
          title: latestMergedItem?.title,
          start: latestMerged.start,
          end: latestMerged.end,
          duration: latestMerged.duration
        }
      : null
  });
  return merged;

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