import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { updateCalendarSession } from "../services/calendarTrackingService";

async function main() {
  const userId = `calendar-correction-check-${Date.now()}`;
  const start = new Date("2026-08-13T09:15:00.000Z");
  const end = new Date("2026-08-13T10:05:00.000Z");
  const session = await prisma.calendarSession.create({
    data: {
      userId,
      title: "Uncorrected meeting",
      type: "meeting",
      source: "activity",
      status: "tentative",
    },
  });

  try {
    const corrected = await updateCalendarSession(userId, session.id, {
      title: "Corrected client call",
      type: "meeting",
      status: "confirmed",
      actualStart: start,
      actualEnd: end,
    });
    assert.equal(corrected?.actualDurationMs, 50 * 60_000);
    assert.equal(corrected?.status, "confirmed");
    assert.equal(corrected?.confidence, 1);

    await assert.rejects(
      updateCalendarSession(userId, session.id, { actualStart: end, actualEnd: start }),
      /after actual start/
    );

    const missed = await updateCalendarSession(userId, session.id, {
      status: "missed",
      actualStart: null,
      actualEnd: null,
    });
    assert.equal(missed?.actualDurationMs, 0);
    assert.equal(missed?.actualStart, null);
    assert.equal(missed?.actualEnd, null);

    console.log("Calendar session correction verification passed", {
      correctedMinutes: corrected.actualDurationMs / 60_000,
      missedDuration: missed.actualDurationMs,
      invalidRangeRejected: true,
    });
  } finally {
    await prisma.calendarSession.deleteMany({ where: { id: session.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
