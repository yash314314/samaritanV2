import { Router } from "express";
import { publicMessage } from "../utils/requestParams";

import {
  WEBHOOK_EVENTS,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  retryWebhookDelivery,
  rotateWebhookSecret,
  sendTestWebhook,
  updateWebhookEndpoint,
} from "../services/webhookService";

const router = Router();

function owner(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function failure(res: any, error: unknown) {
  const message = publicMessage(error, "Webhook request failed");
  res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
}

router.get("/events", (_req, res) => res.json({ events: WEBHOOK_EVENTS }));

router.get("/", async (req, res) => {
  const userId = owner(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  res.json(await listWebhookEndpoints(userId));
});

router.post("/", async (req, res) => {
  const userId = owner(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.status(201).json(await createWebhookEndpoint(userId, req.body));
  } catch (error) {
    failure(res, error);
  }
});

router.patch("/:id", async (req, res) => {
  const userId = owner(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await updateWebhookEndpoint(userId, req.params.id, req.body));
  } catch (error) {
    failure(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  const userId = owner(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await deleteWebhookEndpoint(userId, req.params.id));
  } catch (error) {
    failure(res, error);
  }
});

router.post("/:id/test", async (req, res) => {
  const userId = owner(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.status(202).json(await sendTestWebhook(userId, req.params.id));
  } catch (error) {
    failure(res, error);
  }
});

router.post("/:id/rotate-secret", async (req, res) => {
  const userId = owner(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await rotateWebhookSecret(userId, req.params.id));
  } catch (error) {
    failure(res, error);
  }
});

router.get("/:id/deliveries", async (req, res) => {
  const userId = owner(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await listWebhookDeliveries(userId, req.params.id, Number(req.query.limit) || 100));
  } catch (error) {
    failure(res, error);
  }
});

router.post("/deliveries/:id/retry", async (req, res) => {
  const userId = owner(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await retryWebhookDelivery(userId, req.params.id));
  } catch (error) {
    failure(res, error);
  }
});

export default router;
