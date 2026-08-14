import type { Goal } from "@prisma/client";
import { prisma } from "../prisma";
import { getProjectTimeRange } from "./projectTimeService";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  return new Date(startOfDay(date).getTime() + DAY_MS - 1);
}

function periodRange(goal: Pick<Goal, "period" | "startDate" | "endDate">) {
  if (goal.startDate && goal.endDate) {
    return { start: goal.startDate, end: goal.endDate };
  }

  const now = new Date();
  if (goal.period === "weekly") {
    const start = startOfDay(now);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return { start, end: new Date(start.getTime() + 7 * DAY_MS - 1) };
  }

  if (goal.period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end: new Date(end.getTime() - 1) };
  }

  return { start: startOfDay(now), end: endOfDay(now) };
}

async function progressForGoal(goal: Goal) {
  const { start, end } = periodRange(goal);
  const projectFilter = goal.projectId ? { projectId: goal.projectId } : {};

  if (goal.type === "focus_minutes") {
    const sessions = await prisma.deepWorkSession.findMany({
      where: {
        userId: goal.userId,
        status: "completed",
        startedAt: { gte: start, lte: end },
      },
    });

    return sessions.reduce((sum, session) => {
      const endedAt = session.endedAt ?? new Date();
      return sum + Math.max(0, endedAt.getTime() - session.startedAt.getTime()) / 60000;
    }, 0);
  }

  if (goal.type === "sessions") {
    return prisma.deepWorkSession.count({
      where: {
        userId: goal.userId,
        status: "completed",
        startedAt: { gte: start, lte: end },
      },
    });
  }

  if (goal.projectId) {
    const totals = await getProjectTimeRange(goal.userId, start, new Date(end.getTime() + 1));
    const minutes = totals.get(goal.projectId)?.minutes ?? 0;
    return goal.type === "hours" ? minutes / 60 : minutes;
  }

  const activities = await prisma.activity.findMany({
    where: {
      session: { userId: goal.userId },
      startTime: { gte: start, lte: end },
      ...projectFilter,
    },
    select: { duration: true },
  });

  const minutes = activities.reduce((sum, activity) => sum + Math.max(0, activity.duration ?? 0) / 60000, 0);
  return goal.type === "hours" ? minutes / 60 : minutes;
}

export async function hydrateGoalProgress<T extends Goal>(goal: T) {
  const progress = await progressForGoal(goal);
  return {
    ...goal,
    progress: Number(progress.toFixed(2)),
    progressRatio: goal.target > 0 ? Math.min(1, progress / goal.target) : 0,
  };
}

export async function listGoalsWithProgress(userId: string, period?: string) {
  const goals = await prisma.goal.findMany({
    where: {
      userId,
      active: true,
      ...(period ? { period } : {}),
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
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return Promise.all(goals.map((goal) => hydrateGoalProgress(goal)));
}

export async function updateAndEmitGoalProgress(userId: string) {
  const goals = await listGoalsWithProgress(userId);
  await Promise.all(
    goals.map((goal) =>
      prisma.goal.update({
        where: { id: goal.id },
        data: {
          progress: goal.progress,
          completedAt: goal.progress >= goal.target && !goal.completedAt ? new Date() : goal.completedAt,
        },
      })
    )
  );
  return goals;
}
