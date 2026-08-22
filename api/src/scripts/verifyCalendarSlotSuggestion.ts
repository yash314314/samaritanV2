import assert from "node:assert/strict";
import { findAvailableCalendarSlot } from "../services/calendarIntelligenceService";

const hour = 60 * 60_000;

const sameDay = findAvailableCalendarSlot({
  eventId: "same-day",
  durationMs: hour,
  searchFrom: new Date("2026-08-13T04:00:00.000Z"), // 09:30 Asia/Kolkata
  originalStart: new Date("2026-08-13T04:00:00.000Z"),
  timeZone: "Asia/Kolkata",
  busy: [{ start: new Date("2026-08-13T03:30:00.000Z"), end: new Date("2026-08-13T04:30:00.000Z") }],
});
assert.equal(sameDay?.startAt.toISOString(), "2026-08-13T04:45:00.000Z");
assert.equal(sameDay?.endAt.toISOString(), "2026-08-13T05:45:00.000Z");
assert.equal(sameDay?.movedToAnotherDay, false);

const nextWorkday = findAvailableCalendarSlot({
  eventId: "next-day",
  durationMs: 2 * hour,
  searchFrom: new Date("2026-08-14T11:30:00.000Z"), // Friday 17:00 Asia/Kolkata
  originalStart: new Date("2026-08-14T11:30:00.000Z"),
  timeZone: "Asia/Kolkata",
  busy: [],
});
assert.equal(nextWorkday?.startAt.toISOString(), "2026-08-17T03:30:00.000Z");
assert.equal(nextWorkday?.movedToAnotherDay, true);

const dstWeekend = findAvailableCalendarSlot({
  eventId: "dst-weekend",
  durationMs: 2 * hour,
  searchFrom: new Date("2026-03-06T22:00:00.000Z"), // Friday 17:00 EST
  originalStart: new Date("2026-03-06T22:00:00.000Z"),
  timeZone: "America/New_York",
  busy: [],
});
assert.equal(dstWeekend?.startAt.toISOString(), "2026-03-09T13:00:00.000Z"); // Monday 09:00 EDT

const tooLong = findAvailableCalendarSlot({
  eventId: "too-long",
  durationMs: 10 * hour,
  searchFrom: new Date("2026-08-13T03:30:00.000Z"),
  originalStart: new Date("2026-08-13T03:30:00.000Z"),
  timeZone: "Asia/Kolkata",
  busy: [],
});
assert.equal(tooLong, null);

const customTuesday = findAvailableCalendarSlot({
  eventId: "custom-tuesday",
  durationMs: hour,
  searchFrom: new Date("2026-08-17T03:30:00.000Z"), // Monday 09:00 Asia/Kolkata
  originalStart: new Date("2026-08-17T03:30:00.000Z"),
  timeZone: "Asia/Kolkata",
  busy: [],
  workHours: [
    { dayOfWeek: 1, enabled: false, startMinute: 540, endMinute: 1080 },
    { dayOfWeek: 2, enabled: true, startMinute: 11 * 60, endMinute: 15 * 60 },
  ],
});
assert.equal(customTuesday?.startAt.toISOString(), "2026-08-18T05:30:00.000Z");

console.log("Calendar slot suggestion verification passed");
