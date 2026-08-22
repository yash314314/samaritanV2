import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { promises as dns } from "dns";
import { isIP } from "net";

import { Prisma } from "@prisma/client";

import { prisma } from "../prisma";
import { emitWebhookChanged, emitWebhookDelivery } from "../websocket/broadcaster";

export const WEBHOOK_EVENTS = [
  "activity.reviewed",
  "focus_session.completed",
  "focus_session.abandoned",
  "break.completed",
  "break.skipped",
  "project.changed",
  "goal.changed",
  "calendar.event.changed",
  "distraction.blocked",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const eventSet = new Set<string>(WEBHOOK_EVENTS);
const retryDelaysMs = [15_000, 60_000, 5 * 60_000, 20 * 60_000];
const maxAttempts = retryDelaysMs.length + 1;
const requestTimeoutMs = 8_000;
let dispatcherTimer: NodeJS.Timeout | null = null;
let processing = false;
const webhooksEnabled = false;

function requiredText(value: unknown, label: string, max = 200) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text.slice(0, max);
}

function normalizeEvents(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Select at least one webhook event");
  const events = [...new Set(value.map((item) => String(item).trim()))];
  if (!events.length || events.some((event) => !eventSet.has(event))) {
    throw new Error("Webhook events contain an unsupported event");
  }
  return events;
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (isIP(normalized) !== 4) return false;
  const parts = normalized.split(".").map(Number);
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function parseTargetUrl(value: unknown) {
  const raw = requiredText(value, "Target URL", 2_000);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Enter a valid target URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Webhook URLs must use HTTP or HTTPS without embedded credentials");
  }
  if (process.env.NODE_ENV === "production" && (parsed.hostname === "localhost" || isPrivateAddress(parsed.hostname))) {
    throw new Error("Private network webhook URLs are not allowed in production");
  }
  return parsed.toString();
}

async function assertPublicTarget(targetUrl: string) {
  if (process.env.NODE_ENV !== "production") return;
  const parsed = new URL(targetUrl);
  const records = await dns.lookup(parsed.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Webhook target resolved to a private network address");
  }
}

function publicEndpoint<T extends { secret?: string }>(endpoint: T) {
  const { secret: _secret, ...safe } = endpoint;
  return safe;
}

export async function listWebhookEndpoints(userId: string) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, deliveredAt: true, responseStatus: true, createdAt: true },
      },
      _count: { select: { deliveries: true } },
    },
  });
  return endpoints.map(publicEndpoint);
}

export async function createWebhookEndpoint(userId: string, input: Record<string, unknown>) {
  const secret = randomBytes(32).toString("hex");
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      userId,
      name: requiredText(input.name, "Name", 80),
      targetUrl: parseTargetUrl(input.targetUrl),
      events: normalizeEvents(input.events),
      active: input.active === undefined ? true : Boolean(input.active),
      secret,
    },
  });
  emitWebhookChanged(userId, "created", { endpoint: publicEndpoint(endpoint) });
  return { ...publicEndpoint(endpoint), secret };
}

export async function updateWebhookEndpoint(userId: string, id: string, input: Record<string, unknown>) {
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Webhook endpoint not found");
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      name: input.name === undefined ? existing.name : requiredText(input.name, "Name", 80),
      targetUrl: input.targetUrl === undefined ? existing.targetUrl : parseTargetUrl(input.targetUrl),
      events: input.events === undefined ? existing.events : normalizeEvents(input.events),
      active: input.active === undefined ? existing.active : Boolean(input.active),
    },
  });
  if (existing.active && !endpoint.active) {
    await prisma.webhookDelivery.updateMany({
      where: { webhookId: id, status: { in: ["queued", "retrying"] } },
      data: { status: "failed", error: "Endpoint paused" },
    });
  }
  emitWebhookChanged(userId, "updated", { endpoint: publicEndpoint(endpoint) });
  return publicEndpoint(endpoint);
}

export async function deleteWebhookEndpoint(userId: string, id: string) {
  const deleted = await prisma.webhookEndpoint.deleteMany({ where: { id, userId } });
  if (!deleted.count) throw new Error("Webhook endpoint not found");
  emitWebhookChanged(userId, "deleted", { id });
  return { id, deleted: true };
}

export async function rotateWebhookSecret(userId: string, id: string) {
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new Error("Webhook endpoint not found");
  const secret = randomBytes(32).toString("hex");
  await prisma.webhookEndpoint.update({ where: { id }, data: { secret } });
  emitWebhookChanged(userId, "updated", { id, secretRotated: true });
  return { id, secret };
}

export async function listWebhookDeliveries(userId: string, webhookId: string, limit = 100) {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: webhookId, userId }, select: { id: true } });
  if (!endpoint) throw new Error("Webhook endpoint not found");
  return prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: unknown,
  idempotencySeed: string = randomUUID()
) {
  if (!webhooksEnabled) return { queued: 0 };
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { userId, active: true, events: { has: event } } });
  if (!endpoints.length) return { queued: 0 };
  const occurredAt = new Date().toISOString();
  const created = await prisma.webhookDelivery.createMany({
    data: endpoints.map((endpoint) => {
      const id = randomUUID();
      return {
        id,
        webhookId: endpoint.id,
        event,
        idempotencyKey: createHash("sha256").update(`${endpoint.id}:${event}:${idempotencySeed}`).digest("hex"),
        payload: { id, event, occurredAt, data } as Prisma.InputJsonValue,
      };
    }),
    skipDuplicates: true,
  });
  void processDueWebhookDeliveries();
  return { queued: created.count };
}

export async function sendTestWebhook(userId: string, webhookId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: webhookId, userId } });
  if (!endpoint) throw new Error("Webhook endpoint not found");
  const id = randomUUID();
  const delivery = await prisma.webhookDelivery.create({
    data: {
      id,
      webhookId,
      event: "webhook.test",
      idempotencyKey: createHash("sha256").update(`${webhookId}:webhook.test:${id}`).digest("hex"),
      payload: {
        id,
        event: "webhook.test",
        occurredAt: new Date().toISOString(),
        data: { message: "Samaritan webhook test", endpointId: webhookId },
      },
    },
  });
  void processDueWebhookDeliveries();
  return delivery;
}

async function deliver(deliveryId: string) {
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id: deliveryId, status: { in: ["queued", "retrying"] }, nextAttemptAt: { lte: new Date() } },
    data: { status: "delivering", lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  });
  if (!claimed.count) return;
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });
  if (!delivery) return;

  const body = JSON.stringify(delivery.payload);
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  try {
    await assertPublicTarget(delivery.webhook.targetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(delivery.webhook.targetUrl, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "user-agent": "Samaritan-Webhooks/1.0",
          "x-samaritan-event": delivery.event,
          "x-samaritan-delivery": delivery.id,
          "x-samaritan-signature": `sha256=${createHmac("sha256", delivery.webhook.secret).update(body).digest("hex")}`,
          "idempotency-key": delivery.idempotencyKey,
        },
        body,
      });
      responseStatus = response.status;
      responseBody = (await response.text()).slice(0, 2_000) || null;
      if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Webhook request failed";
  }

  const succeeded = errorMessage === null && responseStatus !== null && responseStatus >= 200 && responseStatus < 300;
  const exhausted = delivery.attemptCount >= maxAttempts;
  const status = succeeded ? "delivered" : exhausted ? "failed" : "retrying";
  const nextAttemptAt = succeeded || exhausted
    ? new Date()
    : new Date(Date.now() + retryDelaysMs[Math.max(0, delivery.attemptCount - 1)]);
  const updated = await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status,
      responseStatus,
      responseBody,
      error: errorMessage,
      nextAttemptAt,
      deliveredAt: succeeded ? new Date() : null,
    },
  });
  if (succeeded) {
    await prisma.webhookEndpoint.update({ where: { id: delivery.webhookId }, data: { lastDeliveryAt: new Date() } });
  }
  emitWebhookDelivery(delivery.webhook.userId, updated);
}

export async function processDueWebhookDeliveries() {
  if (processing) return 0;
  processing = true;
  try {
    await prisma.webhookDelivery.updateMany({
      where: { status: "delivering", lastAttemptAt: { lt: new Date(Date.now() - 2 * 60_000) } },
      data: { status: "retrying", nextAttemptAt: new Date() },
    });
    const due = await prisma.webhookDelivery.findMany({
      where: { status: { in: ["queued", "retrying"] }, nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: 25,
      select: { id: true },
    });
    await Promise.all(due.map(({ id }) => deliver(id)));
    return due.length;
  } finally {
    processing = false;
  }
}

export async function retryWebhookDelivery(userId: string, deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: deliveryId, webhook: { userId } },
  });
  if (!delivery) throw new Error("Webhook delivery not found");
  const updated = await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "retrying", nextAttemptAt: new Date(), error: null },
  });
  void processDueWebhookDeliveries();
  return updated;
}

export function startWebhookDispatcher() {
  if (!webhooksEnabled) return;
  if (dispatcherTimer) return;
  void processDueWebhookDeliveries();
  dispatcherTimer = setInterval(() => void processDueWebhookDeliveries(), 15_000);
}
