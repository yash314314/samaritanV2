import { Router } from 'express';
import { prisma } from '../prisma';
import ical from 'node-ical';
import { emitCalendarChanged } from '../websocket/broadcaster';

const router = Router();

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
          description: ev.description || null,
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
          notes: ev.description || null,
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
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { lte: new Date(to as string + 'T23:59:59.999') },
        endAt: { gte: new Date(from as string + 'T00:00:00') },
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
    const where: any = { userId };

    if (from && to) {
      where.startAt = {
        gte: new Date(from as string),
        lte: new Date(to as string),
      };
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
    notes,
  } = req.body;

  if (!userId || !title || !startAt || !endAt) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, startAt, endAt' });
  }

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title,
        description: description || null,
        location: location || null,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        allDay: allDay || false,
        color: color || null,
        source: source || 'manual',
        status: status || 'confirmed',
        busy: busy ?? true,
        recurrenceRule: recurrenceRule || null,
        reminderMinutes: reminderMinutes ?? null,
        projectId: projectId || null,
        deepWorkId: deepWorkId || null,
        notes: notes || null,
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
    emitCalendarChanged(userId, 'created', { event });
    res.json(event);
  } catch (error) {
    console.error('Event creation error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PATCH /api/calendar/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  // Convert date fields if present
  if (data.startAt) data.startAt = new Date(data.startAt);
  if (data.endAt) data.endAt = new Date(data.endAt);

  try {
    const event = await prisma.calendarEvent.update({
      where: { id },
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
    emitCalendarChanged(event.userId, 'updated', { event });
    res.json(event);
  } catch (error) {
    console.error('Event update error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const event = await prisma.calendarEvent.delete({ where: { id } });
    emitCalendarChanged(event.userId, 'deleted', { id });
    res.json({ success: true });
  } catch (error) {
    console.error('Event deletion error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
