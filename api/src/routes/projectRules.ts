import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/projects/:projectId/rules
router.get('/:projectId/rules', async (req, res) => {
  const { projectId } = req.params;

  try {
    const rules = await prisma.projectRule.findMany({
      where: { projectId },
    });
    res.json(rules);
  } catch (error) {
    console.error('Rules fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// POST /api/projects/:projectId/rules
router.post('/:projectId/rules', async (req, res) => {
  const { projectId } = req.params;
  const { appName, domain, titleKeyword, matchType } = req.body;

  try {
    const rule = await prisma.projectRule.create({
      data: {
        projectId,
        appName: appName || null,
        domain: domain || null,
        titleKeyword: titleKeyword || null,
        matchType: matchType || 'exact',
      },
    });
    res.json(rule);
  } catch (error) {
    console.error('Rule creation error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// DELETE /api/projects/:projectId/rules/:ruleId
router.delete('/:projectId/rules/:ruleId', async (req, res) => {
  const { ruleId } = req.params;

  try {
    await prisma.projectRule.delete({ where: { id: ruleId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Rule deletion error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;

