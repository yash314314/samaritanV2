import cron from "node-cron";
import { prisma } from "../prisma";
import { generateUserReport } from "./reportService";

export function startReportScheduler() {
  console.log("[ReportScheduler] Initializing automated timely report scheduler...");

  // Run daily at 00:05 AM (0 5 0 * * *)
  cron.schedule("5 0 * * *", async () => {
    console.log("[ReportScheduler] Running nightly daily report generation...");
    try {
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const u of users) {
        await generateUserReport(u.id, "daily");
      }
      console.log(`[ReportScheduler] Generated daily reports for ${users.length} users.`);
    } catch (err) {
      console.error("[ReportScheduler] Daily report generation error:", err);
    }
  });

  // Run weekly every Monday at 00:15 AM (15 0 * * 1)
  cron.schedule("15 0 * * 1", async () => {
    console.log("[ReportScheduler] Running weekly report generation...");
    try {
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const u of users) {
        await generateUserReport(u.id, "weekly");
      }
      console.log(`[ReportScheduler] Generated weekly reports for ${users.length} users.`);
    } catch (err) {
      console.error("[ReportScheduler] Weekly report generation error:", err);
    }
  });
}
