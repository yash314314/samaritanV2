import { Router } from "express";
import {
  endDeepWorkSession,
  getActiveDeepWorkSession,
  getDeepWorkTimerState,
  getDeepWorkSessionHistory,
  pauseDeepWorkSession,
  resumeDeepWorkSession,
  resolveFocusIntervention,
  skipDeepWorkBreak,
  startDeepWorkSession
} from "../services/deepWorkService";
import { getDeepWorkSessionResult } from "../services/deepWorkService";
const router = Router();

function failure(res: any, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : /already active|already ended|already completed/i.test(message) ? 409 : 400;
  res.status(status).json({ error: message });
}

router.get("/active", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  const session = await getActiveDeepWorkSession(userId);
  res.json(session);
});

router.get("/history", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  const sessions = await getDeepWorkSessionHistory(userId);
  res.json(sessions);
});

router.post("/start", async (req, res) => {
  try {
    const {
      userId,
      projectId,
      goal,
      plannedMinutes,
      enforcement,
      allowedApps,
      allowedDomains,
      blockedApps,
      blockedDomains,
      timerMode,
      focusMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      totalRounds,
      ambientSound,
      ambientVolume,
    } = req.body;

    if (!userId || (!plannedMinutes && !focusMinutes)) {
      return res.status(400).json({
        error: "Missing userId or plannedMinutes"
      });
    }

    const session = await startDeepWorkSession({
      userId,
      projectId: projectId || null,
      goal,
      plannedMinutes: Number(plannedMinutes),
      enforcement,
      allowedApps,
      allowedDomains,
      blockedApps,
      blockedDomains,
      timerMode,
      focusMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      totalRounds,
      ambientSound,
      ambientVolume,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error("Start deep work failed:", error);
    failure(res, error, "Failed to start deep work");
  }
});

router.post("/:id/end", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const session = await endDeepWorkSession(
      String(userId),
      id,
      status ?? "completed"
    );

    res.json(session);
  } catch (error) {
    console.error("End deep work failed:", error);
    failure(res, error, "Failed to end deep work");
  }
});

router.post("/:id/pause", async (req, res) => {
  try {
    if (!req.body.userId) return res.status(400).json({ error: "Missing userId" });
    res.json(await pauseDeepWorkSession(String(req.body.userId), req.params.id));
  } catch (error) {
    failure(res, error, "Failed to pause deep work");
  }
});

router.post("/:id/resume", async (req, res) => {
  try {
    if (!req.body.userId) return res.status(400).json({ error: "Missing userId" });
    res.json(await resumeDeepWorkSession(String(req.body.userId), req.params.id));
  } catch (error) {
    failure(res, error, "Failed to resume deep work");
  }
});

router.post("/:id/skip-break", async (req, res) => {
  try {
    if (!req.body.userId) return res.status(400).json({ error: "Missing userId" });
    res.json(await skipDeepWorkBreak(String(req.body.userId), req.params.id));
  } catch (error) {
    failure(res, error, "Failed to skip break");
  }
});

router.post("/interventions/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, reason, action } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const intervention = await resolveFocusIntervention(
      String(userId),
      id,
      reason,
      action ?? "allowed_once"
    );

    res.json(intervention);
  } catch (error) {
    console.error("Resolve intervention failed:", error);
    failure(res, error, "Failed to resolve intervention");
  }
});
router.get("/:id/result", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }

    const result = await getDeepWorkSessionResult(id, userId);
    
    if (!result) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Get session result failed:", error);
    res.status(500).json({ error: "Failed to get session result" });
  }
});
router.get("/active/status", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }

    const session = await getActiveDeepWorkSession(userId);
    
    if (!session) {
      return res.json({ active: false });
    }

    const timer = getDeepWorkTimerState(session);

    // CRITICAL FIX: Include live metrics for overlay
    res.json({
      active: true,
      session: {
        id: session.id,
        projectId: session.projectId,
        project: session.project,
        goal: session.goal,
        plannedMinutes: session.plannedMinutes,
        ...timer,
        enforcement: session.enforcement,
        focusScore: Number(session.focusScore.toFixed(2)),
        productivityScore: Number(session.productivityScore.toFixed(2)),
        violationCount: session.violationCount,
        // NEW: Live time breakdown
        productiveMs: session.productiveMs,
        distractionMs: session.distractionMs,
        idleMs: session.idleMs,
        interruptionMs: session.interruptionMs,
        // NEW: Recent interventions for live display
        recentInterventions: session.interventions?.slice(0, 3).map(i => ({
          appName: i.appName,
          action: i.action,
          detectedAt: i.detectedAt
        })) || [],
        allowedApps: session.allowedApps,
        allowedDomains: session.allowedDomains,
        blockedApps: session.blockedApps,
        blockedDomains: session.blockedDomains,
        focusMinutes: session.focusMinutes,
        shortBreakMinutes: session.shortBreakMinutes,
        longBreakMinutes: session.longBreakMinutes,
        ambientSound: session.ambientSound,
        ambientVolume: session.ambientVolume,
      }
    });
  } catch (error) {
    console.error("Get active status failed:", error);
    res.status(500).json({ error: "Failed to get active status" });
  }
});
export default router;
