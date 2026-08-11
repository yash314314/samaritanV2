import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { recalculateSessionMetrics } from "./activityService"
import { evaluateDeepWorkActivity } from "./deepWorkService";
import { classifyActivity } from "./contextClassifier";
import { resolveActivityIcon } from "./iconResolver";
import { tagActivityToProject } from "./projectTagger";
import { emitActivityCreated, emitSessionMetricsUpdated } from "../websocket/broadcaster";
import { emitGoalProgress } from "../websocket/broadcaster";
import { updateAndEmitGoalProgress } from "./goalProgressService";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SESSION_DURATION = 2 * 60 * 60 * 1000;

export async function getOrCreateActiveSession(userId: string) {
  const now = new Date();

  let session = await prisma.session.findFirst({
    where: {
      userId,
      endTime: null
    },
    orderBy: { startTime: "desc" }
  });

  if (!session) {
    return prisma.session.create({ data: { userId } });
  }

  const lastActivity = await prisma.activity.findFirst({
    where: { sessionId: session.id },
    orderBy: { startTime: "desc" }
  });

  const sessionAge = now.getTime() - new Date(session.startTime).getTime();
  const inactivity = lastActivity
    ? now.getTime() - new Date(lastActivity.startTime).getTime()
    : 0;

  if (sessionAge > MAX_SESSION_DURATION || inactivity > SESSION_TIMEOUT_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { endTime: now }
    });
    return prisma.session.create({ data: { userId } });
  }

  return session;
}

export async function createActivityFromTracker(data: {
  id?: string
  userId: string
  app: string
  title: string
  iconUrl?: string | null
  domain?: string | null
  url?: string | null
  startTime: Date
  endTime: Date
  duration: number
  type: string
}) {
  const session = await getOrCreateActiveSession(data.userId);
  const previousActivity = data.id
    ? await prisma.activity.findUnique({ where: { id: data.id } })
    : null;

  const icon = resolveActivityIcon({
    appName: data.app,
    url: data.url,
    domain: data.domain
  });
  const classification = await classifyActivity(
    data.app,
    data.title,
    data.domain ?? icon.domain ?? data.url ?? null
  );

  // Auto-tag activity to project based on matching rules
  const tagResult = await tagActivityToProject(
    data.userId,
    data.app,
    data.domain ?? icon.domain ?? null,
    data.title
  );
  const projectId = tagResult.projectId;

  const normalizedApp = data.app.toLowerCase();
  const shouldPreferResolvedIcon =
    normalizedApp.includes("brave") ||
    normalizedApp.includes("edge") ||
    normalizedApp.includes("chrome") ||
    normalizedApp.includes("firefox") ||
    normalizedApp.includes("whatsapp");

  const finalIconUrl = shouldPreferResolvedIcon
    ? icon.iconUrl ?? data.iconUrl ?? null
    : data.iconUrl ?? icon.iconUrl ?? null;

  const activity = data.id
    ? await prisma.activity.upsert({
        where: { id: data.id },
        update: {
          endTime: data.endTime,
          duration: data.duration,
          projectId: projectId ?? undefined,
        },
        create: {
          id: data.id,
          sessionId: session.id,
          appName: data.app,
          windowTitle: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration,
          type: data.type,
          category: classification.category,
          intent: classification.intent,
          focusImpact: classification.focusImpact,
          energyImpact: classification.energyImpact,
          confidence: classification.confidence,
          iconUrl: finalIconUrl,
          domain: data.domain ?? icon.domain,
          url: data.url ?? null,
          projectId: projectId ?? null,
        }
      })
    : await prisma.activity.create({
        data: {
          sessionId: session.id,
          appName: data.app,
          windowTitle: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration,
          type: data.type,
          category: classification.category,
          intent: classification.intent,
          focusImpact: classification.focusImpact,
          energyImpact: classification.energyImpact,
          confidence: classification.confidence,
          iconUrl: finalIconUrl,
          domain: data.domain ?? icon.domain,
          url: data.url ?? null,
          projectId: projectId ?? null,
        }
      });

  await recalculateSessionMetrics(session.id);

  const focusIntervention = await evaluateDeepWorkActivity(
    data.userId,
    activity,
    previousActivity
  );

  if (focusIntervention) {
    console.log("[Strict Focus Intervention]", {
      sessionId: focusIntervention.sessionId,
      action: focusIntervention.intervention.action,
      appName: focusIntervention.intervention.appName,
      domain: focusIntervention.intervention.domain,
      message: focusIntervention.message
    });
  }

  console.log("[Activity Created]", {
    id: activity.id,
    sessionId: activity.sessionId,
    appName: activity.appName,
    startTime: activity.startTime,
    duration: activity.duration,
    type: activity.type
  });

  // ─── WebSocket broadcast ───
  emitActivityCreated(data.userId, activity);

  const updatedSession = await prisma.session.findUnique({
    where: { id: session.id },
    select: {
      focusScore: true,
      productivityScore: true,
      deepWorkScore: true,
      burnoutScore: true,
      entropyScore: true,
      switchCount: true,
      totalDuration: true,
    }
  });
  if (updatedSession) {
    emitSessionMetricsUpdated(data.userId, session.id, updatedSession);
  }

  const goals = await updateAndEmitGoalProgress(data.userId);
  emitGoalProgress(data.userId, goals);

  return {
    activity,
    focusIntervention
  };
}
