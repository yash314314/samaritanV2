import { prisma } from "../prisma";
import { completeDeepWorkSessionByTimer } from "./deepWorkService";

export function startSessionExpiryChecker() {
  console.log("[SessionExpiry] Checker started");

  setInterval(async () => {
    try {
      const now = new Date();
      const activeSessions = await prisma.deepWorkSession.findMany({
        where: {
          status: "active"
        }
      });

      for (const session of activeSessions) {
        if (!session.pausedAt && session.phaseEndsAt && now >= session.phaseEndsAt) {
          await completeDeepWorkSessionByTimer(session.id);
          console.log(`[SessionExpiry] Advanced timer for session ${session.id}`);
        }
      }
    } catch (err) {
      console.error("[SessionExpiry] Error:", err);
    }
  }, 1000);
}
