import { Router } from 'express';
import { prisma } from '../prisma';
import { emitGoalChanged } from '../websocket/broadcaster';
import { hydrateGoalProgress, listGoalsWithProgress } from '../services/goalProgressService';
import { dispatchWebhookEvent } from '../services/webhookService';

const router = Router();

// GET /api/goals?userId=...&period=...
router.get('/', async (req, res) => {
  const { userId, period } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const goals = await listGoalsWithProgress(userId, period as string | undefined);
    res.json(goals);
  } catch (error) {
    console.error('Goals fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
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

  if (!userId || !title || !target) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, target' });
  }

  try {
    const goal = await prisma.goal.create({
      data: {
        userId,
        title,
        description: description || null,
        type: type || 'focus_minutes',
        unit: unit || null,
        target,
        period: period || 'daily',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
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
    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(unit !== undefined && { unit }),
        ...(target !== undefined && { target }),
        ...(period && { period }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
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
    const goal = await prisma.goal.delete({ where: { id } });
    emitGoalChanged(goal.userId, 'deleted', { id });
    void dispatchWebhookEvent(goal.userId, 'goal.changed', { action: 'deleted', id }, `${id}:deleted`)
      .catch((error) => console.error('Goal webhook dispatch failed:', error));
    res.json({ success: true });
  } catch (error) {
    console.error('Goal deletion error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
