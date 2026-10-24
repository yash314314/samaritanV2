import { prisma } from "../prisma";
import { recalculateSessionMetrics } from "./activityService";
import { emitActivityReviewed } from "../websocket/broadcaster";
import { dispatchWebhookEvent } from "./webhookService";

const allowedCategories = new Set([
  "deep_work",
  "development_tools",
  "productivity",
  "research",
  "communication",
  "media",
  "entertainment",
  "system",
  "idle",
]);

export type ActivityReviewInput = {
  activityIds: string[];
  category: string;
  intent: string;
  focusImpact: number;
  remember?: boolean;
};

function validateReview(review: ActivityReviewInput) {
  if (!Array.isArray(review.activityIds) || review.activityIds.length === 0) {
    throw new Error("Each review requires at least one activity ID");
  }
  if (!allowedCategories.has(review.category)) {
    throw new Error(`Unsupported category: ${review.category}`);
  }
  if (!review.intent?.trim() || review.intent === "unknown") {
    throw new Error("Each review requires an intent");
  }
  if (!Number.isFinite(review.focusImpact) || review.focusImpact < 0 || review.focusImpact > 1) {
    throw new Error("Focus impact must be between 0 and 1");
  }
}

const MAX_PATTERNS_PER_USER = 2000;

function exactTitlePattern(title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^${escaped}$`;
}

export async function reviewActivities(
  userId: string,
  reviews: ActivityReviewInput[]
) {
  if (!userId) throw new Error("Missing userId");
  if (!Array.isArray(reviews) || reviews.length === 0 || reviews.length > 100) {
    throw new Error("Reviews must contain between 1 and 100 entries");
  }

  reviews.forEach(validateReview);

  const requestedIds = [...new Set(reviews.flatMap((review) => review.activityIds))];
  const activities = await prisma.activity.findMany({
    where: {
      id: { in: requestedIds },
      session: { userId },
    },
    select: {
      id: true,
      sessionId: true,
      appName: true,
      windowTitle: true,
      energyImpact: true,
    },
  });

  if (activities.length !== requestedIds.length) {
    throw new Error("One or more activities were not found for this user");
  }

  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  await prisma.$transaction(async (tx) => {
    for (const review of reviews) {
      await tx.activity.updateMany({
        where: { id: { in: review.activityIds } },
        data: {
          category: review.category,
          intent: review.intent.trim(),
          focusImpact: review.focusImpact,
          confidence: 1,
        },
      });

      if (review.remember === false) continue;

      const contexts = new Map<string, { appName: string; titleRegex: string; energyImpact: number | null }>();
      for (const id of review.activityIds) {
        const activity = activityById.get(id)!;
        const titleRegex = exactTitlePattern(activity.windowTitle);
        contexts.set(`${activity.appName}\u0000${titleRegex}`, {
          appName: activity.appName,
          titleRegex,
          energyImpact: activity.energyImpact,
        });
      }

      for (const context of contexts.values()) {
        const existing = await tx.appPattern.findFirst({
          where: { userId, appName: context.appName, titleRegex: context.titleRegex },
          select: { id: true },
        });
        const data = {
          category: review.category,
          intent: review.intent.trim(),
          focusImpact: review.focusImpact,
          energyImpact: context.energyImpact ?? 0,
          confidence: 1,
        };

        if (existing) {
          await tx.appPattern.update({ where: { id: existing.id }, data });
        } else {
          // Every pattern is scanned on each classification; a bounded set keeps that cheap.
          if ((await tx.appPattern.count({ where: { userId } })) >= MAX_PATTERNS_PER_USER) continue;
          await tx.appPattern.create({
            data: {
              userId,
              appName: context.appName,
              titleRegex: context.titleRegex,
              ...data,
            },
          });
        }
      }
    }
  });

  const sessionIds = [...new Set(activities.map((activity) => activity.sessionId))];
  await Promise.all(sessionIds.map((sessionId) => recalculateSessionMetrics(sessionId)));

  const result = {
    reviewedActivities: requestedIds.length,
    reviewedEntries: reviews.length,
    activityIds: requestedIds,
  };
  emitActivityReviewed(userId, result);
  void dispatchWebhookEvent(userId, "activity.reviewed", result, requestedIds.sort().join(":"))
    .catch((error) => console.error("Activity review webhook dispatch failed:", error));
  return result;
}
