import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calendarSessionDurationInRange, parseCalendarDate } from "../calendarTimeService";

describe("parseCalendarDate", () => {
  test("parses local days, offsets and datetime-local inputs", () => {
    assert.equal(parseCalendarDate("2026-10-22", "Asia/Kolkata")?.toISOString(), "2026-10-21T18:30:00.000Z");
    assert.equal(parseCalendarDate("2026-10-22", "Asia/Kolkata", true)?.toISOString(), "2026-10-22T18:29:59.999Z");
    assert.equal(parseCalendarDate("2026-10-22T09:30", "Asia/Kolkata")?.toISOString(), "2026-10-22T04:00:00.000Z");
    assert.equal(parseCalendarDate("2026-10-22T09:30:00.000Z", "Asia/Kolkata")?.toISOString(), "2026-10-22T09:30:00.000Z");
    assert.equal(parseCalendarDate("2026-10-22T09:30:00+05:30", "UTC")?.toISOString(), "2026-10-22T04:00:00.000Z");
  });

  test("rejects garbage and impossible dates instead of throwing or rolling over", () => {
    for (const value of ["abc", "2026-13-45", "2026-02-30", "2026-02-30T10:00", "2026-13-01T00:00:00Z", "", "  ", 42, null]) {
      assert.equal(parseCalendarDate(value, "Asia/Kolkata"), undefined, String(value));
    }
  });
});

describe("calendarSessionDurationInRange", () => {
  const from = new Date("2026-10-21T18:30:00.000Z"); // 2026-10-22 00:00 IST
  const to = new Date("2026-10-22T18:30:00.000Z");   // 2026-10-23 00:00 IST
  const now = new Date("2026-10-22T16:00:00.000Z");

  test("clips a finished session that straddles the range start", () => {
    const duration = calendarSessionDurationInRange({
      status: "confirmed",
      actualStart: new Date("2026-10-21T18:00:00.000Z"),
      actualEnd: new Date("2026-10-21T19:00:00.000Z"),
      actualDurationMs: 60 * 60_000,
    }, from, to, now);
    assert.equal(duration, 30 * 60_000);
  });

  test("scales the recorded duration and never exceeds the span", () => {
    assert.equal(calendarSessionDurationInRange({
      status: "confirmed",
      actualStart: new Date("2026-10-22T04:00:00.000Z"),
      actualEnd: new Date("2026-10-22T05:00:00.000Z"),
      actualDurationMs: 45 * 60_000,
    }, from, to, now), 45 * 60_000);
    assert.equal(calendarSessionDurationInRange({
      status: "confirmed",
      actualStart: new Date("2026-10-22T04:00:00.000Z"),
      actualEnd: new Date("2026-10-22T05:00:00.000Z"),
      actualDurationMs: 5 * 60 * 60_000,
    }, from, to, now), 60 * 60_000);
  });

  test("active sessions run until now", () => {
    assert.equal(calendarSessionDurationInRange({
      status: "active",
      actualStart: new Date("2026-10-22T15:00:00.000Z"),
      actualEnd: null,
      actualDurationMs: 0,
    }, from, to, now), 60 * 60_000);
  });
});
