import type { CalendarEvent } from "@prisma/client";
import { RRule } from "rrule";
import { prisma } from "../prisma";

const PAST_WINDOW_DAYS = 31;
const FUTURE_WINDOW_DAYS = 370;
const MAX_OCCURRENCES = 500;

function normalizedRule(rule: string) {
  const value = rule.trim().replace(/^RRULE:/i, "");
  if (!value) return null;
  if (!/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i.test(value)) {
    throw new Error("Recurrence must use DAILY, WEEKLY, MONTHLY, or YEARLY frequency");
  }
  return value.toUpperCase();
}

export function validateRecurrenceRule(rule?: string | null, startAt?: Date) {
  if (!rule) return null;
  const normalized = normalizedRule(rule);
  if (!normalized) return null;
  try {
    const parsed = RRule.fromString(normalized);
    if (startAt) new RRule({ ...parsed.origOptions, dtstart: startAt }).between(startAt, new Date(startAt.getTime() + 366 * 24 * 60 * 60_000), true);
    return normalized;
  } catch {
    throw new Error("Invalid recurrence rule");
  }
}

function occurrenceStarts(parent: CalendarEvent, from: Date, to: Date) {
  if (!parent.recurrenceRule) return [];
  const normalized = validateRecurrenceRule(parent.recurrenceRule, parent.startAt)!;
  const parsed = RRule.fromString(normalized);
  const recurrence = new RRule({ ...parsed.origOptions, dtstart: parent.startAt });
  const occurrences = recurrence.between(from, to, true);
  if (occurrences.length > MAX_OCCURRENCES) throw new Error("Recurrence generates too many occurrences in the expansion window");
  return occurrences;
}

function occurrenceData(parent: CalendarEvent, originalStart: Date) {
  const durationMs = Math.max(1, parent.endAt.getTime() - parent.startAt.getTime());
  return {
    userId: parent.userId,
    title: parent.title,
    description: parent.description,
    location: parent.location,
    startAt: originalStart,
    endAt: new Date(originalStart.getTime() + durationMs),
    allDay: parent.allDay,
    color: parent.color,
    source: parent.source,
    status: parent.status,
    busy: parent.busy,
    recurrenceRule: null,
    recurrenceParentId: parent.id,
    recurrenceOriginalStart: originalStart,
    recurrenceException: false,
    reminderMinutes: parent.reminderMinutes,
    projectId: parent.projectId,
    deepWorkId: null,
    focusAutoStart: parent.focusAutoStart,
    focusEnforcement: parent.focusEnforcement,
    focusAllowedApps: parent.focusAllowedApps,
    focusAllowedDomains: parent.focusAllowedDomains,
    focusBlockedApps: parent.focusBlockedApps,
    focusBlockedDomains: parent.focusBlockedDomains,
    notes: parent.notes,
    attendeeCount: parent.attendeeCount,
    attendeeStatus: parent.attendeeStatus,
    eventType: parent.eventType,
    syncStatus: parent.syncStatus,
  };
}

export async function expandRecurringCalendarEvent(parentId: string, now = new Date()) {
  const parent = await prisma.calendarEvent.findUnique({ where: { id: parentId } });
  if (!parent || parent.recurrenceParentId || !parent.recurrenceRule) return [];

  const from = new Date(Math.max(parent.startAt.getTime(), now.getTime() - PAST_WINDOW_DAYS * 24 * 60 * 60_000));
  const to = new Date(now.getTime() + FUTURE_WINDOW_DAYS * 24 * 60 * 60_000);
  const starts = occurrenceStarts(parent, from, to).filter((start) => start.getTime() !== parent.startAt.getTime());
  const validKeys = new Set(starts.map((start) => start.toISOString()));
  const existing = await prisma.calendarEvent.findMany({ where: { recurrenceParentId: parent.id } });

  for (const occurrence of existing) {
    if (occurrence.recurrenceException || !occurrence.recurrenceOriginalStart) continue;
    if (!validKeys.has(occurrence.recurrenceOriginalStart.toISOString())) {
      await prisma.$transaction([
        prisma.calendarSession.deleteMany({
          where: { calendarEventId: occurrence.id, actualStart: null, actualDurationMs: 0 },
        }),
        prisma.calendarEvent.delete({ where: { id: occurrence.id } }),
      ]);
    }
  }

  const expanded: CalendarEvent[] = [];
  for (const start of starts) {
    const matching = existing.find((occurrence) => occurrence.recurrenceOriginalStart?.getTime() === start.getTime());
    if (matching?.recurrenceException) {
      expanded.push(matching);
      continue;
    }
    const data = occurrenceData(parent, start);
    if (matching) {
      const occurrence = await prisma.calendarEvent.update({ where: { id: matching.id }, data: { ...data, deepWorkId: matching.deepWorkId } });
      expanded.push(occurrence);
      continue;
    }
    const occurrence = await prisma.calendarEvent.upsert({
      where: {
        recurrenceParentId_recurrenceOriginalStart: {
          recurrenceParentId: parent.id,
          recurrenceOriginalStart: start,
        },
      },
      update: data,
      create: data,
    });
    expanded.push(occurrence);
  }
  return expanded;
}

let lastRefreshAt = 0;

export async function refreshRecurringCalendarEvents(now = new Date(), force = false) {
  if (!force && now.getTime() - lastRefreshAt < 60 * 60_000) return;
  lastRefreshAt = now.getTime();
  const parents = await prisma.calendarEvent.findMany({
    where: { recurrenceRule: { not: null }, recurrenceParentId: null, status: { not: "cancelled" } },
    select: { id: true },
  });
  for (const parent of parents) await expandRecurringCalendarEvent(parent.id, now);
}

export async function detachRecurringOccurrence(eventId: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event?.recurrenceParentId) return event;
  return prisma.calendarEvent.update({ where: { id: eventId }, data: { recurrenceException: true } });
}

export async function clearRecurringCalendarEvent(parentId: string) {
  const children = await prisma.calendarEvent.findMany({
    where: { recurrenceParentId: parentId },
    select: { id: true },
  });
  if (children.length === 0) return;
  const ids = children.map((child) => child.id);
  await prisma.$transaction([
    prisma.calendarSession.deleteMany({
      where: { calendarEventId: { in: ids }, actualStart: null, actualDurationMs: 0 },
    }),
    prisma.calendarEvent.deleteMany({ where: { id: { in: ids } } }),
  ]);
}
