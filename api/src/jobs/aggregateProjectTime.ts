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

      try {
        const results = await aggregateAllUsersProjectTime();
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
