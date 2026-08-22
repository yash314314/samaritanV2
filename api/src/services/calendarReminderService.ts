import type { CalendarEvent, CalendarReminder } from "@prisma/client";
import { prisma } from "../prisma";
import { emitCalendarReminderChanged, emitCalendarReminderDue } from "../websocket/broadcaster";

const MINUTE_MS = 60_000;
const RECONCILE_WINDOW_MS = 370 * 24 * 60 * MINUTE_MS;
const OVERDUE_GRACE_MS = 15 * MINUTE_MS;
const SCHEDULER_INTERVAL_MS = 15_000;

export type CalendarReminderPayload = CalendarReminder & {
  effectiveAt: Date;
  calendarEvent: Pick<CalendarEvent, "id" | "title" | "startAt" | "endAt" | "allDay" | "location" | "color" | "eventType">;
};

const reminderInclude = {
  calendarEvent: {
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      allDay: true,
      location: true,
      color: true,
      eventType: true,
      status: true,
    },
  },
} as const;

function reminderTime(event: Pick<CalendarEvent, "startAt" | "reminderMinutes">) {
  return new Date(event.startAt.getTime() - Math.max(0, event.reminderMinutes ?? 0) * MINUTE_MS);
}

function withEffectiveAt<T extends CalendarReminder>(reminder: T) {
  return {
    ...reminder,
    effectiveAt: reminder.status === "snoozed" && reminder.snoozedUntil
      ? reminder.snoozedUntil
      : reminder.status === "delivered" && reminder.deliveredAt
      ? reminder.deliveredAt
      : reminder.remindAt,
  };
}

export async function syncCalendarEventReminder(eventId: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event) return null;

  if (event.reminderMinutes == null || event.status === "cancelled") {
    await prisma.calendarReminder.deleteMany({ where: { calendarEventId: event.id } });
    return null;
  }

  const remindAt = reminderTime(event);
  const existing = await prisma.calendarReminder.findUnique({ where: { calendarEventId: event.id } });
  if (!existing) {
    return prisma.calendarReminder.create({
      data: { userId: event.userId, calendarEventId: event.id, remindAt },
      include: reminderInclude,
    });
  }

  const timingChanged = existing.remindAt.getTime() !== remindAt.getTime();
  return prisma.calendarReminder.update({
    where: { id: existing.id },
    data: {
      userId: event.userId,
      remindAt,
      ...(timingChanged ? { status: "scheduled", deliveredAt: null, snoozedUntil: null } : {}),
    },
    include: reminderInclude,
  });
}

export async function syncCalendarEventReminders(eventIds: string[]) {
  return Promise.all([...new Set(eventIds)].map(syncCalendarEventReminder));
}

export async function reconcileCalendarReminders(now = new Date()) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      reminderMinutes: { not: null },
      status: { not: "cancelled" },
      endAt: { gte: new Date(now.getTime() - OVERDUE_GRACE_MS) },
      startAt: { lte: new Date(now.getTime() + RECONCILE_WINDOW_MS) },
    },
    select: { id: true },
  });
  await syncCalendarEventReminders(events.map((event) => event.id));
}

export async function listCalendarReminders(userId: string, now = new Date()) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      reminderMinutes: { not: null },
      status: { not: "cancelled" },
      endAt: { gte: new Date(now.getTime() - OVERDUE_GRACE_MS) },
      startAt: { lte: new Date(now.getTime() + RECONCILE_WINDOW_MS) },
    },
    select: { id: true },
  });
  await syncCalendarEventReminders(events.map((event) => event.id));

  const reminders = await prisma.calendarReminder.findMany({
    where: {
      userId,
      OR: [
        { status: { in: ["scheduled", "snoozed"] }, calendarEvent: { endAt: { gte: now }, status: { not: "cancelled" } } },
        { status: "delivered", deliveredAt: { gte: new Date(now.getTime() - 24 * 60 * MINUTE_MS) } },
      ],
    },
    include: reminderInclude,
    orderBy: [{ remindAt: "asc" }],
    take: 50,
  });
  return reminders
    .map(withEffectiveAt)
    .sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
}

export async function snoozeCalendarReminder(id: string, userId: string, minutes: number) {
  const existing = await prisma.calendarReminder.findFirst({
    where: { id, userId },
    include: reminderInclude,
  });
  if (!existing) throw new Error("Calendar reminder not found");
  if (existing.calendarEvent.endAt <= new Date()) throw new Error("This event has already ended");

  const reminder = await prisma.calendarReminder.update({
    where: { id },
    data: {
      status: "snoozed",
      snoozedUntil: new Date(Date.now() + Math.max(1, Math.min(120, minutes)) * MINUTE_MS),
    },
    include: reminderInclude,
  });
  const payload = withEffectiveAt(reminder);
  emitCalendarReminderChanged(userId, "snoozed", payload);
  return payload;
}

export async function dismissCalendarReminder(id: string, userId: string) {
  const result = await prisma.calendarReminder.updateMany({
    where: { id, userId },
    data: { status: "dismissed", snoozedUntil: null },
  });
  if (result.count === 0) throw new Error("Calendar reminder not found");
  emitCalendarReminderChanged(userId, "dismissed", { id });
  return { id, status: "dismissed" as const };
}

export async function processDueCalendarReminders(now = new Date()) {
  const candidates = await prisma.calendarReminder.findMany({
    where: {
      OR: [
        { status: "scheduled", remindAt: { lte: now } },
        { status: "snoozed", snoozedUntil: { lte: now } },
      ],
    },
    include: reminderInclude,
    orderBy: [{ remindAt: "asc" }],
    take: 100,
  });

  let delivered = 0;
  for (const candidate of candidates) {
    const expiresAt = new Date(Math.max(candidate.calendarEvent.endAt.getTime(), candidate.calendarEvent.startAt.getTime() + OVERDUE_GRACE_MS));
    if (candidate.calendarEvent.status === "cancelled" || now > expiresAt) {
      await prisma.calendarReminder.updateMany({
        where: { id: candidate.id, status: candidate.status },
        data: { status: "expired", snoozedUntil: null },
      });
      continue;
    }

    const claimed = await prisma.calendarReminder.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        ...(candidate.status === "snoozed"
          ? { snoozedUntil: candidate.snoozedUntil }
          : { remindAt: candidate.remindAt }),
      },
      data: { status: "delivered", deliveredAt: now, snoozedUntil: null },
    });
    if (claimed.count !== 1) continue;

    const payload = withEffectiveAt({ ...candidate, status: "delivered", deliveredAt: now, snoozedUntil: null });
    emitCalendarReminderDue(candidate.userId, payload);
    delivered += 1;
  }
  return delivered;
}

let scheduler: NodeJS.Timeout | null = null;
let lastReconcileAt = 0;

export function startCalendarReminderScheduler() {
  if (scheduler) return;
  const tick = async () => {
    try {
      if (Date.now() - lastReconcileAt >= 60 * MINUTE_MS) {
        await reconcileCalendarReminders();
        lastReconcileAt = Date.now();
      }
      await processDueCalendarReminders();
    } catch (error) {
      console.error("[CalendarReminders] Scheduler failed", error);
    }
  };
  tick();
  scheduler = setInterval(tick, SCHEDULER_INTERVAL_MS);
  console.log("[CalendarReminders] Scheduler running every 15 seconds");
}
