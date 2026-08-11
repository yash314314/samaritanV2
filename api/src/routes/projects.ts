import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/projects?userId=...
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId, active: true },
      include: {
        rules: true,
        goals: { where: { active: true } },
        _count: { select: { events: true, time: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
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
    await prisma.project.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Project deletion error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;

