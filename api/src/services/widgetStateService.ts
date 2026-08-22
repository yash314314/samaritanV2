import type { Activity } from "@prisma/client";

import { prisma } from "../prisma";
import { emitProjectChanged, emitWidgetStateUpdate } from "../websocket/broadcaster";
import { tagActivityToProject } from "./projectTagger";
import { getNextSmartBreak } from "./smartBreakService";

type WidgetContext = {
  activityId?: string | null;
  appName: string;
  windowTitle: string;
  iconUrl?: string | null;
  domain?: string | null;
  url?: string | null;
  observedAt: string;
};

const currentContexts = new Map<string, WidgetContext>();

function focusSnapshot(session: {
  id: string;
  goal: string | null;
  plannedMinutes: number;
  startedAt: Date;
  enforcement: string;
} | null) {
  if (!session) return null;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000));
  return {
    id: session.id,
    goal: session.goal,
    plannedMinutes: session.plannedMinutes,
    startedAt: session.startedAt,
    enforcement: session.enforcement,
    remainingSeconds: Math.max(0, session.plannedMinutes * 60 - elapsedSeconds),
  };
}

async function projectSuggestion(userId: string, context: WidgetContext | null) {
  if (!context) return null;
  const result = await tagActivityToProject(
    userId,
    context.appName,
    context.domain ?? null,
    context.windowTitle
  );
  if (!result.projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: result.projectId, userId, active: true },
    select: { id: true, name: true, color: true, icon: true },
  });
  return project ? { ...project, confidence: result.confidence } : null;
}

export async function getWidgetState(userId: string) {
  const cached = currentContexts.get(userId) ?? null;
  const [latestActivity, focus, breakState, projects] = await Promise.all([
    cached ? Promise.resolve(null) : prisma.activity.findFirst({
      where: { session: { userId } },
      orderBy: { endTime: "desc" },
      include: { project: { select: { id: true, name: true, color: true, icon: true } } },
    }),
    prisma.deepWorkSession.findFirst({
      where: { userId, status: "active" },
      orderBy: { startedAt: "desc" },
      select: { id: true, goal: true, plannedMinutes: true, startedAt: true, enforcement: true },
    }),
    getNextSmartBreak(userId),
    prisma.project.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, icon: true },
    }),
  ]);

  const currentActivity = cached ?? (latestActivity ? {
    activityId: latestActivity.id,
    appName: latestActivity.appName,
    windowTitle: latestActivity.windowTitle,
    iconUrl: latestActivity.iconUrl,
    domain: latestActivity.domain,
    url: latestActivity.url,
    observedAt: latestActivity.endTime.toISOString(),
  } : null);
  const suggestion = latestActivity?.project ?? await projectSuggestion(userId, currentActivity);
  const activeBreak = breakState.break && ["suggested", "snoozed", "active"].includes(breakState.break.status)
    ? breakState.break
    : null;
  const nextBreakInSeconds = activeBreak
    ? Math.max(0, Math.ceil((new Date(activeBreak.dueAt).getTime() - Date.now()) / 1000))
    : Math.max(0, Math.ceil((breakState.streak.thresholdMs - breakState.streak.workMs) / 1000));

  return {
    currentActivity,
    suggestedProject: suggestion,
    focus: focusSnapshot(focus),
    break: activeBreak,
    nextBreakInSeconds,
    breakProgressPercent: breakState.streak.progressPercent,
    projects,
    updatedAt: new Date(),
  };
}

export async function updateWidgetCurrentContext(userId: string, context: {
  app: string;
  title: string;
  iconUrl?: string | null;
  domain?: string | null;
  url?: string | null;
  observedAt?: string;
}) {
  const current: WidgetContext = {
    activityId: currentContexts.get(userId)?.activityId ?? null,
    appName: context.app,
    windowTitle: context.title,
    iconUrl: context.iconUrl ?? null,
    domain: context.domain ?? null,
    url: context.url ?? null,
    observedAt: context.observedAt ?? new Date().toISOString(),
  };
  const previous = currentContexts.get(userId);
  const unchanged = Boolean(
    previous &&
    previous.appName === current.appName &&
    previous.windowTitle === current.windowTitle &&
    previous.domain === current.domain &&
    previous.url === current.url
  );
  if (unchanged) {
    previous!.observedAt = current.observedAt;
    if (current.iconUrl) previous!.iconUrl = current.iconUrl;
    currentContexts.set(userId, previous!);
    return previous!;
  }
  current.activityId = null;
  currentContexts.set(userId, current);
  const suggestedProject = await projectSuggestion(userId, current);
  emitWidgetStateUpdate(userId, { currentActivity: current, suggestedProject, updatedAt: new Date() });
  return current;
}

export async function updateWidgetPersistedActivity(
  userId: string,
  activity: Pick<Activity, "id" | "appName" | "windowTitle" | "iconUrl" | "domain" | "url" | "endTime" | "projectId">
) {
  const current = currentContexts.get(userId);
  if (current && (current.appName !== activity.appName || current.windowTitle !== activity.windowTitle)) {
    return;
  }
  if (current) {
    current.activityId = activity.id;
    currentContexts.set(userId, current);
  }
  const project = activity.projectId ? await prisma.project.findFirst({
    where: { id: activity.projectId, userId },
    select: { id: true, name: true, color: true, icon: true },
  }) : null;
  emitWidgetStateUpdate(userId, {
    currentActivity: current ?? {
      activityId: activity.id,
      appName: activity.appName,
      windowTitle: activity.windowTitle,
      iconUrl: activity.iconUrl,
      domain: activity.domain,
      url: activity.url,
      observedAt: activity.endTime,
    },
    suggestedProject: project,
    updatedAt: new Date(),
  });
}

export async function quickTagWidgetActivity(userId: string, projectId: string, activityId?: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, active: true },
    select: { id: true, name: true, color: true, icon: true },
  });
  if (!project) throw new Error("Project not found");
  const context = currentContexts.get(userId) ?? null;
  let activity = activityId ? await prisma.activity.findFirst({
    where: { id: activityId, session: { userId } },
  }) : null;
  if (!activity && context) {
    activity = await prisma.activity.findFirst({
      where: {
        session: { userId },
        appName: context.appName,
        startTime: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
      orderBy: { startTime: "desc" },
    });
  }

  await prisma.$transaction(async (tx) => {
    if (activity) await tx.activity.update({ where: { id: activity.id }, data: { projectId } });
    if (context) {
      const appName = context.appName.trim();
      const domain = context.domain?.trim() || null;
      const existing = await tx.projectRule.findFirst({
        where: {
          projectId,
          OR: [
            { appName, domain: null },
            ...(domain ? [{ appName: null, domain }] : []),
          ],
        },
      });
      if (!existing) {
        await tx.projectRule.create({
          data: domain
            ? { projectId, domain, matchType: "contains" }
            : { projectId, appName, matchType: "exact" },
        });
      }
    }
  });

  emitProjectChanged(userId, "rules-updated", { projectId, source: "widget" });
  emitWidgetStateUpdate(userId, { suggestedProject: project, updatedAt: new Date() });
  return { project, activityId: activity?.id ?? null, ruleCreated: Boolean(context) };
}
