import { Router } from "express";

import {
  endSmartBreak,
  getNextSmartBreak,
  getSmartBreakHistory,
  getSmartBreakSettings,
  skipSmartBreak,
  snoozeSmartBreak,
  startSmartBreak,
  updateSmartBreakSettings,
} from "../services/smartBreakService";

const router = Router();

function userIdFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function routeError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : "Smart break request failed";
  const notFound = /not found|no longer active/i.test(message);
  res.status(notFound ? 404 : 400).json({ error: message });
}

router.get("/settings", async (req, res) => {
  const userId = userIdFrom(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  res.json(await getSmartBreakSettings(userId));
});

router.patch("/settings", async (req, res) => {
  const userId = userIdFrom(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await updateSmartBreakSettings(userId, req.body));
  } catch (error) {
    routeError(res, error);
  }
});

router.get("/next-suggestion", async (req, res) => {
  const userId = userIdFrom(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await getNextSmartBreak(userId));
  } catch (error) {
    console.error("Smart break evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate smart break" });
  }
});

router.post("/start", async (req, res) => {
  const userId = userIdFrom(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.status(201).json(await startSmartBreak(userId, {
      breakId: userIdFrom(req.body.breakId) ?? undefined,
      recommendedMinutes: req.body.recommendedMinutes,
      reason: typeof req.body.reason === "string" ? req.body.reason : undefined,
    }));
  } catch (error) {
    routeError(res, error);
  }
});

router.post("/:id/snooze", async (req, res) => {
  const userId = userIdFrom(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await snoozeSmartBreak(userId, req.params.id, req.body.minutes));
  } catch (error) {
    routeError(res, error);
  }
});

router.post("/:id/skip", async (req, res) => {
  const userId = userIdFrom(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await skipSmartBreak(userId, req.params.id));
  } catch (error) {
    routeError(res, error);
  }
});

router.post("/:id/end", async (req, res) => {
  const userId = userIdFrom(req.body.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await endSmartBreak(userId, req.params.id));
  } catch (error) {
    routeError(res, error);
  }
});

router.get("/history", async (req, res) => {
  const userId = userIdFrom(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
  const from = typeof req.query.from === "string"
    ? new Date(req.query.from)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return res.status(400).json({ error: "Invalid date range" });
  }
  res.json(await getSmartBreakHistory(userId, from, to));
});

export default router;
