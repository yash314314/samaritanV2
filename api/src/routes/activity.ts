import { Router } from 'express';
import { handleActivity } from '../services/activityService';
import { getTimeline } from '../services/timelineservice';
import { createActivityFromTracker } from '../services/sessionService';
import { reviewActivities } from '../services/activityReviewService';
const router = Router();

router.post('/', async (req, res) => {
  const { userId, appName, windowTitle } = req.body;

  if (!userId || !appName || !windowTitle) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const activity = await handleActivity(userId, appName, windowTitle);
    res.json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/timeline", async (req, res) => {
  const { userId, date } = req.query;

  if (!userId || !date) {
    return res.status(400).json({ error: "Missing params" });
  }

  const timeline = await getTimeline(userId as string, date as string);
  res.json(timeline);
});
router.post("/session", async (req, res) => {
  try {
    const {
      id,
      userId,
      app,
      title,
      iconUrl,
      startTime,
      endTime,
      duration,
      type,
      url,
      domain
    } = req.body;

    if (!userId || !app || !startTime || !endTime || !duration) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const activity = await createActivityFromTracker({
      id,
      userId,
      app,
      title,
      iconUrl,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration,
      type,
      url,
      domain
    });

    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/reviews", async (req, res) => {
  try {
    const { userId, reviews } = req.body;
    if (!userId || !Array.isArray(reviews)) {
      return res.status(400).json({ error: "Missing userId or reviews" });
    }

    const result = await reviewActivities(userId, reviews);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    console.error("Activity review error:", error);
    res.status(400).json({ error: message });
  }
});

export default router;
