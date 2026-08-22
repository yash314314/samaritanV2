import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { getCalendarTrackingSettings, updateCalendarTrackingSettings } from "../services/calendarTrackingService";

const userId = `calendar-work-hours-test-${Date.now()}`;

async function main() {
  try {
    const defaults = await getCalendarTrackingSettings(userId);
    assert.equal(defaults.workHours.length, 7);
    assert.deepEqual(defaults.workHours.filter((day) => day.enabled).map((day) => day.dayOfWeek), [1, 2, 3, 4, 5]);

    const custom = defaults.workHours.map((day) => ({
      ...day,
      enabled: day.dayOfWeek === 0 || day.dayOfWeek === 2,
      startMinute: day.dayOfWeek === 0 ? 10 * 60 : 11 * 60,
      endMinute: day.dayOfWeek === 0 ? 14 * 60 : 16 * 60,
    }));
    const saved = await updateCalendarTrackingSettings(userId, { timezone: "America/New_York", workHours: custom });
    assert.equal(saved.timezone, "America/New_York");
    assert.deepEqual(saved.workHours.filter((day) => day.enabled).map((day) => day.dayOfWeek), [0, 2]);
    assert.equal(saved.workHours[0].startMinute, 600);
    assert.equal(saved.workHours[2].endMinute, 960);

    await assert.rejects(
      updateCalendarTrackingSettings(userId, {
        timezone: "UTC",
        workHours: custom.map((day) => day.dayOfWeek === 2 ? { ...day, startMinute: 1000, endMinute: 900 } : day),
      }),
      /Workday end must be after its start/
    );
    const afterRejectedUpdate = await getCalendarTrackingSettings(userId);
    assert.equal(afterRejectedUpdate.timezone, "America/New_York");
    assert.equal(afterRejectedUpdate.workHours[2].startMinute, 660);

    console.log("Calendar work hours verification passed");
  } finally {
    await prisma.$transaction([
      prisma.calendarWorkHour.deleteMany({ where: { userId } }),
      prisma.calendarTrackingSettings.deleteMany({ where: { userId } }),
    ]);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
