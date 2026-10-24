import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../prisma';
import { getCurrentProjectWeek } from '../services/projectTimeService';
import { emitProjectChanged } from '../websocket/broadcaster';
import { dispatchWebhookEvent } from '../services/webhookService';
import {
  assignActivitiesToProject,
  getProjectDashboard,
  getUnassignedProjectActivities,
} from '../services/projectTrackingService';
import { parseIntegerParam, publicMessage } from '../utils/requestParams';

const router = Router();

// GET /api/projects?userId=...
router.get('/', async (req, res) => {
  const { userId, includeArchived } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const [projects, week] = await Promise.all([
      prisma.project.findMany({
        where: { userId, ...(includeArchived === 'true' ? {} : { active: true }) },
        include: {
          rules: true,
          goals: { where: { active: true } },
          _count: { select: { events: true, time: true, calendarSessions: true } },
        },
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
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

router.get('/unassigned', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    const days = parseIntegerParam(req.query.days, { name: 'days', min: 1, max: 30, fallback: 7 });
    res.json(await getUnassignedProjectActivities(userId, days));
  } catch (error) {
    const message = publicMessage(error, 'Failed to fetch unassigned activity');
    res.status(400).json({ error: message });
  }
});

router.post('/activities/assign', async (req, res) => {
  const { userId, activityIds, projectId, remember } = req.body;
  if (!userId || !Array.isArray(activityIds)) return res.status(400).json({ error: 'Provide userId and activityIds' });
  try {
    res.json(await assignActivitiesToProject(userId, activityIds.map(String), projectId || null, Boolean(remember)));
  } catch (error) {
    const message = publicMessage(error, 'Failed to assign activities');
    res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

router.get('/:id/dashboard', async (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  try {
    const days = parseIntegerParam(req.query.days, { name: 'days', min: 7, max: 60, fallback: 14 });
    res.json(await getProjectDashboard(userId, req.params.id, days));
  } catch (error) {
    const message = publicMessage(error, 'Failed to load project dashboard');
    res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

router.post('/:id/restore', async (req, res) => {
  const { userId } = req.body;
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: (req as AuthenticatedRequest).user!.userId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const restored = await prisma.project.update({ where: { id: project.id }, data: { active: true } });
    emitProjectChanged(restored.userId, 'updated', { project: restored });
    res.json(restored);
  } catch (error) {
    res.status(400).json({ error: publicMessage(error, 'Failed to restore project') });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  const { userId, name, description, icon, color, weeklyHourGoal } = req.body;
  
  if (!userId || !name) {
    return res.status(400).json({ error: 'Missing required fields: userId, name' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        userId,
        name: String(name).trim().slice(0, 100),
        description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null,
        icon: icon || null,
        color: color || '#8b5cf6',
        weeklyHourGoal: Math.max(0, Math.min(168, Number(weeklyHourGoal ?? 10))),
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
  const { name, description, icon, color, weeklyHourGoal, active, userId } = req.body;

  try {
    const existing = await prisma.project.findFirst({ where: { id, userId: (req as AuthenticatedRequest).user!.userId } });
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        ...(name && { name: String(name).trim().slice(0, 100) }),
        ...(description !== undefined && { description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null }),
        ...(icon !== undefined && { icon }),
        ...(color && { color }),
        ...(weeklyHourGoal !== undefined && { weeklyHourGoal: Math.max(0, Math.min(168, Number(weeklyHourGoal))) }),
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
    const owned = await prisma.project.findFirst({ where: { id, userId: (req as AuthenticatedRequest).user!.userId }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: 'Project not found' });
    const project = await prisma.project.update({ where: { id: owned.id }, data: { active: false } });
    emitProjectChanged(project.userId, 'deleted', { id });
    void dispatchWebhookEvent(project.userId, 'project.changed', { action: 'deleted', id }, `${id}:deleted`)
      .catch((error) => console.error('Project webhook dispatch failed:', error));
    res.json({ success: true, archived: true });
  } catch (error) {
    console.error('Project deletion error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
