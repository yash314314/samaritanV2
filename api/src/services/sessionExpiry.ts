import { prisma } from "../prisma";
import { emitDeepWorkExpired } from "../websocket/broadcaster";
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
        const plannedEnd = new Date(
          session.startedAt.getTime() + session.plannedMinutes * 60 * 1000
        );

        if (session.plannedMinutes <= 0) {
          await prisma.deepWorkSession.update({
            where: { id: session.id },
            data: {
              status: "expired",
              endedAt: now
            }
          });

          emitDeepWorkExpired(session.userId, session.id);
          console.log(`[SessionExpiry] Session ${session.id} expired`);
          continue;
        }

        if (now >= plannedEnd) {
          await completeDeepWorkSessionByTimer(session.id);
          console.log(`[SessionExpiry] Session ${session.id} completed by timer`);
        }
      }
    } catch (err) {
      console.error("[SessionExpiry] Error:", err);
    }
  }, 10000);
}
