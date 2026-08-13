import { Router } from 'express';
import { prisma } from '../prisma';
import ical from 'node-ical';
import { emitCalendarChanged } from '../websocket/broadcaster';
import {
  getCalendarTrackingSettings,
  getCalendarMeetingInsights,
  getCalendarSessionSummary,
  endManualCalendarSession,
  deleteManualCalendarSession,
  listCalendarSessions,
  logManualCalendarSession,
  materializeCalendarEventSession,
  processCalendarLifecycle,
  reviewCalendarSession,
  reviewCalendarSessions,
  startManualCalendarSession,
  updateCalendarSession,
  updateCalendarTrackingSettings,
} from '../services/calendarTrackingService';
import {
  clearRecurringCalendarEvent,
  detachRecurringOccurrence,
  expandRecurringCalendarEvent,
  validateRecurrenceRule,
} from '../services/calendarRecurrenceService';
import {
  dismissCalendarReminder,
  listCalendarReminders,
  snoozeCalendarReminder,
  syncCalendarEventReminder,
  syncCalendarEventReminders,
} from '../services/calendarReminderService';
import { getCalendarIntelligence } from '../services/calendarIntelligenceService';
import { stopCalendarFocusForEvent } from '../services/calendarFocusService';
import { normalizeAllDayCalendarRange, parseCalendarDate } from '../services/calendarTimeService';

const router = Router();

async function calendarTimezone(userId: string) {
  return (await getCalendarTrackingSettings(userId)).timezone;
}

const FOCUS_ENFORCEMENT_LEVELS = new Set(['observe', 'warn', 'require_reason', 'block']);

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 100);
}

function focusEnforcement(value: unknown) {
  return typeof value === 'string' && FOCUS_ENFORCEMENT_LEVELS.has(value) ? value : 'warn';
}

router.get('/tracking/settings', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  res.json(await getCalendarTrackingSettings(userId));
});

router.patch('/tracking/settings', async (req, res) => {
  const { userId, ...settings } = req.body;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    const updated = await updateCalendarTrackingSettings(userId, settings);
    emitCalendarChanged(userId, 'updated', { settings: updated });
    res.json(updated);
  } catch (error) {
    console.error('Calendar settings update error:', error);
    res.status(400).json({ error: 'Failed to update calendar tracking settings' });
  }
});

router.get('/sessions', async (req, res) => {
  const { userId, from, to, status } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    const timezone = await calendarTimezone(userId);
    const rangeStart = parseCalendarDate(from, timezone);
    const rangeEnd = parseCalendarDate(to, timezone, true);
    if ((from && !rangeStart) || (to && !rangeEnd) || (rangeStart && rangeEnd && rangeEnd <= rangeStart)) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    const sessions = await listCalendarSessions(
      userId,
      rangeStart,
      rangeEnd,
      typeof status === 'string' ? status : undefined
    );
    res.json(sessions);
  } catch (error) {
    console.error('Calendar sessions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar sessions' });
  }
});

router.get('/sessions/summary', async (req, res) => {
  const { userId, from, to } = req.query;
  if (!userId || typeof userId !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Provide userId, from, and to' });
  }
  try {
    const timezone = await calendarTimezone(userId);
    const startAt = parseCalendarDate(from, timezone);
    const endAt = parseCalendarDate(to, timezone, true);
    if (!startAt || !endAt || endAt <= startAt) return res.status(400).json({ error: 'Invalid date range' });
    res.json(await getCalendarSessionSummary(userId, startAt, endAt));
  } catch (error) {
    console.error('Calendar summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar session summary' });
  }
});

router.get('/sessions/insights', async (req, res) => {
  const { userId, from, to } = req.query;
  if (!userId || typeof userId !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Provide userId, from, and to' });
  }
  try {
    const timezone = await calendarTimezone(userId);
    const startAt = parseCalendarDate(from, timezone);
    const endAt = parseCalendarDate(to, timezone, true);
    if (!startAt || !endAt || endAt <= startAt) return res.status(400).json({ error: 'Invalid date range' });
    res.json(await getCalendarMeetingInsights(userId, startAt, endAt));
  } catch (error) {
    console.error('Calendar insights fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar meeting insights' });
  }
});

router.get('/intelligence', async (req, res) => {
  const { userId, from, to } = req.query;
  if (!userId || typeof userId !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Provide userId, from, and to' });
  }
  try {
    const timezone = await calendarTimezone(userId);
    const startAt = parseCalendarDate(from, timezone);
    const endAt = parseCalendarDate(to, timezone, true);
    if (!startAt || !endAt || endAt <= startAt) return res.status(400).json({ error: 'Invalid date range' });
    res.json(await getCalendarIntelligence(userId, startAt, endAt));
  } catch (error) {
    console.error('Calendar intelligence fetch error:', error);
    res.status(500).json({ error: 'Failed to analyze calendar schedule' });
  }
});

router.post('/sessions/manual/start', async (req, res) => {
  const { userId, type, title, projectId } = req.body;
  if (!userId || !type) return res.status(400).json({ error: 'Provide userId and type' });
  try {
    res.status(201).json(await startManualCalendarSession(userId, { type, title, projectId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start session';
    res.status(message.includes('active manual') ? 409 : 400).json({ error: message });
  }
});

router.post('/sessions/manual/log', async (req, res) => {
  const { userId, type, title, startAt, endAt, projectId } = req.body;
  if (!userId || !type || !startAt || !endAt) {
    return res.status(400).json({ error: 'Provide userId, type, startAt, and endAt' });
  }
  try {
    const timezone = await calendarTimezone(userId);
    const parsedStart = parseCalendarDate(startAt, timezone);
    const parsedEnd = parseCalendarDate(endAt, timezone);
    if (!parsedStart || !parsedEnd || parsedEnd <= parsedStart) throw new Error('Invalid session date range');
    res.status(201).json(await logManualCalendarSession(userId, {
      type,
      title,
      startAt: parsedStart,
      endAt: parsedEnd,
      projectId,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to log session';
    res.status(400).json({ error: message });
  }
});

router.post('/sessions/:id/end', async (req, res) => {
  const { userId, endedAt } = req.body;
  if (!userId) return res.status(400).json({ error: 'Provide userId' });
  try {
    const timezone = await calendarTimezone(userId);
    const parsedEnd = endedAt ? parseCalendarDate(endedAt, timezone) : undefined;
    if (endedAt && !parsedEnd) throw new Error('Invalid session end time');
    res.json(await endManualCalendarSession(userId, req.params.id, parsedEnd));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to end session';
    res.status(404).json({ error: message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Provide userId' });
  try {
    await deleteManualCalendarSession(userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete session';
    res.status(404).json({ error: message });
  }
});

router.post('/sessions/:id/review', async (req, res) => {
  const { id } = req.params;
  const { userId, action } = req.body;
  if (!userId || !['confirm', 'reject', 'missed'].includes(action)) {
    return res.status(400).json({ error: 'Provide userId and action: confirm, reject, or missed' });
  }
  try {
    res.json(await reviewCalendarSession(userId, id, action));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed';
    res.status(404).json({ error: message });
  }
});

router.post('/sessions/review/bulk', async (req, res) => {
  const { userId, sessionIds, action } = req.body;
  if (!userId || !Array.isArray(sessionIds) || !['confirm', 'reject', 'missed'].includes(action)) {
    return res.status(400).json({ error: 'Provide userId, sessionIds, and action: confirm, reject, or missed' });
  }
  try {
    res.json(await reviewCalendarSessions(userId, sessionIds.map(String), action));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk review failed';
    res.status(400).json({ error: message });
  }
});

router.patch('/sessions/:id', async (req, res) => {
  const { userId, title, type, status, actualStart, actualEnd, projectId } = req.body;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Provide userId' });
  try {
    const timezone = await calendarTimezone(userId);
    const parsedActualStart = actualStart ? parseCalendarDate(actualStart, timezone) : undefined;
    const parsedActualEnd = actualEnd ? parseCalendarDate(actualEnd, timezone) : undefined;
    if ((actualStart && !parsedActualStart) || (actualEnd && !parsedActualEnd)) throw new Error('Invalid session date');
    res.json(await updateCalendarSession(userId, req.params.id, {
      title,
      type,
      status,
      actualStart: actualStart === undefined ? undefined : actualStart ? parsedActualStart : null,
      actualEnd: actualEnd === undefined ? undefined : actualEnd ? parsedActualEnd : null,
      projectId,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update calendar session';
    res.status(message.includes('not found') ? 404 : message.includes('active session') ? 409 : 400).json({ error: message });
  }
});

router.post('/tracking/reconcile', async (_req, res) => {
  try {
    await processCalendarLifecycle();
    res.json({ success: true, processedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Calendar reconciliation error:', error);
    res.status(500).json({ error: 'Failed to reconcile calendar sessions' });
  }
});

router.get('/reminders', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    res.json(await listCalendarReminders(userId));
  } catch (error) {
    console.error('Calendar reminder fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar reminders' });
  }
});

router.post('/reminders/:id/snooze', async (req, res) => {
  const { userId, minutes = 10 } = req.body;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    res.json(await snoozeCalendarReminder(req.params.id, userId, Number(minutes)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to snooze reminder';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

router.post('/reminders/:id/dismiss', async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    res.json(await dismissCalendarReminder(req.params.id, userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dismiss reminder';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

// POST /api/calendar/import  — import events from an ICS feed/string
// Body: { userId, ics: string }  OR  { userId, url: string }
router.post('/import', async (req, res) => {
  const { userId, ics, url } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  if (!ics && !url) {
    return res.status(400).json({ error: 'Provide either ics (string) or url' });
  }

  try {
    let parsed: any;

    if (url) {
      parsed = await ical.async.fromURL(url as string);
    } else {
      parsed = ical.sync.parseICS(ics as string);
    }

    const events: any[] = [];
    const now = new Date();

    for (const key of Object.keys(parsed)) {
      const ev = parsed[key];
      if (ev.type !== 'VEVENT') continue;

      // Skip events that have already ended
      if (ev.end && new Date(ev.end) < now) continue;

      const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
      const end = ev.end instanceof Date ? ev.end : new Date(ev.end);
      const allDay = Boolean(ev.start?.dateOnly) || ev.datetype === 'date';

      // For all-day events, default duration is 1 day
      const normalizedEnd = allDay && (!ev.end || end.getTime() === start.getTime())
        ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
        : end;

      const created = await prisma.calendarEvent.create({
        data: {
          userId,
          title: ev.summary || 'Untitled event',
          description: null,
          location: ev.location || null,
          startAt: start,
          endAt: normalizedEnd,
          allDay: allDay || false,
          color: null,
          source: 'ics',
          status: ev.status ? String(ev.status).toLowerCase() : 'confirmed',
          busy: true,
          recurrenceRule: ev.rrule ? String(ev.rrule) : null,
          externalId: ev.uid || null,
          notes: null,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      events.push(created);
      await materializeCalendarEventSession(created.id);
    }

    emitCalendarChanged(userId, 'imported', { imported: events.length, events });
    res.json({ imported: events.length, events });
  } catch (error) {
    console.error('Calendar import error:', error);
    res.status(500).json({ error: 'Failed to import calendar events' });
  }
});

// GET /api/calendar/overlay?userId=...&from=...&to=...
// Returns calendar events as timeline-compatible blocks (for overlaying onto the timeline view)
router.get('/overlay', async (req, res) => {
  const { userId, from, to } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to' });
  }

  try {
    const timezone = await calendarTimezone(userId);
    const rangeStart = parseCalendarDate(from, timezone);
    const rangeEnd = parseCalendarDate(to, timezone, true);
    if (!rangeStart || !rangeEnd || rangeEnd <= rangeStart) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        status: { not: 'cancelled' },
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
      },
      orderBy: { startAt: 'asc' },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    const overlay = events.map((evt) => ({
      id: evt.id,
      title: evt.title,
      start: evt.startAt,
      end: evt.endAt,
      allDay: evt.allDay,
      color: evt.color || evt.project?.color || '#8b5cf6',
      category: 'calendar',
      status: evt.status,
      busy: evt.busy,
      location: evt.location,
      recurrenceRule: evt.recurrenceRule,
      reminderMinutes: evt.reminderMinutes,
      project: evt.project,
      description: evt.description,
      notes: evt.notes,
    }));

    res.json(overlay);
  } catch (error) {
    console.error('Calendar overlay error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar overlay' });
  }
});

// GET /api/calendar?userId=...&from=...&to=...
router.get('/', async (req, res) => {
  const { userId, from, to } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const where: any = { userId, status: { not: 'cancelled' } };

    if (from && to) {
      const timezone = await calendarTimezone(userId);
      const rangeStart = parseCalendarDate(from, timezone);
      const rangeEnd = parseCalendarDate(to, timezone, true);
      if (!rangeStart || !rangeEnd || rangeEnd <= rangeStart) {
        return res.status(400).json({ error: 'Invalid date range' });
      }
      where.startAt = { lte: rangeEnd };
      where.endAt = { gte: rangeStart };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        recurrenceParent: { select: { id: true, recurrenceRule: true } },
      },
      orderBy: { startAt: 'asc' },
    });
    res.json(events);
  } catch (error) {
    console.error('Calendar fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar
router.post('/', async (req, res) => {
  const {
    userId,
    title,
    startAt,
    endAt,
    allDay,
    color,
    description,
    location,
    source,
    status,
    busy,
    recurrenceRule,
    reminderMinutes,
    projectId,
    deepWorkId,
    focusAutoStart,
    focusEnforcement: requestedFocusEnforcement,
    focusAllowedApps,
    focusAllowedDomains,
    focusBlockedApps,
    focusBlockedDomains,
    notes,
    attendeeCount,
    attendeeStatus,
    eventType,
  } = req.body;

  if (!userId || !title || !startAt || !endAt) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, startAt, endAt' });
  }

  try {
    const timezone = await calendarTimezone(userId);
    let parsedStart = parseCalendarDate(startAt, timezone);
    let parsedEnd = parseCalendarDate(endAt, timezone);
    if (allDay) {
      const normalized = normalizeAllDayCalendarRange(startAt, endAt, timezone);
      parsedStart = normalized?.startAt;
      parsedEnd = normalized?.endAt;
    }
    if (!parsedStart || !parsedEnd || parsedEnd <= parsedStart) {
      return res.status(400).json({ error: 'Invalid event date range' });
    }
    const normalizedRecurrence = validateRecurrenceRule(recurrenceRule, parsedStart);
    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title,
        description: description || null,
        location: location || null,
        startAt: parsedStart,
        endAt: parsedEnd,
        allDay: allDay || false,
        color: color || null,
        source: source || 'manual',
        status: status || 'confirmed',
        busy: busy ?? true,
        recurrenceRule: normalizedRecurrence,
        reminderMinutes: reminderMinutes ?? null,
        projectId: projectId || null,
        deepWorkId: deepWorkId || null,
        focusAutoStart: eventType === 'focus' && Boolean(focusAutoStart),
        focusEnforcement: focusEnforcement(requestedFocusEnforcement),
        focusAllowedApps: stringList(focusAllowedApps),
        focusAllowedDomains: stringList(focusAllowedDomains),
        focusBlockedApps: stringList(focusBlockedApps),
        focusBlockedDomains: stringList(focusBlockedDomains),
        notes: notes || null,
        attendeeCount: Math.max(0, Number(attendeeCount ?? 0)),
        attendeeStatus: attendeeStatus || 'unknown',
        eventType: eventType || 'event',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });
    await materializeCalendarEventSession(event.id);
    const occurrences = normalizedRecurrence ? await expandRecurringCalendarEvent(event.id) : [];
    await Promise.all(occurrences.map((occurrence) => materializeCalendarEventSession(occurrence.id)));
    await syncCalendarEventReminders([event.id, ...occurrences.map((occurrence) => occurrence.id)]);
    emitCalendarChanged(userId, 'created', { event, occurrenceCount: occurrences.length });
    res.json({ ...event, occurrenceCount: occurrences.length });
  } catch (error) {
    console.error('Event creation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create event';
    res.status(message.includes('recurrence') || message.includes('Recurrence') ? 400 : 500).json({ error: message });
  }
});

// PATCH /api/calendar/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    userId,
    title,
    startAt,
    endAt,
    allDay,
    color,
    description,
    location,
    status,
    busy,
    recurrenceRule,
    reminderMinutes,
    projectId,
    deepWorkId,
    focusAutoStart,
    focusEnforcement: requestedFocusEnforcement,
    focusAllowedApps,
    focusAllowedDomains,
    focusBlockedApps,
    focusBlockedDomains,
    notes,
    attendeeCount,
    attendeeStatus,
    eventType,
    recurrenceScope,
  } = req.body;

  const existing = await prisma.calendarEvent.findFirst({ where: { id, ...(userId ? { userId } : {}) } });
  if (!existing) return res.status(404).json({ error: 'Calendar event not found' });

  try {
    const timezone = await calendarTimezone(existing.userId);
    let parsedStart = startAt !== undefined ? parseCalendarDate(startAt, timezone) : existing.startAt;
    let parsedEnd = endAt !== undefined ? parseCalendarDate(endAt, timezone) : existing.endAt;
    if (allDay !== false && (allDay === true || existing.allDay)) {
      const normalized = normalizeAllDayCalendarRange(parsedStart, parsedEnd, timezone);
      parsedStart = normalized?.startAt;
      parsedEnd = normalized?.endAt;
    }
    if (!parsedStart || !parsedEnd || parsedEnd <= parsedStart) {
      return res.status(400).json({ error: 'Invalid event date range' });
    }
    const data: any = {
      ...(title !== undefined ? { title } : {}),
      ...(startAt !== undefined ? { startAt: parsedStart } : {}),
      ...(endAt !== undefined ? { endAt: parsedEnd } : {}),
      ...(allDay !== undefined ? { allDay: Boolean(allDay) } : {}),
      ...(color !== undefined ? { color: color || null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(location !== undefined ? { location: location || null } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(busy !== undefined ? { busy: Boolean(busy) } : {}),
      ...(recurrenceRule !== undefined ? { recurrenceRule: validateRecurrenceRule(recurrenceRule, parsedStart) } : {}),
      ...(reminderMinutes !== undefined ? { reminderMinutes: reminderMinutes ?? null } : {}),
      ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      ...(deepWorkId !== undefined ? { deepWorkId: deepWorkId || null } : {}),
      ...(focusAutoStart !== undefined ? { focusAutoStart: Boolean(focusAutoStart) } : {}),
      ...(requestedFocusEnforcement !== undefined ? { focusEnforcement: focusEnforcement(requestedFocusEnforcement) } : {}),
      ...(focusAllowedApps !== undefined ? { focusAllowedApps: stringList(focusAllowedApps) } : {}),
      ...(focusAllowedDomains !== undefined ? { focusAllowedDomains: stringList(focusAllowedDomains) } : {}),
      ...(focusBlockedApps !== undefined ? { focusBlockedApps: stringList(focusBlockedApps) } : {}),
      ...(focusBlockedDomains !== undefined ? { focusBlockedDomains: stringList(focusBlockedDomains) } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(attendeeCount !== undefined ? { attendeeCount: Math.max(0, Number(attendeeCount)) } : {}),
      ...(attendeeStatus !== undefined ? { attendeeStatus } : {}),
      ...(eventType !== undefined ? { eventType } : {}),
      ...(eventType !== undefined && eventType !== 'focus' ? { focusAutoStart: false } : {}),
    };
    if (existing.recurrenceParentId && recurrenceScope !== 'series') {
      await detachRecurringOccurrence(existing.id);
      data.recurrenceException = true;
      data.recurrenceRule = null;
    }
    const targetId = recurrenceScope === 'series' && existing.recurrenceParentId
      ? existing.recurrenceParentId
      : existing.id;
    if (recurrenceScope === 'series' && existing.recurrenceParentId && (startAt !== undefined || endAt !== undefined)) {
      const parent = await prisma.calendarEvent.findUnique({ where: { id: existing.recurrenceParentId } });
      if (!parent) return res.status(404).json({ error: 'Recurring series not found' });
      const requestedStart = parsedStart;
      const requestedEnd = parsedEnd;
      const shiftedParentStart = new Date(parent.startAt.getTime() + (requestedStart.getTime() - existing.startAt.getTime()));
      data.startAt = shiftedParentStart;
      data.endAt = new Date(shiftedParentStart.getTime() + Math.max(1, requestedEnd.getTime() - requestedStart.getTime()));
    }
    const event = await prisma.calendarEvent.update({
      where: { id: targetId },
      data,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });
    await materializeCalendarEventSession(event.id);
    const occurrences = event.recurrenceRule && !event.recurrenceParentId
      ? await expandRecurringCalendarEvent(event.id)
      : [];
    if (!event.recurrenceRule && existing.recurrenceRule && !existing.recurrenceParentId) {
      await clearRecurringCalendarEvent(event.id);
    }
    await Promise.all(occurrences.map((occurrence) => materializeCalendarEventSession(occurrence.id)));
    await syncCalendarEventReminders([event.id, ...occurrences.map((occurrence) => occurrence.id)]);
    if (event.status === 'cancelled' || event.eventType !== 'focus' || !event.focusAutoStart) {
      await stopCalendarFocusForEvent(event.id);
    }
    emitCalendarChanged(event.userId, 'updated', { event, occurrenceCount: occurrences.length });
    res.json({ ...event, occurrenceCount: occurrences.length });
  } catch (error) {
    console.error('Event update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update event';
    res.status(message.includes('recurrence') || message.includes('Recurrence') ? 400 : 500).json({ error: message });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const scope = req.query.scope === 'series' ? 'series' : 'occurrence';

  try {
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Calendar event not found' });
    if (existing.recurrenceParentId && scope === 'occurrence') {
      await stopCalendarFocusForEvent(id);
      await prisma.$transaction([
        prisma.calendarSession.deleteMany({ where: { calendarEventId: id, actualStart: null, actualDurationMs: 0 } }),
        prisma.calendarEvent.update({
          where: { id },
          data: { status: 'cancelled', recurrenceException: true },
        }),
      ]);
      await syncCalendarEventReminder(id);
      emitCalendarChanged(existing.userId, 'deleted', { id, scope });
      return res.json({ success: true, scope });
    }
    const targetId = scope === 'series' && existing.recurrenceParentId ? existing.recurrenceParentId : id;
    await stopCalendarFocusForEvent(targetId);
    const [, event] = await prisma.$transaction([
      prisma.calendarSession.deleteMany({
        where: scope === 'series'
          ? { calendarEvent: { OR: [{ id: targetId }, { recurrenceParentId: targetId }] }, actualStart: null, actualDurationMs: 0 }
          : { calendarEventId: targetId, actualStart: null, actualDurationMs: 0 },
      }),
      prisma.calendarEvent.delete({ where: { id: targetId } }),
    ]);
    emitCalendarChanged(event.userId, 'deleted', { id: targetId, scope });
    res.json({ success: true, scope });
  } catch (error) {
    console.error('Event deletion error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
