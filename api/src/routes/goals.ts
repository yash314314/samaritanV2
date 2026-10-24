import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../prisma';
import { emitGoalChanged } from '../websocket/broadcaster';
import { getGoalHistory, getGoalsDashboard, goalDateFromInput, hydrateGoalProgress, listGoalsWithProgress } from '../services/goalProgressService';
import { getCalendarTrackingSettings } from '../services/calendarTrackingService';
import { InvalidRequestError } from '../utils/time';
import { parseIntegerParam } from '../utils/requestParams';
import { dispatchWebhookEvent } from '../services/webhookService';

const router = Router();

const GOAL_PERIODS = ['daily', 'weekly', 'monthly'];

// GET /api/goals?userId=...&period=...
router.get('/', async (req, res) => {
  const { userId, period, includeArchived } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  if (period !== undefined && (typeof period !== 'string' || !GOAL_PERIODS.includes(period))) {
    return res.status(400).json({ error: `Invalid period: expected one of ${GOAL_PERIODS.join(', ')}` });
  }

  try {
    const goals = await listGoalsWithProgress(userId, period as string | undefined, includeArchived === 'true');
    res.json(goals);
  } catch (error) {
    console.error('Goals fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

router.get('/dashboard', async (req, res) => {
  const { userId, period } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  if (period !== undefined && (typeof period !== 'string' || !GOAL_PERIODS.includes(period))) {
    return res.status(400).json({ error: `Invalid period: expected one of ${GOAL_PERIODS.join(', ')}` });
  }
  try {
    res.json(await getGoalsDashboard(userId, typeof period === 'string' ? period : undefined));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to load goals dashboard' });
  }
});

router.get('/:id/history', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    const periods = parseIntegerParam(req.query.periods, { name: 'periods', min: 1, max: 90, fallback: 14 });
    res.json(await getGoalHistory(userId, req.params.id, periods));
  } catch (error) {
    if (error instanceof InvalidRequestError) return res.status(400).json({ error: error.message });
    const message = error instanceof Error ? error.message : 'Failed to load goal history';
    res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

router.post('/:id/restore', async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  try {
    const goal = await prisma.goal.findFirst({ where: { id: req.params.id, userId } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const restored = await prisma.goal.update({ where: { id: goal.id }, data: { active: true } });
    const hydrated = await hydrateGoalProgress(restored);
    emitGoalChanged(goal.userId, 'updated', { goal: hydrated });
    res.json(hydrated);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to restore goal' });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  const {
    userId,
    title,
    description,
    type,
    unit,
    target,
    period,
    startDate,
    endDate,
    priority,
    projectId,
  } = req.body;

  if (!userId || !title || !Number.isFinite(Number(target)) || Number(target) <= 0) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, target' });
  }

  try {
    if (!['focus_minutes', 'hours', 'project_minutes', 'productive_minutes', 'sessions'].includes(type || 'focus_minutes')) {
      return res.status(400).json({ error: 'Unsupported goal type' });
    }
    if (!['daily', 'weekly', 'monthly'].includes(period || 'daily')) return res.status(400).json({ error: 'Unsupported goal period' });
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId, active: true }, select: { id: true } });
      if (!project) return res.status(404).json({ error: 'Project not found' });
    }
    const { timezone } = await getCalendarTrackingSettings(userId);
    let parsedStart: Date | null;
    let parsedEnd: Date | null;
    try {
      parsedStart = goalDateFromInput(startDate, timezone);
      parsedEnd = goalDateFromInput(endDate, timezone);
    } catch {
      return res.status(400).json({ error: 'Invalid goal date range' });
    }
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ error: 'Invalid goal date range' });
    }
    const goal = await prisma.goal.create({
      data: {
        userId,
        title: String(title).trim().slice(0, 120),
        description: description || null,
        type: type || 'focus_minutes',
        unit: unit || null,
        target: Number(target),
        period: period || 'daily',
        startDate: parsedStart,
        endDate: parsedEnd,
        priority: priority || 'medium',
        projectId: projectId || null,
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
    const hydrated = await hydrateGoalProgress(goal);
    emitGoalChanged(userId, 'created', { goal: hydrated });
    void dispatchWebhookEvent(userId, 'goal.changed', { action: 'created', goal: hydrated }, goal.id)
      .catch((error) => console.error('Goal webhook dispatch failed:', error));
    res.json(hydrated);
  } catch (error) {
    console.error('Goal creation error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PATCH /api/goals/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    type,
    unit,
    target,
    period,
    startDate,
    endDate,
    priority,
    active,
    projectId,
  } = req.body;

  try {
    const existing = await prisma.goal.findFirst({ where: { id, userId: (req as AuthenticatedRequest).user!.userId } });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    if (target !== undefined && (!Number.isFinite(Number(target)) || Number(target) <= 0)) return res.status(400).json({ error: 'Target must be greater than zero' });
    if (type !== undefined && !['focus_minutes', 'hours', 'project_minutes', 'productive_minutes', 'sessions'].includes(type)) return res.status(400).json({ error: 'Unsupported goal type' });
    if (period !== undefined && !['daily', 'weekly', 'monthly'].includes(period)) return res.status(400).json({ error: 'Unsupported goal period' });
    const { timezone } = await getCalendarTrackingSettings(existing.userId);
    let parsedStart: Date | null = existing.startDate;
    let parsedEnd: Date | null = existing.endDate;
    try {
      if (startDate !== undefined) parsedStart = goalDateFromInput(startDate, timezone);
      if (endDate !== undefined) parsedEnd = goalDateFromInput(endDate, timezone);
    } catch {
      return res.status(400).json({ error: 'Invalid goal date range' });
    }
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ error: 'Invalid goal date range' });
    }
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId: existing.userId, active: true }, select: { id: true } });
      if (!project) return res.status(404).json({ error: 'Project not found' });
    }
    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(unit !== undefined && { unit }),
        ...(target !== undefined && { target: Number(target) }),
        ...(period && { period }),
        ...(startDate !== undefined && { startDate: parsedStart }),
        ...(endDate !== undefined && { endDate: parsedEnd }),
        ...(priority && { priority }),
        ...(active !== undefined && { active }),
        ...(projectId !== undefined && { projectId: projectId || null }),
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
    const hydrated = await hydrateGoalProgress(goal);
    emitGoalChanged(goal.userId, 'updated', { goal: hydrated });
    void dispatchWebhookEvent(goal.userId, 'goal.changed', { action: 'updated', goal: hydrated })
      .catch((error) => console.error('Goal webhook dispatch failed:', error));
    res.json(hydrated);
  } catch (error) {
    console.error('Goal update error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const owned = await prisma.goal.findFirst({ where: { id, userId: (req as AuthenticatedRequest).user!.userId }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: 'Goal not found' });
    const goal = await prisma.goal.update({ where: { id: owned.id }, data: { active: false } });
    emitGoalChanged(goal.userId, 'deleted', { id });
    void dispatchWebhookEvent(goal.userId, 'goal.changed', { action: 'deleted', id }, `${id}:deleted`)
      .catch((error) => console.error('Goal webhook dispatch failed:', error));
    res.json({ success: true, archived: true });
  } catch (error) {
    console.error('Goal deletion error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
