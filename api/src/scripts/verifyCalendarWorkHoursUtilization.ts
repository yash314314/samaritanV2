import assert from "node:assert/strict";
import {
  calculateCalendarWorkHoursUtilization,
  mergeCalendarActivityIntervals,
} from "../services/calendarWorkHoursService";

const workHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

const merged = mergeCalendarActivityIntervals([
  { start: new Date("2026-08-10T04:00:00.000Z"), end: new Date("2026-08-10T06:00:00.000Z") },
  { start: new Date("2026-08-10T05:00:00.000Z"), end: new Date("2026-08-10T07:00:00.000Z") },
]);
assert.equal(merged.length, 1);
assert.equal(merged[0].end.toISOString(), "2026-08-10T07:00:00.000Z");

const utilization = calculateCalendarWorkHoursUtilization({
  from: new Date("2026-08-09T18:30:00.000Z"),
  to: new Date("2026-08-11T18:29:59.999Z"),
  now: new Date("2026-08-11T08:30:00.000Z"),
  timeZone: "Asia/Kolkata",
  workHours,
  intervals: [
    // Monday: 08:00-12:00 local, one hour outside and three inside work hours.
    { start: new Date("2026-08-10T02:30:00.000Z"), end: new Date("2026-08-10T06:30:00.000Z") },
    // Overlaps the prior interval and must not inflate tracked time.
    { start: new Date("2026-08-10T05:30:00.000Z"), end: new Date("2026-08-10T07:30:00.000Z") },
    // Tuesday: 09:00-14:00 local; today has five elapsed scheduled hours.
    { start: new Date("2026-08-11T03:30:00.000Z"), end: new Date("2026-08-11T08:30:00.000Z") },
  ],
});

assert.equal(utilization.days.length, 2);
assert.equal(utilization.days[0].trackedMs, 5 * 60 * 60_000);
assert.equal(utilization.days[0].withinWorkHoursMs, 4 * 60 * 60_000);
assert.equal(utilization.days[0].offHoursMs, 60 * 60_000);
assert.equal(utilization.days[1].elapsedScheduledMs, 5 * 60 * 60_000);
assert.equal(utilization.days[1].utilizationPercent, 100);
assert.equal(utilization.summary.elapsedScheduledMs, 13 * 60 * 60_000);
assert.equal(utilization.summary.withinWorkHoursMs, 9 * 60 * 60_000);
assert.equal(utilization.summary.utilizationPercent, 69);
assert.equal(utilization.summary.adherencePercent, 90);
assert.equal(utilization.summary.offHoursDayCount, 1);

const dstUtilization = calculateCalendarWorkHoursUtilization({
  from: new Date("2026-03-08T05:00:00.000Z"),
  to: new Date("2026-03-09T04:00:00.000Z"),
  now: new Date("2026-03-09T04:00:00.000Z"),
  timeZone: "America/New_York",
  workHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek === 0,
    startMinute: 60,
    endMinute: 240,
  })),
  intervals: [{ start: new Date("2026-03-08T06:00:00.000Z"), end: new Date("2026-03-08T08:00:00.000Z") }],
});
assert.equal(dstUtilization.days[0].scheduledMs, 2 * 60 * 60_000);
assert.equal(dstUtilization.days[0].utilizationPercent, 100);

console.log("Calendar work-hours utilization verification passed");
