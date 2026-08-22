import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// POST /api/ratings
router.post('/', async (req, res) => {
  const { userId, rating, deepWorkId } = req.body;

  if (!userId || !rating) {
    return res.status(400).json({ error: 'Missing required fields: userId, rating' });
  }

  try {
    const r = await prisma.rating.create({
      data: {
        userId,
        rating,
        deepWorkId: deepWorkId || null,
      },
    });
    res.json(r);
  } catch (error) {
    console.error('Rating creation error:', error);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// GET /api/ratings?userId=...&from=...&to=...
router.get('/', async (req, res) => {
  const { userId, from, to } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const where: any = { userId };

    if (from && to) {
      where.timestamp = {
        gte: new Date(from as string),
        lte: new Date(to as string),
      };
    }

    const ratings = await prisma.rating.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    res.json(ratings);
  } catch (error) {
    console.error('Ratings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

export default router;

