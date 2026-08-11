import cron from "node-cron";
import { aggregateAllUsersProjectTime } from "../services/projectTimeService";

/**
 * Nightly project-time aggregation job.
 *
 * Runs every day at 2:00 AM IST and aggregates the previous day's
 * activities into the ProjectTime table for all users.
 */
export function startProjectTimeAggregation() {
  console.log("[ProjectTimeAggregation] Nightly job scheduled (2:00 AM IST)");

  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log("[ProjectTimeAggregation] Running nightly aggregation...");

      // Compute "yesterday" in IST (YYYY-MM-DD)
      const IST_OFFSET = 5.5 * 60 * 60 * 1000;
      const now = new Date();
      const ist = new Date(now.getTime() + IST_OFFSET);
      const yesterday = new Date(ist.getTime() - 24 * 60 * 60 * 1000);

      const date = [
        yesterday.getUTCFullYear(),
        String(yesterday.getUTCMonth() + 1).padStart(2, "0"),
        String(yesterday.getUTCDate()).padStart(2, "0"),
      ].join("-");

      try {
        const results = await aggregateAllUsersProjectTime(date);
        console.log("[ProjectTimeAggregation] Completed:", results);
      } catch (err) {
        console.error("[ProjectTimeAggregation] Failed:", err);
      }
    },
    {
      timezone: "Asia/Kolkata",
      name: "aggregate-project-time",
      noOverlap: true,
    }
  );
}