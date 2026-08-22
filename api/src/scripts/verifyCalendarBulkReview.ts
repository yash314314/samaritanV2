import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { reviewCalendarSessions } from "../services/calendarTrackingService";

const userId = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const scheduledStart = new Date("2026-08-13T04:00:00.000Z");
const scheduledEnd = new Date("2026-08-13T05:00:00.000Z");
const createdIds: string[] = [];

async function main() {
  try {
    const emptyEvidence = await prisma.calendarSession.create({
      data: {
        userId,
        type: "meeting",
        source: "calendar",
        status: "tentative",
        title: "Bulk review empty evidence",
        scheduledStart,
        scheduledEnd,
      },
    });
    const partialEvidence = await prisma.calendarSession.create({
      data: {
        userId,
        type: "meeting",
        source: "calendar",
        status: "tentative",
        title: "Bulk review partial evidence",
        scheduledStart,
        scheduledEnd,
        actualStart: scheduledStart,
        actualEnd: new Date(scheduledStart.getTime() + 5 * 60_000),
        actualDurationMs: 5 * 60_000,
        confidence: 0.8,
      },
    });
    const alreadyConfirmed = await prisma.calendarSession.create({
      data: {
        userId,
        type: "meeting",
        source: "manual",
        status: "confirmed",
        title: "Bulk review guarded session",
        actualStart: scheduledStart,
        actualEnd: scheduledEnd,
        actualDurationMs: 60 * 60_000,
        confidence: 1,
      },
    });
    createdIds.push(emptyEvidence.id, partialEvidence.id, alreadyConfirmed.id);

    const result = await reviewCalendarSessions(
      userId,
      [emptyEvidence.id, partialEvidence.id, alreadyConfirmed.id, "missing-session", emptyEvidence.id],
      "confirm"
    );
    assert.equal(result.requested, 4);
    assert.equal(result.reviewed, 2);
    assert.equal(result.skipped, 2);

    const reviewed = await prisma.calendarSession.findMany({ where: { id: { in: createdIds } } });
    const filled = reviewed.find((session) => session.id === emptyEvidence.id)!;
    const preserved = reviewed.find((session) => session.id === partialEvidence.id)!;
    const guarded = reviewed.find((session) => session.id === alreadyConfirmed.id)!;
    assert.equal(filled.status, "confirmed");
    assert.equal(filled.actualDurationMs, 60 * 60_000);
    assert.equal(filled.confidence, 0.5);
    assert.ok(filled.reviewedAt);
    assert.equal(preserved.status, "confirmed");
    assert.equal(preserved.actualDurationMs, 5 * 60_000);
    assert.equal(preserved.confidence, 0.8);
    assert.equal(guarded.status, "confirmed");
    assert.equal(guarded.reviewedAt, null);

    console.log("Calendar bulk review verification passed");
  } finally {
    if (createdIds.length) await prisma.calendarSession.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
