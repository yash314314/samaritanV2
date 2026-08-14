import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { prisma } from "../prisma";
import {
  emitDistractionBlockEvent,
  emitDistractionBlocksChanged,
} from "../websocket/broadcaster";
import { getCalendarTrackingSettings } from "./calendarTrackingService";
import { dispatchWebhookEvent } from "./webhookService";

dayjs.extend(utc);
dayjs.extend(timezone);

const TARGET_TYPES = new Set(["app", "domain"]);
const SCOPES = new Set(["always", "during_focus"]);
const OUTCOMES = new Set(["killed", "failed", "matched"]);

function requiredText(value: unknown, label: string, maximum = 200) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text.slice(0, maximum);
}

function targetType(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!TARGET_TYPES.has(normalized)) throw new Error("Target type must be app or domain");
  return normalized;
}

function blockScope(value: unknown) {
  const normalized = String(value || "during_focus").trim().toLowerCase();
  if (!SCOPES.has(normalized)) throw new Error("Scope must be always or during_focus");
  return normalized;
}

export function normalizeDistractionTarget(type: string, value: string) {
  const raw = value.trim().toLowerCase();
  if (type === "app") return raw.replace(/\.exe$/i, "").replace(/\s+/g, " ");
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").replace(/\.$/, "");
  }
}

export async function getActiveDistractionBlockState(userId: string) {
  const [rules, activeDeepWork] = await Promise.all([
    prisma.distractionBlock.findMany({
      where: { userId, active: true },
      orderBy: [{ scope: "asc" }, { targetType: "asc" }, { target: "asc" }],
    }),
    prisma.deepWorkSession.findFirst({ where: { userId, status: "active" }, select: { id: true } }),
  ]);
  const focusActive = Boolean(activeDeepWork);
  return {
    focusActive,
    rules,
    activeRules: rules.filter((rule) => rule.scope === "always" || focusActive),
    updatedAt: new Date(),
  };
}

async function emitRules(userId: string, action: "created" | "updated" | "deleted") {
  const state = await getActiveDistractionBlockState(userId);
  emitDistractionBlocksChanged(userId, action, state);
  return state;
}

export async function listDistractionBlocks(userId: string) {
  return prisma.distractionBlock.findMany({
    where: { userId },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
}

export async function createDistractionBlock(
  userId: string,
  input: { targetType?: unknown; target?: unknown; scope?: unknown; active?: unknown }
) {
  const type = targetType(input.targetType);
  const target = requiredText(input.target, "Target", 120);
  const normalizedTarget = normalizeDistractionTarget(type, target);
  if (!normalizedTarget || (type === "domain" && !normalizedTarget.includes("."))) {
    throw new Error(type === "domain" ? "Enter a valid domain" : "Enter a valid app name");
  }
  try {
    const rule = await prisma.distractionBlock.create({
      data: {
        userId,
        targetType: type,
        target,
        normalizedTarget,
        scope: blockScope(input.scope),
        active: input.active === undefined ? true : Boolean(input.active),
      },
    });
    await emitRules(userId, "created");
    return rule;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("That blocker rule already exists for this scope");
    }
    throw error;
  }
}

export async function updateDistractionBlock(
  userId: string,
  id: string,
  input: { targetType?: unknown; target?: unknown; scope?: unknown; active?: unknown }
) {
  const existing = await prisma.distractionBlock.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Blocker rule not found");
  const type = input.targetType === undefined ? existing.targetType : targetType(input.targetType);
  const target = input.target === undefined ? existing.target : requiredText(input.target, "Target", 120);
  const normalizedTarget = normalizeDistractionTarget(type, target);
  if (!normalizedTarget || (type === "domain" && !normalizedTarget.includes("."))) throw new Error("Enter a valid target");
  try {
    const rule = await prisma.distractionBlock.update({
      where: { id },
      data: {
        targetType: type,
        target,
        normalizedTarget,
        scope: input.scope === undefined ? existing.scope : blockScope(input.scope),
        active: input.active === undefined ? existing.active : Boolean(input.active),
      },
    });
    await emitRules(userId, "updated");
    return rule;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("That blocker rule already exists for this scope");
    }
    throw error;
  }
}

export async function deleteDistractionBlock(userId: string, id: string) {
  const deleted = await prisma.distractionBlock.deleteMany({ where: { id, userId } });
  if (!deleted.count) throw new Error("Blocker rule not found");
  await emitRules(userId, "deleted");
  return { id, deleted: true };
}

export async function recordDistractionBlockEvent(userId: string, input: {
  id?: unknown;
  ruleId?: unknown;
  targetType?: unknown;
  target?: unknown;
  appName?: unknown;
  domain?: unknown;
  windowTitle?: unknown;
  processId?: unknown;
  outcome?: unknown;
  reason?: unknown;
  deviceId?: unknown;
  occurredAt?: unknown;
}) {
  const id = typeof input.id === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(input.id) ? input.id : undefined;
  const ruleId = typeof input.ruleId === "string" ? input.ruleId : null;
  if (ruleId) {
    const owned = await prisma.distractionBlock.findFirst({ where: { id: ruleId, userId }, select: { id: true } });
    if (!owned) throw new Error("Blocker rule not found");
  }
  const type = targetType(input.targetType);
  const outcome = String(input.outcome || "matched").toLowerCase();
  if (!OUTCOMES.has(outcome)) throw new Error("Invalid blocker outcome");
  const occurredAt = input.occurredAt ? new Date(String(input.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Invalid event timestamp");
  const processId = Number(input.processId);
  try {
    const event = await prisma.distractionBlockEvent.create({
      data: {
        ...(id ? { id } : {}),
        userId,
        ruleId,
        targetType: type,
        target: requiredText(input.target, "Target", 120),
        appName: requiredText(input.appName, "App name", 160),
        domain: typeof input.domain === "string" ? input.domain.slice(0, 240) : null,
        windowTitle: typeof input.windowTitle === "string" ? input.windowTitle.slice(0, 500) : null,
        processId: Number.isInteger(processId) && processId > 0 ? processId : null,
        outcome,
        reason: typeof input.reason === "string" ? input.reason.slice(0, 500) : null,
        deviceId: typeof input.deviceId === "string" ? input.deviceId.slice(0, 100) : null,
        occurredAt,
      },
    });
    emitDistractionBlockEvent(userId, { event });
    void dispatchWebhookEvent(userId, "distraction.blocked", { event }, event.id)
      .catch((error) => console.error("Distraction webhook dispatch failed:", error));
    return event;
  } catch (error) {
    if (id && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.distractionBlockEvent.findFirstOrThrow({ where: { id, userId } });
    }
    throw error;
  }
}

export async function getDistractionBlockDashboard(userId: string) {
  const settings = await getCalendarTrackingSettings(userId);
  const today = dayjs().tz(settings.timezone).startOf("day").toDate();
  const [rules, state, recentEvents, grouped] = await Promise.all([
    listDistractionBlocks(userId),
    getActiveDistractionBlockState(userId),
    prisma.distractionBlockEvent.findMany({
      where: { userId, occurredAt: { gte: today } },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    prisma.distractionBlockEvent.groupBy({
      by: ["outcome"],
      where: { userId, occurredAt: { gte: today } },
      _count: { _all: true },
    }),
  ]);
  const count = (outcome: string) => grouped.find((item) => item.outcome === outcome)?._count._all ?? 0;
  return {
    rules,
    activeRules: state.activeRules,
    focusActive: state.focusActive,
    recentEvents,
    summary: {
      totalRules: rules.length,
      enabledRules: rules.filter((rule) => rule.active).length,
      activeNow: state.activeRules.length,
      attemptsToday: grouped.reduce((sum, item) => sum + item._count._all, 0),
      killedToday: count("killed"),
      failedToday: count("failed"),
    },
  };
}

export async function listDistractionBlockEvents(userId: string, from?: Date, to?: Date) {
  return prisma.distractionBlockEvent.findMany({
    where: {
      userId,
      ...(from || to ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
}
