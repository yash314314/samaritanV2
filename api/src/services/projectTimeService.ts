import { prisma } from '../prisma';

/**
 * Aggregate project time for a specific user and date.
 * Groups productive/neutral activities by project and updates ProjectTime records.
 */
export async function aggregateProjectTime(userId: string, date: string) {
  const start = new Date(date + 'T00:00:00.000Z');
  const end = new Date(date + 'T23:59:59.999Z');

  // Fetch all activities for the date with session info
  const activities = await prisma.activity.findMany({
    where: {
      session: {
        userId,
        startTime: {
          gte: start,
          lte: end,
        },
      },
      category: {
        not: 'distracting',
      },
    },
    include: {
      session: {
        select: {
          userId: true,
        },
      },
    },
  });

  // Group by projectId
  const projectMinutes: Record<string, number> = {};

  for (const act of activities) {
    const projectId = act.projectId;
    if (!projectId) continue;

    const mins = Math.round((act.duration || 0) / 60);
    projectMinutes[projectId] = (projectMinutes[projectId] || 0) + mins;
  }

  // Upsert into ProjectTime
  for (const [projectId, minutes] of Object.entries(projectMinutes)) {
    await prisma.projectTime.upsert({
      where: {
        userId_projectId_date: {
          userId,
          projectId,
          date,
        },
      },
      create: {
        userId,
        projectId,
        date,
        minutes,
      },
      update: {
        minutes,
      },
    });
  }

  return {
    date,
    projectsUpdated: Object.keys(projectMinutes).length,
    totalMinutes: Object.values(projectMinutes).reduce((sum, mins) => sum + mins, 0),
  };
}

/**
 * Run aggregation for all users for a given date (typically called by a cron job).
 */
export async function aggregateAllUsersProjectTime(date: string) {
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  const results = [];
  for (const user of users) {
    try {
      const result = await aggregateProjectTime(user.id, date);
      results.push({ userId: user.id, ...result });
    } catch (error) {
      console.error(`Failed to aggregate for user ${user.id}:`, error);
      results.push({ userId: user.id, error: true });
    }
  }

  return results;
}

