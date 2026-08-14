import { Router } from "express";

import {
  createDistractionBlock,
  deleteDistractionBlock,
  getActiveDistractionBlockState,
  getDistractionBlockDashboard,
  listDistractionBlockEvents,
  recordDistractionBlockEvent,
  updateDistractionBlock,
} from "../services/distractionBlockService";

const router = Router();

function userId(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function failure(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : "Distraction blocker request failed";
  res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
}

router.get("/", async (req, res) => {
  const owner = userId(req.query.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  res.json(await getDistractionBlockDashboard(owner));
});

router.get("/active", async (req, res) => {
  const owner = userId(req.query.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  res.json(await getActiveDistractionBlockState(owner));
});

router.get("/events", async (req, res) => {
  const owner = userId(req.query.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return res.status(400).json({ error: "Invalid date range" });
  }
  res.json(await listDistractionBlockEvents(owner, from, to));
});

router.post("/events", async (req, res) => {
  const owner = userId(req.body.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  try {
    res.status(201).json(await recordDistractionBlockEvent(owner, req.body));
  } catch (error) {
    failure(res, error);
  }
});

router.post("/", async (req, res) => {
  const owner = userId(req.body.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  try {
    res.status(201).json(await createDistractionBlock(owner, req.body));
  } catch (error) {
    failure(res, error);
  }
});

router.patch("/:id", async (req, res) => {
  const owner = userId(req.body.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await updateDistractionBlock(owner, req.params.id, req.body));
  } catch (error) {
    failure(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  const owner = userId(req.query.userId);
  if (!owner) return res.status(400).json({ error: "Missing userId" });
  try {
    res.json(await deleteDistractionBlock(owner, req.params.id));
  } catch (error) {
    failure(res, error);
  }
});

export default router;
