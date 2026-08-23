import { Router } from "express";
import { prisma } from "../prisma";
import { generateUserReport } from "../services/reportService";
import { optionalAuth, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

const DEFAULT_USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

// GET all reports for user
router.get("/", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId || (req.query.userId as string) || DEFAULT_USER_ID;
    const period = req.query.period as string | undefined;

    const where: any = { userId };
    if (period) where.period = period;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, reports });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch reports" });
  }
});

// POST manually generate report
router.post("/generate", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId || req.body.userId || DEFAULT_USER_ID;
    const period = (req.body.period as "daily" | "weekly" | "monthly") || "daily";

    const report = await generateUserReport(userId, period);
    return res.json({ success: true, report });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate report" });
  }
});

// GET single report details
router.get("/:id", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({ success: true, report });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch report" });
  }
});

export default router;
