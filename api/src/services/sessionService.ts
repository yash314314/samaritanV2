import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { recalculateSessionMetrics } from "./activityService"
import { evaluateDeepWorkActivity } from "./deepWorkService";
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

  const sessionAge =
    now.getTime() - new Date(session.startTime).getTime();

  const inactivity =
    lastActivity
      ? now.getTime() - new Date(lastActivity.startTime).getTime()
      : 0;

  if (
    sessionAge > MAX_SESSION_DURATION ||
    inactivity > SESSION_TIMEOUT_MS
  ) {

    await prisma.session.update({
      where: { id: session.id },
      data: { endTime: now }
    });

    return prisma.session.create({
      data: { userId }
    });
  }

  return session;
}
import { classifyActivity } from "./contextClassifier";
import { resolveActivityIcon } from "./iconResolver";
export async function createActivityFromTracker(data: {
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

  const session = await getOrCreateActiveSession(data.userId)

  const classification = await classifyActivity(data.app, data.title);
  const icon = resolveActivityIcon({
    appName: data.app,
    url: data.url,
    domain: data.domain
  });
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
  const activity = await prisma.activity.create({
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
      url: data.url ?? null
    }
  })

  await recalculateSessionMetrics(session.id)
  const focusIntervention = await evaluateDeepWorkActivity(
    data.userId,
    activity
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

  return {
    activity,
    focusIntervention
  }
}