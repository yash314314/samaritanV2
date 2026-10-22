import { Router } from "express";
import { getAppearance, PreferenceValidationError, saveAppearance } from "../services/preferenceService";

const router = Router();

// GET /api/preferences/appearance?userId=...
router.get("/appearance", async (req, res) => {
  const userId = req.query.userId;
  if (typeof userId !== "string" || !userId) {
    return res.status(400).json({ error: "Missing required query parameter: userId" });
  }

  try {
    res.json(await getAppearance(userId));
  } catch (error) {
    console.error("Appearance lookup error:", error);
    res.status(500).json({ error: "Failed to load appearance settings" });
  }
});

// PUT /api/preferences/appearance  { userId, appearance }
router.put("/appearance", async (req, res) => {
  const { userId, appearance } = req.body ?? {};
  if (typeof userId !== "string" || !userId) {
    return res.status(400).json({ error: "Missing required field: userId" });
  }

  try {
    res.json(await saveAppearance(userId, appearance));
  } catch (error) {
    if (error instanceof PreferenceValidationError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Appearance save error:", error);
    res.status(500).json({ error: "Failed to save appearance settings" });
  }
});

export default router;
