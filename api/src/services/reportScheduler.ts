import cron from "node-cron";
import { prisma } from "../prisma";
import { generateUserReport, reportPeriodRange } from "./reportService";
import { IST_TIMEZONE } from "../utils/time";

// Schedules run in IST regardless of the host timezone, and each report covers
// the period that just ended (yesterday / the previous 7 days), not the first
// minutes of the new day.
export function startReportScheduler() {
  console.log("[ReportScheduler] Initializing automated timely report scheduler...");

  // Run daily at 00:05 IST
  cron.schedule("5 0 * * *", async () => {
    console.log("[ReportScheduler] Running nightly daily report generation...");
    try {
      const range = reportPeriodRange("daily", new Date(), true);
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const u of users) {
        await generateUserReport(u.id, "daily", range.start, range.end);
      }
      console.log(`[ReportScheduler] Generated daily reports for ${users.length} users (${range.from}).`);
    } catch (err) {
      console.error("[ReportScheduler] Daily report generation error:", err);
    }
  }, { timezone: IST_TIMEZONE });

  // Run weekly every Monday at 00:15 IST
  cron.schedule("15 0 * * 1", async () => {
    console.log("[ReportScheduler] Running weekly report generation...");
    try {
      const range = reportPeriodRange("weekly", new Date(), true);
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const u of users) {
        await generateUserReport(u.id, "weekly", range.start, range.end);
      }
      console.log(`[ReportScheduler] Generated weekly reports for ${users.length} users (${range.from}..${range.to}).`);
    } catch (err) {
      console.error("[ReportScheduler] Weekly report generation error:", err);
    }
  }, { timezone: IST_TIMEZONE });
}
