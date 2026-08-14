import type { Activity } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Prisma } from "@prisma/client";

import { prisma } from "../prisma";
import { emitCalendarSessionChanged, emitSmartBreakChanged } from "../websocket/broadcaster";
import { dispatchWebhookEvent } from "./webhookService";
import { getCalendarTrackingSettings } from "./calendarTrackingService";
import { isIdleActivity } from "./metricEngine";

dayjs.extend(utc);
dayjs.extend(timezone);

const MINUTE_MS = 60_000;
const LOOKBACK_MS = 12 * 60 * MINUTE_MS;

const DEFAULT_SETTINGS = {
  enabled: true,
  workThresholdMinutes: 90,
  breakDurationMinutes: 10,
  snoozeMinutes: 15,
  resetIdleMinutes: 5,
  workHoursOnly: true,
};

type BreakSettingsInput = Partial<typeof DEFAULT_SETTINGS>;

type WorkActivity = Pick<
  Activity,
  "appName" | "category" | "type" | "startTime" | "endTime" | "duration"
>;

export type ContinuousWork = {
  workMs: number;
  streakStartedAt: Date | null;
  lastActivityAt: Date | null;
};

export function calculateContinuousWork(
  activities: WorkActivity[],
  now: Date,
  resetGapMs: number,
  since?: Date | null
): ContinuousWork {
  const lowerBound = since?.getTime() ?? -Infinity;
  const sorted = [...activities].sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
  let workMs = 0;
  let streakStartedAt: Date | null = null;
  let lastActivityAt: Date | null = null;

  for (const activity of sorted) {
    const startMs = Math.max(activity.startTime.getTime(), lowerBound);
    const durationEndMs = activity.duration > 0
      ? activity.startTime.getTime() + activity.duration
      : activity.endTime.getTime();
    const endMs = Math.min(activity.endTime.getTime(), durationEndMs, now.getTime());
    if (endMs <= startMs) continue;

    if (isIdleActivity(activity)) {
      if (endMs - startMs >= resetGapMs) {
        workMs = 0;
        streakStartedAt = null;
        lastActivityAt = null;
      }
      continue;
    }

    if (lastActivityAt && startMs - lastActivityAt.getTime() >= resetGapMs) {
      workMs = 0;
      streakStartedAt = null;
      lastActivityAt = null;
    }

    const countedStartMs = lastActivityAt ? Math.max(startMs, lastActivityAt.getTime()) : startMs;
    if (!streakStartedAt) streakStartedAt = new Date(startMs);
    workMs += Math.max(0, endMs - countedStartMs);
    if (!lastActivityAt || endMs > lastActivityAt.getTime()) lastActivityAt = new Date(endMs);
  }

  if (!lastActivityAt || now.getTime() - lastActivityAt.getTime() >= resetGapMs) {
    return { workMs: 0, streakStartedAt: null, lastActivityAt };
  }
  return { workMs, streakStartedAt, lastActivityAt };
}

export async function getSmartBreakSettings(userId: string) {
  const stored = await prisma.smartBreakSettings.findUnique({ where: { userId } });
  return stored ?? { userId, ...DEFAULT_SETTINGS, createdAt: null, updatedAt: null };
}

export async function updateSmartBreakSettings(userId: string, input: BreakSettingsInput) {
  const current = await getSmartBreakSettings(userId);
  const data = {
    enabled: Boolean(input.enabled ?? current.enabled),
    workThresholdMinutes: boundedInteger(input.workThresholdMinutes ?? current.workThresholdMinutes, 15, 240),
    breakDurationMinutes: boundedInteger(input.breakDurationMinutes ?? current.breakDurationMinutes, 1, 60),
    snoozeMinutes: boundedInteger(input.snoozeMinutes ?? current.snoozeMinutes, 5, 120),
    resetIdleMinutes: boundedInteger(input.resetIdleMinutes ?? current.resetIdleMinutes, 2, 30),
    workHoursOnly: Boolean(input.workHoursOnly ?? current.workHoursOnly),
  };
  const settings = await prisma.smartBreakSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  if (!settings.enabled) {
    await prisma.smartBreak.updateMany({
      where: { userId, status: { in: ["suggested", "snoozed"] } },
      data: { status: "expired", openKey: null, endedAt: new Date() },
    });
  }
  emitSmartBreakChanged(userId, "settings", { settings });
  return settings;
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) throw new Error("Break setting must be a number");
  return Math.max(minimum, Math.min(maximum, parsed));
}

function withinConfiguredWorkHours(
  now: Date,
  timeZone: string,
  workHours: Array<{ dayOfWeek: number; enabled: boolean; startMinute: number; endMinute: number }>
) {
  const local = dayjs(now).tz(timeZone);
  const schedule = workHours.find((item) => item.dayOfWeek === local.day());
  if (!schedule?.enabled) return false;
  const minute = local.hour() * 60 + local.minute();
  return minute >= schedule.startMinute && minute < schedule.endMinute;
}

async function latestBreakReset(userId: string) {
  const session = await prisma.calendarSession.findFirst({
    where: {
      userId,
      type: "break",
      status: "confirmed",
      actualEnd: { not: null },
    },
    orderBy: { actualEnd: "desc" },
    select: { actualEnd: true },
  });
  return session?.actualEnd ?? null;
}

async function currentContinuousWork(userId: string, now: Date, resetIdleMinutes: number) {
  const lastReset = await latestBreakReset(userId);
  const from = new Date(Math.max(now.getTime() - LOOKBACK_MS, lastReset?.getTime() ?? 0));
  const activities = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: { lt: now },
      endTime: { gt: from },
    },
    orderBy: { startTime: "asc" },
    select: {
      appName: true,
      category: true,
      type: true,
      startTime: true,
      endTime: true,
      duration: true,
    },
  });
  return calculateContinuousWork(activities, now, resetIdleMinutes * MINUTE_MS, lastReset);
}

async function hasBlockingCommitment(userId: string, now: Date, breakMinutes: number) {
  const proposedEnd = new Date(now.getTime() + breakMinutes * MINUTE_MS);
  return prisma.calendarSession.findFirst({
    where: {
      userId,
      type: { in: ["meeting", "focus"] },
      source: { not: "smart-break" },
      status: { notIn: ["rejected", "missed", "completed"] },
      OR: [
        { scheduledStart: { lt: proposedEnd }, scheduledEnd: { gt: now } },
        { actualStart: { lt: proposedEnd }, actualEnd: null, status: "active" },
      ],
    },
    orderBy: { scheduledStart: "asc" },
    select: { id: true, title: true, scheduledEnd: true },
  });
}

function recommendationReason(workMs: number, thresholdMinutes: number) {
  const roundedMinutes = Math.max(thresholdMinutes, Math.round(workMs / MINUTE_MS));
  return `${roundedMinutes} minutes of sustained activity detected`;
}

async function advanceOpenBreak(userId: string, now: Date) {
  const open = await prisma.smartBreak.findUnique({ where: { openKey: userId } });
  if (!open) return null;

  if (open.status === "active" && open.startedAt) {
    const plannedEnd = new Date(open.startedAt.getTime() + open.recommendedMinutes * MINUTE_MS);
    if (plannedEnd <= now) {
      await endSmartBreak(userId, open.id, plannedEnd);
      return null;
    }
  }

  if (open.status === "snoozed" && open.snoozedUntil && open.snoozedUntil <= now) {
    const suggested = await prisma.smartBreak.update({
      where: { id: open.id },
      data: { status: "suggested", dueAt: now, snoozedUntil: null },
    });
    emitSmartBreakChanged(userId, "suggested", { break: suggested });
    return suggested;
  }
  return open;
}

export async function evaluateSmartBreak(userId: string, now = new Date()) {
  const open = await advanceOpenBreak(userId, now);
  if (open) return open;

  const settings = await getSmartBreakSettings(userId);
  if (!settings.enabled) return null;

  const calendarSettings = await getCalendarTrackingSettings(userId);
  if (
    settings.workHoursOnly &&
    !withinConfiguredWorkHours(now, calendarSettings.timezone, calendarSettings.workHours)
  ) return null;

  const [activeDeepWork, recentSkip, commitment] = await Promise.all([
    prisma.deepWorkSession.findFirst({ where: { userId, status: "active" }, select: { id: true } }),
    prisma.smartBreak.findFirst({
      where: { userId, status: "skipped", endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      select: { endedAt: true },
    }),
    hasBlockingCommitment(userId, now, settings.breakDurationMinutes),
  ]);
  if (activeDeepWork || commitment) return null;
  if (recentSkip?.endedAt && now.getTime() - recentSkip.endedAt.getTime() < settings.snoozeMinutes * MINUTE_MS) {
    return null;
  }

  const streak = await currentContinuousWork(userId, now, settings.resetIdleMinutes);
  if (streak.workMs < settings.workThresholdMinutes * MINUTE_MS) return null;

  try {
    const suggestion = await prisma.smartBreak.create({
      data: {
        userId,
        openKey: userId,
        status: "suggested",
        suggestedAt: now,
        dueAt: now,
        continuousWorkMs: Math.round(streak.workMs),
        recommendedMinutes: settings.breakDurationMinutes,
        reason: recommendationReason(streak.workMs, settings.workThresholdMinutes),
      },
    });
    emitSmartBreakChanged(userId, "suggested", { break: suggestion, streak });
    return suggestion;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.smartBreak.findUnique({ where: { openKey: userId } });
    }
    throw error;
  }
}

export async function getNextSmartBreak(userId: string, now = new Date()) {
  const [settings, current] = await Promise.all([
    getSmartBreakSettings(userId),
    evaluateSmartBreak(userId, now),
  ]);
  const streak = await currentContinuousWork(userId, now, settings.resetIdleMinutes);
  return {
    break: current,
    settings,
    streak: {
      ...streak,
      thresholdMs: settings.workThresholdMinutes * MINUTE_MS,
      progressPercent: Math.min(100, Math.round((streak.workMs / (settings.workThresholdMinutes * MINUTE_MS)) * 100)),
    },
  };
}

export async function startSmartBreak(
  userId: string,
  input: { breakId?: string; recommendedMinutes?: number; reason?: string } = {},
  now = new Date()
) {
  let item = input.breakId
    ? await prisma.smartBreak.findFirst({ where: { id: input.breakId, userId } })
    : await prisma.smartBreak.findUnique({ where: { openKey: userId } });

  if (item?.status === "active") return item;
  if (item && !["suggested", "snoozed"].includes(item.status)) throw new Error("Break suggestion is no longer active");

  const settings = await getSmartBreakSettings(userId);
  const recommendedMinutes = boundedInteger(
    input.recommendedMinutes ?? item?.recommendedMinutes ?? settings.breakDurationMinutes,
    1,
    60
  );

  if (!item) {
    try {
      item = await prisma.smartBreak.create({
        data: {
          userId,
          openKey: userId,
          status: "suggested",
          suggestedAt: now,
          dueAt: now,
          continuousWorkMs: 0,
          recommendedMinutes,
          reason: input.reason?.trim() || "Recovery break started manually",
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      item = await prisma.smartBreak.findUnique({ where: { openKey: userId } });
    }
  }
  if (!item) throw new Error("Could not create break");
  if (item.status === "active") return item;
  if (!["suggested", "snoozed"].includes(item.status)) throw new Error("Break suggestion is no longer active");

  const scheduledEnd = new Date(now.getTime() + recommendedMinutes * MINUTE_MS);
  const result = await prisma.$transaction(async (tx) => {
    const calendarSession = await tx.calendarSession.create({
      data: {
        userId,
        type: "break",
        source: "smart-break",
        status: "active",
        title: "Recovery break",
        scheduledStart: now,
        scheduledEnd,
        actualStart: now,
        confidence: 1,
        reviewReason: item!.reason,
      },
    });
    return tx.smartBreak.update({
      where: { id: item!.id },
      data: {
        status: "active",
        startedAt: now,
        snoozedUntil: null,
        recommendedMinutes,
        calendarSessionId: calendarSession.id,
      },
    });
  });

  emitCalendarSessionChanged(userId, "started", { sessionId: result.calendarSessionId, type: "break" });
  emitSmartBreakChanged(userId, "started", { break: result });
  return result;
}

export async function snoozeSmartBreak(userId: string, breakId: string, minutes?: number, now = new Date()) {
  const settings = await getSmartBreakSettings(userId);
  const snoozeMinutes = boundedInteger(minutes ?? settings.snoozeMinutes, 5, 120);
  const item = await prisma.smartBreak.findFirst({
    where: { id: breakId, userId, status: { in: ["suggested", "snoozed"] }, openKey: userId },
  });
  if (!item) throw new Error("Active break suggestion not found");
  const snoozedUntil = new Date(now.getTime() + snoozeMinutes * MINUTE_MS);
  const updated = await prisma.smartBreak.update({
    where: { id: item.id },
    data: { status: "snoozed", snoozedUntil, dueAt: snoozedUntil },
  });
  emitSmartBreakChanged(userId, "snoozed", { break: updated });
  return updated;
}

export async function skipSmartBreak(userId: string, breakId: string, now = new Date()) {
  const item = await prisma.smartBreak.findFirst({
    where: { id: breakId, userId, status: { in: ["suggested", "snoozed"] }, openKey: userId },
  });
  if (!item) throw new Error("Active break suggestion not found");
  const updated = await prisma.smartBreak.update({
    where: { id: item.id },
    data: { status: "skipped", openKey: null, endedAt: now, snoozedUntil: null },
  });
  emitSmartBreakChanged(userId, "skipped", { break: updated });
  void dispatchWebhookEvent(userId, "break.skipped", { break: updated }, updated.id)
    .catch((error) => console.error("Break webhook dispatch failed:", error));
  return updated;
}

export async function endSmartBreak(userId: string, breakId: string, now = new Date()) {
  const item = await prisma.smartBreak.findFirst({
    where: { id: breakId, userId, status: "active", openKey: userId },
  });
  if (!item?.startedAt) throw new Error("Active break not found");
  const endedAt = now > item.startedAt ? now : new Date(item.startedAt.getTime() + 1_000);
  const updated = await prisma.$transaction(async (tx) => {
    if (item.calendarSessionId) {
      await tx.calendarSession.updateMany({
        where: { id: item.calendarSessionId, userId, source: "smart-break" },
        data: {
          status: "confirmed",
          actualEnd: endedAt,
          actualDurationMs: endedAt.getTime() - item.startedAt!.getTime(),
          reviewedAt: endedAt,
        },
      });
    }
    return tx.smartBreak.update({
      where: { id: item.id },
      data: { status: "completed", openKey: null, endedAt, snoozedUntil: null },
    });
  });
  if (item.calendarSessionId) {
    emitCalendarSessionChanged(userId, "ended", { sessionId: item.calendarSessionId, type: "break" });
  }
  emitSmartBreakChanged(userId, "completed", { break: updated });
  void dispatchWebhookEvent(userId, "break.completed", { break: updated }, updated.id)
    .catch((error) => console.error("Break webhook dispatch failed:", error));
  return updated;
}

export async function getSmartBreakHistory(userId: string, from: Date, to: Date) {
  const breaks = await prisma.smartBreak.findMany({
    where: { userId, suggestedAt: { gte: from, lt: to } },
    orderBy: { suggestedAt: "desc" },
    take: 200,
  });
  const completed = breaks.filter((item) => item.status === "completed");
  return {
    breaks,
    summary: {
      suggested: breaks.length,
      completed: completed.length,
      skipped: breaks.filter((item) => item.status === "skipped").length,
      completionRate: breaks.length ? Math.round((completed.length / breaks.length) * 100) : 0,
      recoveryMs: completed.reduce((sum, item) => {
        if (!item.startedAt || !item.endedAt) return sum;
        return sum + Math.max(0, item.endedAt.getTime() - item.startedAt.getTime());
      }, 0),
    },
  };
}

let lifecycleTimer: NodeJS.Timeout | null = null;
let lifecycleRunning = false;

export function startSmartBreakLifecycle() {
  if (lifecycleTimer) return;
  lifecycleTimer = setInterval(async () => {
    if (lifecycleRunning) return;
    lifecycleRunning = true;
    try {
      const open = await prisma.smartBreak.findMany({
        where: { openKey: { not: null } },
        distinct: ["userId"],
        select: { userId: true },
      });
      await Promise.all(open.map(({ userId }) => evaluateSmartBreak(userId).catch((error) => {
        console.error("[SmartBreak] Lifecycle evaluation failed", error);
      })));
    } finally {
      lifecycleRunning = false;
    }
  }, 30_000);
  lifecycleTimer.unref?.();
}
