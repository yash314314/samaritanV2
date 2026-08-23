import { prisma } from "../prisma";
import dayjs from "dayjs";

export interface ReportSummaryPayload {
  userId: string;
  period: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  focusHours: number;
  productivityPct: number;
  burnoutIndex: number;
  totalDurationHours: number;
  categoryBreakdown: Record<string, number>;
  topApps: Array<{ appName: string; durationMinutes: number; category: string }>;
  projectBreakdown: Array<{ projectName: string; minutes: number }>;
}

export async function generateUserReport(
  userId: string,
  period: "daily" | "weekly" | "monthly",
  customStart?: Date,
  customEnd?: Date
) {
  const endDate = customEnd || new Date();
  let startDate = customStart;

  if (!startDate) {
    if (period === "daily") {
      startDate = dayjs(endDate).startOf("day").toDate();
    } else if (period === "weekly") {
      startDate = dayjs(endDate).subtract(7, "day").startOf("day").toDate();
    } else {
      startDate = dayjs(endDate).subtract(30, "day").startOf("day").toDate();
    }
  }

  // Fetch activities in window
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startTime: { gte: startDate, lte: endDate },
    },
    include: {
      activities: {
        include: {
          project: true,
        },
      },
    },
  });

  let totalDurationSec = 0;
  let totalProductiveSec = 0;
  let totalFocusScoreSum = 0;
  let totalBurnoutScoreSum = 0;
  let sessionCount = 0;

  const appMap = new Map<string, { durationSec: number; category: string }>();
  const categoryMap = new Map<string, number>();
  const projectMap = new Map<string, number>();

  sessions.forEach((s) => {
    sessionCount++;
    totalFocusScoreSum += s.focusScore || 0;
    totalBurnoutScoreSum += s.burnoutScore || 0;

    s.activities.forEach((act) => {
      const dur = act.duration || 0;
      totalDurationSec += dur;

      const cat = act.category || "uncategorized";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + dur);

      if (cat === "productive") {
        totalProductiveSec += dur;
      }

      // App stats
      const appKey = act.appName || "Unknown";
      const existingApp = appMap.get(appKey);
      if (existingApp) {
        existingApp.durationSec += dur;
      } else {
        appMap.set(appKey, { durationSec: dur, category: cat });
      }

      // Project stats
      if (act.project) {
        const projName = act.project.name;
        projectMap.set(projName, (projectMap.get(projName) || 0) + Math.round(dur / 60));
      }
    });
  });

  const focusHours = Math.round((totalProductiveSec / 3600) * 10) / 10;
  const totalHours = Math.round((totalDurationSec / 3600) * 10) / 10;
  const productivityPct = totalDurationSec > 0 ? Math.round((totalProductiveSec / totalDurationSec) * 100) : 0;
  const burnoutIndex = sessionCount > 0 ? Math.round((totalBurnoutScoreSum / sessionCount) * 10) / 10 : 0;

  const topApps = Array.from(appMap.entries())
    .map(([appName, val]) => ({
      appName,
      durationMinutes: Math.round(val.durationSec / 60),
      category: val.category,
    }))
    .sort((a, b) => b.durationMinutes - a.durationMinutes)
    .slice(0, 7);

  const categoryBreakdown: Record<string, number> = {};
  categoryMap.forEach((valSec, catKey) => {
    categoryBreakdown[catKey] = Math.round(valSec / 60);
  });

  const projectBreakdown = Array.from(projectMap.entries()).map(([projectName, minutes]) => ({
    projectName,
    minutes,
  }));

  const summaryJson: ReportSummaryPayload = {
    userId,
    period,
    startDate,
    endDate,
    focusHours,
    productivityPct,
    burnoutIndex,
    totalDurationHours: totalHours,
    categoryBreakdown,
    topApps,
    projectBreakdown,
  };

  const title = `${period.toUpperCase()} Activity & Focus Report - ${dayjs(startDate).format("MMM D, YYYY")}`;

  const report = await prisma.report.create({
    data: {
      userId,
      title,
      period,
      startDate,
      endDate,
      summaryJson: summaryJson as any,
      productivityPct,
      focusHours,
      burnoutIndex,
    },
  });

  return report;
}
