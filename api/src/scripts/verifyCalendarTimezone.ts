import assert from "node:assert/strict";
import { normalizeAllDayCalendarRange, normalizeCalendarTimezone, parseCalendarDate } from "../services/calendarTimeService";

const kolkataStart = parseCalendarDate("2026-08-13", "Asia/Kolkata");
const kolkataEnd = parseCalendarDate("2026-08-13", "Asia/Kolkata", true);
assert.equal(kolkataStart?.toISOString(), "2026-08-12T18:30:00.000Z");
assert.equal(kolkataEnd?.toISOString(), "2026-08-13T18:29:59.999Z");

const localInput = parseCalendarDate("2026-08-13T09:30", "Asia/Kolkata");
assert.equal(localInput?.toISOString(), "2026-08-13T04:00:00.000Z");

const explicitInstant = parseCalendarDate("2026-08-13T09:30:00Z", "America/New_York");
assert.equal(explicitInstant?.toISOString(), "2026-08-13T09:30:00.000Z");

// DST starts on this date, so the New York calendar day is only 23 hours long.
const dstStart = parseCalendarDate("2026-03-08", "America/New_York");
const dstEnd = parseCalendarDate("2026-03-08", "America/New_York", true);
assert.equal(dstStart?.toISOString(), "2026-03-08T05:00:00.000Z");
assert.equal(dstEnd?.toISOString(), "2026-03-09T03:59:59.999Z");

const allDay = normalizeAllDayCalendarRange("2026-03-08T09:00", "2026-03-08T10:00", "America/New_York");
assert.equal(allDay?.startAt.toISOString(), "2026-03-08T05:00:00.000Z");
assert.equal(allDay?.endAt.toISOString(), "2026-03-09T04:00:00.000Z");

assert.throws(() => normalizeCalendarTimezone("Mars/Olympus_Mons"), /Invalid calendar timezone/);

console.log("Calendar timezone verification passed");
