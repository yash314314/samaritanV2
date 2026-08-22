import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { getCalendarIntelligence } from "../services/calendarIntelligenceService";

function at(localTime: string) {
  return new Date(`2030-01-07T${localTime}:00+05:30`);
}

async function main() {
  const userId = `calendar-intelligence-check-${Date.now()}`;
  await prisma.calendarTrackingSettings.create({ data: { userId, timezone: "Asia/Kolkata" } });
  await prisma.calendarEvent.createMany({
    data: [
      { userId, title: "Planning", startAt: at("09:30"), endAt: at("10:30"), eventType: "meeting" },
      { userId, title: "Client call", startAt: at("10:20"), endAt: at("11:00"), eventType: "meeting" },
      { userId, title: "Review", startAt: at("11:10"), endAt: at("12:00"), eventType: "meeting" },
      { userId, title: "Standup", startAt: at("12:20"), endAt: at("13:00"), eventType: "meeting" },
    ],
  });

  try {
    const result = await getCalendarIntelligence(
      userId,
      new Date("2030-01-06T18:30:00.000Z"),
      new Date("2030-01-07T18:29:59.999Z"),
      new Date("2030-01-06T12:00:00.000Z")
    );
    assert.equal(result.days.length, 1);
    assert.equal(result.days[0].busyMs, 180 * 60_000, "overlap must not inflate busy time");
    assert.equal(result.summary.conflictCount, 1);
    assert.equal(result.summary.compressedGapCount, 2);
    assert.equal(result.conflicts[0].overlapMs, 10 * 60_000);
    assert.equal(result.focusWindows[0].durationMs, 5 * 60 * 60_000);
    assert.equal(result.focusWindows[0].quality, "prime");
    assert.ok(result.recommendations.some((item) => item.id === "conflict-2030-01-07"));
    assert.ok(result.recommendations.some((item) => item.id === "recovery-2030-01-07"));

    console.log("Calendar intelligence verification passed", {
      busyMinutes: result.days[0].busyMs / 60_000,
      conflicts: result.summary.conflictCount,
      compressedGaps: result.summary.compressedGapCount,
      primeFocusMinutes: result.focusWindows[0].durationMs / 60_000,
    });
  } finally {
    await prisma.calendarEvent.deleteMany({ where: { userId } });
    await prisma.calendarTrackingSettings.deleteMany({ where: { userId } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
