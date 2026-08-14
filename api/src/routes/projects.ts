import { Router } from 'express';
import { prisma } from '../prisma';
import { getCurrentProjectWeek } from '../services/projectTimeService';
import { emitProjectChanged } from '../websocket/broadcaster';
import { dispatchWebhookEvent } from '../services/webhookService';

const router = Router();

// GET /api/projects?userId=...
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const [projects, week] = await Promise.all([
      prisma.project.findMany({
        where: { userId, active: true },
        include: {
          rules: true,
          goals: { where: { active: true } },
          _count: { select: { events: true, time: true, calendarSessions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      getCurrentProjectWeek(userId),
    ]);
    res.json(projects.map((project) => {
      const time = week.totals.get(project.id) ?? { minutes: 0, activityMinutes: 0, calendarMinutes: 0 };
      const goalMinutes = Math.max(0, project.weeklyHourGoal * 60);
      return {
        ...project,
        timeSummary: {
          weekMinutes: Number(time.minutes.toFixed(1)),
          activityMinutes: Number(time.activityMinutes.toFixed(1)),
          calendarMinutes: Number(time.calendarMinutes.toFixed(1)),
          goalMinutes,
          progressPercent: goalMinutes > 0 ? Math.round((time.minutes / goalMinutes) * 100) : 0,
          from: week.from,
          to: week.to,
          timezone: week.timezone,
        },
      };
    }));
  } catch (error) {
    console.error('Projects fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  const { userId, name, icon, color, weeklyHourGoal } = req.body;
  
  if (!userId || !name) {
    return res.status(400).json({ error: 'Missing required fields: userId, name' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        userId,
        name,
        icon: icon || null,
        color: color || '#8b5cf6',
        weeklyHourGoal: weeklyHourGoal || 10,
      },
    });
    emitProjectChanged(userId, 'created', { project });
    void dispatchWebhookEvent(userId, 'project.changed', { action: 'created', project }, project.id)
      .catch((error) => console.error('Project webhook dispatch failed:', error));
    res.json(project);
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, icon, color, weeklyHourGoal, active } = req.body;

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
        ...(color && { color }),
        ...(weeklyHourGoal !== undefined && { weeklyHourGoal }),
        ...(active !== undefined && { active }),
      },
    });
    emitProjectChanged(project.userId, 'updated', { project });
    void dispatchWebhookEvent(project.userId, 'project.changed', { action: 'updated', project })
      .catch((error) => console.error('Project webhook dispatch failed:', error));
    res.json(project);
  } catch (error) {
    console.error('Project update error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const project = await prisma.project.delete({ where: { id } });
    emitProjectChanged(project.userId, 'deleted', { id });
    void dispatchWebhookEvent(project.userId, 'project.changed', { action: 'deleted', id }, `${id}:deleted`)
      .catch((error) => console.error('Project webhook dispatch failed:', error));
    res.json({ success: true });
  } catch (error) {
    console.error('Project deletion error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
