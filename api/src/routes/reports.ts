import { Router } from "express";
import { prisma } from "../prisma";
import { REPORT_PERIODS, generateUserReport } from "../services/reportService";
import { parseEnumParam } from "../utils/requestParams";
import { InvalidRequestError } from "../utils/time";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

// GET all reports for user
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const period = parseEnumParam(req.query.period, { name: "period", allowed: REPORT_PERIODS });

    const where: any = { userId };
    if (period) where.period = period;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, reports });
  } catch (error: any) {
    if (error instanceof InvalidRequestError) return res.status(400).json({ error: error.message });
    console.error("Failed to fetch reports", error);
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// POST manually generate report
router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const period = parseEnumParam(req.body.period, { name: "period", allowed: REPORT_PERIODS, fallback: "daily" });

    const report = await generateUserReport(userId, period);
    return res.json({ success: true, report });
  } catch (error: any) {
    if (error instanceof InvalidRequestError) return res.status(400).json({ error: error.message });
    console.error("Failed to generate report", error);
    return res.status(500).json({ error: "Failed to generate report" });
  }
});

// GET single report details
router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const report = await prisma.report.findFirst({
      where: { id: reportId, userId: req.user!.userId },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({ success: true, report });
  } catch (error: any) {
    console.error("Failed to fetch report", error);
    return res.status(500).json({ error: "Failed to fetch report" });
  }
});

export default router;
