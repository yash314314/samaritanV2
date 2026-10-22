import type { Activity } from "@prisma/client";
import { prisma } from "../prisma";
import { resolveActivityTime, type EffectiveActivity } from "./rangeMetrics";

/** Every activity of the user that overlaps [start, end), ordered by start. */
export function findActivitiesOverlapping(userId: string, start: Date, end: Date, where: { category?: string } = {}) {
  return prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { lt: end },
      endTime: { gt: start },
      ...where,
    },
    orderBy: { startTime: "asc" },
  });
}

/** Activities clipped to [start, end) with overlaps resolved (see rangeMetrics). */
export async function loadResolvedActivities(userId: string, start: Date, end: Date): Promise<EffectiveActivity<Activity>[]> {
  const activities = await findActivitiesOverlapping(userId, start, end);
  return resolveActivityTime(activities, start.getTime(), end.getTime());
}
