import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  InvalidRequestError,
  addDaysToDateKey,
  buildISTDateRange,
  getISTDayRange,
  getISTHour,
  getISTHourFraction,
  isValidDateKey,
  istDayStart,
  lastISTDays,
  nextISTHourBoundary,
  overlapMs,
  resolveISTDateRange,
  toISTDateKey,
} from "../../utils/time";
import { parseEnumParam, parseIntegerParam, parseUserId } from "../../utils/requestParams";

describe("IST date helpers", () => {
  test("validates real calendar dates only", () => {
    assert.equal(isValidDateKey("2026-10-22"), true);
    assert.equal(isValidDateKey("2024-02-29"), true);
    assert.equal(isValidDateKey("2026-02-29"), false);
    assert.equal(isValidDateKey("2026-02-30"), false);
    assert.equal(isValidDateKey("2026-13-45"), false);
    assert.equal(isValidDateKey("2026-00-10"), false);
    assert.equal(isValidDateKey("abc"), false);
    assert.equal(isValidDateKey("2026-10-22T00:00:00Z"), false);
    assert.equal(isValidDateKey(20261022), false);
  });

  test("IST day boundaries do not depend on the host timezone", () => {
    assert.equal(istDayStart("2026-10-22").toISOString(), "2026-10-21T18:30:00.000Z");
    // 23:59 IST is still the same IST day although it is a different UTC hour.
    assert.equal(toISTDateKey(new Date("2026-10-22T18:29:59.999Z")), "2026-10-22");
    assert.equal(toISTDateKey(new Date("2026-10-22T18:30:00.000Z")), "2026-10-23");
    // 00:15 IST belongs to the IST day although UTC is still the previous day.
    assert.equal(toISTDateKey(new Date("2026-10-21T18:45:00.000Z")), "2026-10-22");

    const { start, end } = getISTDayRange(new Date("2026-10-21T20:00:00.000Z"));
    assert.equal(start.toISOString(), "2026-10-21T18:30:00.000Z");
    assert.equal(end.toISOString(), "2026-10-22T18:30:00.000Z");
    assert.throws(() => getISTDayRange(new Date("nope")), InvalidRequestError);
  });

  test("IST hours", () => {
    assert.equal(getISTHour(new Date("2026-10-22T16:11:00.000Z")), 21);
    assert.equal(getISTHour(new Date("2026-10-21T18:30:00.000Z")), 0);
    assert.equal(getISTHourFraction(new Date("2026-10-22T16:00:00.000Z")), 21.5);
    // Half-hour offset: the IST hour boundary is at :30 UTC.
    assert.equal(
      new Date(nextISTHourBoundary(Date.parse("2026-10-22T16:11:00.000Z"))).toISOString(),
      "2026-10-22T16:30:00.000Z"
    );
    assert.equal(
      new Date(nextISTHourBoundary(Date.parse("2026-10-22T16:30:00.000Z"))).toISOString(),
      "2026-10-22T17:30:00.000Z"
    );
  });

  test("date key arithmetic crosses month and year ends", () => {
    assert.equal(addDaysToDateKey("2026-10-31", 1), "2026-11-01");
    assert.equal(addDaysToDateKey("2027-01-01", -1), "2026-12-31");
    assert.equal(addDaysToDateKey("2024-02-28", 1), "2024-02-29");
  });

  test("inclusive ranges", () => {
    const range = buildISTDateRange("2026-10-16", "2026-10-22");
    assert.equal(range.days, 7);
    assert.equal(range.start.toISOString(), "2026-10-15T18:30:00.000Z");
    assert.equal(range.end.toISOString(), "2026-10-22T18:30:00.000Z");
    assert.equal(range.end.getTime() - range.start.getTime(), 7 * 24 * 3600 * 1000);

    const last7 = lastISTDays(7, "2026-10-22");
    assert.equal(last7.from, "2026-10-16");
    assert.equal(last7.to, "2026-10-22");
    assert.equal(lastISTDays(1, "2026-10-22").from, "2026-10-22");
  });

  test("resolveISTDateRange accepts date or from/to and rejects garbage", () => {
    const now = new Date("2026-10-22T16:11:00.000Z");
    assert.equal(resolveISTDateRange({}, { now }).from, "2026-10-22");
    assert.equal(resolveISTDateRange({ date: "2026-10-20" }).to, "2026-10-20");
    const ranged = resolveISTDateRange({ from: "2026-10-16", to: "2026-10-22", date: "2026-01-01" });
    assert.deepEqual([ranged.from, ranged.to, ranged.days], ["2026-10-16", "2026-10-22", 7]);
    const lone = resolveISTDateRange({ from: "2026-10-20" });
    assert.deepEqual([lone.from, lone.to], ["2026-10-20", "2026-10-20"]);

    for (const query of [
      { date: "abc" },
      { date: "2026-13-45" },
      { date: "2026-02-30" },
      { from: "2026-10-22", to: "2026-10-20" },
      { from: "2000-01-01", to: "2026-10-22" },
      { date: ["2026-10-20", "2026-10-21"] },
    ]) {
      assert.throws(() => resolveISTDateRange(query), InvalidRequestError, JSON.stringify(query));
    }
    assert.throws(() => resolveISTDateRange({}, { required: true }), InvalidRequestError);
    assert.throws(() => resolveISTDateRange({ from: "2026-10-21", to: "2026-10-22" }, { maxDays: 1 }), InvalidRequestError);
  });

  test("overlapMs clips to the range", () => {
    assert.equal(overlapMs(0, 100, 50, 200), 50);
    assert.equal(overlapMs(0, 100, 100, 200), 0);
    assert.equal(overlapMs(150, 120, 0, 200), 0);
  });
});

describe("request parameter parsing", () => {
  test("userId", () => {
    assert.equal(parseUserId("7007b337-6f7b-4d6a-86f9-dc4da4ed48c4"), "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4");
    assert.equal(parseUserId("calendar-work-hours-test-1700000000000"), "calendar-work-hours-test-1700000000000");
    assert.throws(() => parseUserId(undefined), /Missing userId/);
    assert.throws(() => parseUserId("not-a-user!"), /Invalid userId/);
    assert.throws(() => parseUserId(["a", "b"]), /Invalid userId/);
  });

  test("integers are clamped, garbage rejected", () => {
    const options = { name: "days", min: 1, max: 30, fallback: 7 };
    assert.equal(parseIntegerParam(undefined, options), 7);
    assert.equal(parseIntegerParam("", options), 7);
    assert.equal(parseIntegerParam("14", options), 14);
    assert.equal(parseIntegerParam("7.9", options), 7);
    assert.equal(parseIntegerParam("0", options), 1);
    assert.equal(parseIntegerParam("400", options), 30);
    for (const bad of ["abc", "7days", "1e3", "NaN", "Infinity", ["7"]]) {
      assert.throws(() => parseIntegerParam(bad, options), InvalidRequestError, String(bad));
    }
  });

  test("enums", () => {
    const allowed = ["score", "focus"] as const;
    assert.equal(parseEnumParam(undefined, { name: "colorMode", allowed, fallback: "score" }), "score");
    assert.equal(parseEnumParam("focus", { name: "colorMode", allowed, fallback: "score" }), "focus");
    assert.throws(() => parseEnumParam("rainbow", { name: "colorMode", allowed, fallback: "score" }), InvalidRequestError);
  });
});
