import { Router, type Request } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../prisma';
import { emitProjectChanged } from '../websocket/broadcaster';
import { tagActivityToProject } from '../services/projectTagger';

const router = Router();

// Rules hang off a project, so every lookup goes through a project the caller owns.
const ownerOf = (req: Request) => (req as AuthenticatedRequest).user!.userId;

// GET /api/projects/:projectId/rules
router.get('/:projectId/rules', async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: ownerOf(req) }, select: { id: true } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
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
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: ownerOf(req) }, select: { userId: true } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!appName && !domain && !titleKeyword) return res.status(400).json({ error: 'Add an app, domain, or title keyword' });
    if (!['exact', 'contains'].includes(matchType || 'exact')) return res.status(400).json({ error: 'Match type must be exact or contains' });
    const rule = await prisma.projectRule.create({
      data: {
        projectId,
        appName: appName || null,
        domain: domain || null,
        titleKeyword: titleKeyword || null,
        matchType: matchType || 'exact',
      },
    });
    emitProjectChanged(project.userId, 'rules-updated', { projectId, rule });
    res.json(rule);
  } catch (error) {
    console.error('Rule creation error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.patch('/:projectId/rules/:ruleId', async (req, res) => {
  const { projectId, ruleId } = req.params;
  const { appName, domain, titleKeyword, matchType } = req.body;
  try {
    const existing = await prisma.projectRule.findFirst({ where: { id: ruleId, projectId, project: { userId: ownerOf(req) } }, include: { project: { select: { userId: true } } } });
    if (!existing) return res.status(404).json({ error: 'Project rule not found' });
    const rule = await prisma.projectRule.update({
      where: { id: existing.id },
      data: {
        ...(appName !== undefined && { appName: appName || null }),
        ...(domain !== undefined && { domain: domain || null }),
        ...(titleKeyword !== undefined && { titleKeyword: titleKeyword || null }),
        ...(matchType !== undefined && { matchType: ['exact', 'contains'].includes(matchType) ? matchType : existing.matchType }),
      },
    });
    emitProjectChanged(existing.project.userId, 'rules-updated', { projectId, rule });
    res.json(rule);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update rule' });
  }
});

router.post('/:projectId/rules/test', async (req, res) => {
  const { projectId } = req.params;
  const { appName, domain, windowTitle } = req.body;
  try {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: ownerOf(req) }, select: { userId: true } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!appName) return res.status(400).json({ error: 'App name is required' });
    const result = await tagActivityToProject(project.userId, String(appName), domain ? String(domain) : null, windowTitle ? String(windowTitle) : null);
    res.json({ ...result, matchesProject: result.projectId === projectId });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to test rule' });
  }
});

// DELETE /api/projects/:projectId/rules/:ruleId
router.delete('/:projectId/rules/:ruleId', async (req, res) => {
  const { projectId, ruleId } = req.params;

  try {
    const existing = await prisma.projectRule.findFirst({ where: { id: ruleId, projectId, project: { userId: ownerOf(req) } }, include: { project: { select: { userId: true } } } });
    if (!existing) return res.status(404).json({ error: 'Project rule not found' });
    await prisma.projectRule.delete({ where: { id: existing.id } });
    emitProjectChanged(existing.project.userId, 'rules-updated', { projectId, ruleId });
    res.json({ success: true });
  } catch (error) {
    console.error('Rule deletion error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
