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
import { getCalendarTrackingSettings } from "../services/calendarTrackingService";
import { parseCalendarDate } from "../services/calendarTimeService";
import { DAY_MS, MAX_RANGE_DAYS, isValidDateKey } from "../utils/time";

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

// from/to accept YYYY-MM-DD (account-timezone days, `to` inclusive) or ISO datetimes.
router.get("/history", async (req, res) => {
  const userId = userIdFrom(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    const { timezone } = await getCalendarTrackingSettings(userId);
    const toInput = req.query.to;
    const fromInput = req.query.from;
    const to = toInput === undefined ? new Date() : parseCalendarDate(toInput, timezone, true);
    const inclusiveTo = to && typeof toInput === "string" && isValidDateKey(toInput.trim())
      ? new Date(to.getTime() + 1)
      : to;
    const from = fromInput === undefined
      ? inclusiveTo && new Date(inclusiveTo.getTime() - 7 * DAY_MS)
      : parseCalendarDate(fromInput, timezone);
    if (!from || !inclusiveTo || inclusiveTo <= from) {
      return res.status(400).json({ error: "Invalid date range" });
    }
    if (inclusiveTo.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      return res.status(400).json({ error: `Range too large: maximum is ${MAX_RANGE_DAYS} days` });
    }
    res.json(await getSmartBreakHistory(userId, from, inclusiveTo));
  } catch (error) {
    console.error("Smart break history error:", error);
    res.status(500).json({ error: "Failed to load break history" });
  }
});

export default router;
