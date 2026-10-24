import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEEP_WORK_DAY_THRESHOLD_MS,
  deepWorkMsByISTDay,
  deepWorkSessionBlocks,
  deepWorkStreak,
  detectDeepWorkBlocks,
  focusScoreOf,
  fragmentationScoreOf,
  intentDistribution,
  msByISTHour,
  peakProductiveHourOf,
  productivityScoreOf,
  resolveActivityTime,
  sliceEffective,
  splitByISTDay,
  summarizeActivities,
  type RangeActivity,
} from "../rangeMetrics";
import { buildISTDateRange } from "../../utils/time";

let nextId = 0;
/** Activity whose times are given in IST wall-clock ("2026-10-20 16:29:16"). */
function activity(start: string, end: string, overrides: Partial<RangeActivity> = {}): RangeActivity {
  const startTime = new Date(`${start.replace(" ", "T")}+05:30`);
  const endTime = new Date(`${end.replace(" ", "T")}+05:30`);
  return {
    id: `a${nextId++}`,
    sessionId: "s1",
    appName: "kitty",
    windowTitle: "shell",
    type: "active",
    category: "development_tools",
    intent: "runtime",
    focusImpact: 0.65,
    energyImpact: 0,
    startTime,
    endTime,
    duration: endTime.getTime() - startTime.getTime(),
    ...overrides,
  };
}

const idle = (start: string, end: string, overrides: Partial<RangeActivity> = {}) =>
  activity(start, end, {
    appName: "System Idle",
    windowTitle: "User inactive",
    type: "idle",
    category: "idle",
    intent: "idle",
    focusImpact: 0,
    energyImpact: 0.1,
    ...overrides,
  });

const MIN = 60_000;

describe("resolveActivityTime", () => {
  test("idle wins where the tracker overlapped it with the closing active segment", () => {
    // Real pattern from the tracker: the active segment runs ~2 min past the
    // backdated idle start.
    const day = buildISTDateRange("2026-10-20", "2026-10-20");
    const items = resolveActivityTime([
      activity("2026-10-20 16:29:16", "2026-10-20 16:31:16"),
      idle("2026-10-20 16:29:17", "2026-10-20 16:38:36"),
    ], day.start.getTime(), day.end.getTime());

    const totals = summarizeActivities(items);
    assert.equal(totals.activeMs, 1000);
    assert.equal(totals.idleMs, (9 * 60 + 19) * 1000);
    // Owned time equals the wall-clock span covered: no double counting.
    assert.equal(totals.trackedMs, (9 * 60 + 20) * 1000);
  });

  test("between two active segments the later-started one owns the overlap", () => {
    const day = buildISTDateRange("2026-10-20", "2026-10-20");
    const [first, second] = resolveActivityTime([
      activity("2026-10-20 10:00:00", "2026-10-20 10:10:00", { appName: "code" }),
      activity("2026-10-20 10:05:00", "2026-10-20 10:08:00", { appName: "brave" }),
    ], day.start.getTime(), day.end.getTime());
    assert.equal(first.activity.appName, "code");
    assert.equal(first.ms, 7 * MIN);
    assert.deepEqual(first.segments.length, 2);
    assert.equal(second.ms, 3 * MIN);
  });

  test("activities straddling midnight are clipped to each IST day", () => {
    const rows = [idle("2026-10-20 23:42:02", "2026-10-21 01:06:15")];
    const day1 = buildISTDateRange("2026-10-20", "2026-10-20");
    const day2 = buildISTDateRange("2026-10-21", "2026-10-21");
    const both = buildISTDateRange("2026-10-20", "2026-10-21");

    const first = summarizeActivities(resolveActivityTime(rows, day1.start.getTime(), day1.end.getTime()));
    const second = summarizeActivities(resolveActivityTime(rows, day2.start.getTime(), day2.end.getTime()));
    const total = summarizeActivities(resolveActivityTime(rows, both.start.getTime(), both.end.getTime()));

    assert.equal(first.idleMs, (17 * 60 + 58) * 1000);
    assert.equal(second.idleMs, (66 * 60 + 15) * 1000);
    assert.equal(first.idleMs + second.idleMs, total.idleMs);
  });

  test("clipping keeps overlap priority from the original start", () => {
    const day2 = buildISTDateRange("2026-10-21", "2026-10-21");
    // Idle that began before midnight still beats the active segment after clipping.
    const idleFirst = summarizeActivities(resolveActivityTime([
      activity("2026-10-20 23:58:00", "2026-10-21 00:03:00"),
      idle("2026-10-20 23:59:00", "2026-10-21 00:10:00"),
    ], day2.start.getTime(), day2.end.getTime()));
    assert.equal(idleFirst.activeMs, 0);
    assert.equal(idleFirst.idleMs, 10 * MIN);

    // Both actives are clipped to 00:00, but brave started later (23:59) so it
    // owns the overlap, exactly as it does in the unclipped two-day range.
    const items = resolveActivityTime([
      activity("2026-10-20 23:59:00", "2026-10-21 00:03:00", { appName: "brave" }),
      activity("2026-10-20 23:58:00", "2026-10-21 00:05:00", { appName: "code" }),
    ], day2.start.getTime(), day2.end.getTime());
    const owned = Object.fromEntries(items.map((item) => [item.activity.appName, item.ms]));
    assert.deepEqual(owned, { brave: 3 * MIN, code: 2 * MIN });
  });

  test("per-day and per-hour slices add up and never exceed wall clock", () => {
    const rows = [
      activity("2026-10-22 01:00:00", "2026-10-22 01:58:00"),
      idle("2026-10-22 01:56:00", "2026-10-22 05:22:00"),
      activity("2026-10-22 05:20:00", "2026-10-22 05:30:00", { appName: "brave", category: "entertainment" }),
      idle("2026-10-21 23:30:00", "2026-10-22 00:30:00"),
    ];
    const range = buildISTDateRange("2026-10-21", "2026-10-22");
    const items = resolveActivityTime(rows, range.start.getTime(), range.end.getTime());
    const total = summarizeActivities(items);

    const perDay = [...splitByISTDay(items, "2026-10-21", "2026-10-22").values()].map(summarizeActivities);
    assert.equal(perDay.reduce((sum, day) => sum + day.trackedMs, 0), total.trackedMs);
    assert.equal(perDay.reduce((sum, day) => sum + day.activeMs, 0), total.activeMs);

    const hours = msByISTHour(items, () => true);
    assert.ok(hours.every((ms) => ms <= 3_600_000), JSON.stringify(hours));
    assert.equal(hours.reduce((sum, ms) => sum + ms, 0), total.trackedMs);

    const sliced = summarizeActivities(sliceEffective(items, range.start.getTime(), range.end.getTime()));
    assert.equal(sliced.trackedMs, total.trackedMs);
  });
});

describe("range scores", () => {
  const day = buildISTDateRange("2026-10-22", "2026-10-22");
  const rows = [
    activity("2026-10-22 10:00:00", "2026-10-22 10:30:00", { category: "deep_work", intent: "coding", focusImpact: 0.9, windowTitle: "a.ts" }),
    activity("2026-10-22 10:30:00", "2026-10-22 10:45:00", { appName: "brave", category: "entertainment", intent: "streaming_video", focusImpact: 0.1, windowTitle: "video" }),
    activity("2026-10-22 10:45:00", "2026-10-22 11:00:00", { category: "deep_work", intent: "coding", focusImpact: 0.9, windowTitle: "b.ts" }),
    idle("2026-10-22 11:00:00", "2026-10-22 13:00:00"),
    activity("2026-10-22 13:00:00", "2026-10-22 13:00:00.100", { intent: "documentation", windowTitle: "doc" }),
  ];
  const items = resolveActivityTime(rows, day.start.getTime(), day.end.getTime());
  const totals = summarizeActivities(items);

  test("focus and productivity are 0-100 over active time only", () => {
    const activeMs = 60 * MIN + 100;
    assert.equal(totals.activeMs, activeMs);
    const expectedFocus = ((0.9 * 45 * MIN + 0.1 * 15 * MIN + 0.65 * 100) / activeMs) * 100;
    assert.ok(Math.abs(focusScoreOf(totals) - expectedFocus) < 1e-9);
    const expectedProductivity = ((45 * MIN + 100) / activeMs) * 100;
    assert.ok(Math.abs(productivityScoreOf(totals) - expectedProductivity) < 1e-9);
    assert.equal(focusScoreOf({ activeMs: 0, focusWeightedMs: 0 }), 0);
  });

  test("switches count context changes inside a session", () => {
    assert.equal(totals.switches, 3);
  });

  test("intent distribution excludes idle, sums to ~100 and drops zero-share intents", () => {
    const intents = intentDistribution(totals);
    assert.deepEqual(intents.map((entry) => entry.intent), ["coding", "streaming_video"]);
    const sum = intents.reduce((acc, entry) => acc + entry.percentage, 0);
    assert.ok(Math.abs(sum - 100) < 0.05, String(sum));
    assert.ok(intents.every((entry) => entry.avgFocus >= 0 && entry.avgFocus <= 100));
  });

  test("peak productive hour is an IST hour, null without productive time", () => {
    assert.equal(peakProductiveHourOf(items), 10);
    const idleOnly = resolveActivityTime([idle("2026-10-22 00:00:00", "2026-10-22 01:00:00")], day.start.getTime(), day.end.getTime());
    assert.equal(peakProductiveHourOf(idleOnly), null);
  });

  test("deep-work blocks break on other activity, idle and long gaps", () => {
    const blocks = detectDeepWorkBlocks(items);
    assert.deepEqual(blocks.map((block) => block.duration), [30 * MIN, 15 * MIN]);

    const gapped = resolveActivityTime([
      activity("2026-10-22 09:00:00", "2026-10-22 09:20:00", { category: "deep_work" }),
      activity("2026-10-22 09:21:00", "2026-10-22 09:30:00", { category: "deep_work" }),
      activity("2026-10-22 15:00:00", "2026-10-22 15:20:00", { category: "deep_work" }),
    ], day.start.getTime(), day.end.getTime());
    assert.deepEqual(detectDeepWorkBlocks(gapped).map((block) => block.duration), [29 * MIN, 20 * MIN]);
  });

  test("only blocks of ten minutes or more count as deep-work sessions", () => {
    const day = buildISTDateRange("2026-10-22", "2026-10-22");
    const items = resolveActivityTime([
      activity("2026-10-22 09:00:00", "2026-10-22 09:00:40", { category: "deep_work" }),
      activity("2026-10-22 09:00:40", "2026-10-22 09:05:00", { category: "entertainment" }),
      activity("2026-10-22 10:00:00", "2026-10-22 10:12:00", { category: "deep_work" }),
      activity("2026-10-22 11:00:00", "2026-10-22 11:09:59", { category: "deep_work" }),
    ], day.start.getTime(), day.end.getTime());
    assert.equal(detectDeepWorkBlocks(items).length, 3);
    assert.deepEqual(deepWorkSessionBlocks(items).map((block) => block.duration), [12 * MIN]);
  });
});

describe("deepWorkStreak", () => {
  const enough = DEEP_WORK_DAY_THRESHOLD_MS;
  test("counts consecutive IST days and keeps a streak alive while today is in progress", () => {
    const days = new Map([
      ["2026-10-18", enough],
      ["2026-10-19", enough],
      ["2026-10-20", enough + 1],
      ["2026-10-21", enough],
    ]);
    assert.deepEqual(deepWorkStreak(days, "2026-10-22"), { current: 4, longest: 4 });
    assert.deepEqual(deepWorkStreak(new Map([...days, ["2026-10-22", enough]]), "2026-10-22"), { current: 5, longest: 5 });
    assert.deepEqual(deepWorkStreak(days, "2026-10-23"), { current: 0, longest: 4 });
  });

  test("days below the threshold and gaps break the streak", () => {
    const days = new Map([
      ["2026-10-10", enough],
      ["2026-10-11", enough],
      ["2026-10-12", enough - 1],
      ["2026-10-20", enough],
    ]);
    assert.deepEqual(deepWorkStreak(days, "2026-10-22"), { current: 0, longest: 2 });
    assert.deepEqual(deepWorkStreak(new Map(), "2026-10-22"), { current: 0, longest: 0 });
  });

  test("deep-work time is attributed to IST days, not UTC days", () => {
    // 00:28-00:58 IST on Oct 22 is still Oct 21 in UTC.
    const all = buildISTDateRange("2026-10-21", "2026-10-22");
    const items = resolveActivityTime(
      [activity("2026-10-22 00:28:00", "2026-10-22 00:58:00", { category: "deep_work" })],
      all.start.getTime(),
      all.end.getTime()
    );
    assert.deepEqual([...deepWorkMsByISTDay(items).entries()], [["2026-10-22", 30 * MIN]]);
  });
});

describe("fragmentationScoreOf", () => {
  test("is 0 without switching and rises monotonically below 100", () => {
    assert.equal(fragmentationScoreOf(0), 0);
    assert.equal(fragmentationScoreOf(Number.NaN), 0);
    const rates = [0.25, 0.5, 1, 1.3, 2, 3, 6, 20];
    const scores = rates.map(fragmentationScoreOf);
    scores.forEach((score, index) => {
      assert.ok(score > 0 && score < 100, `rate ${rates[index]} -> ${score}`);
      if (index > 0) assert.ok(score > scores[index - 1]);
    });
  });

  test("ordinary multitasking stays mid-scale", () => {
    assert.ok(Math.abs(fragmentationScoreOf(1) - 48.7) < 0.5);
    assert.ok(fragmentationScoreOf(3) > 85);
  });
});

describe("deepWorkStreak on a finished day", () => {
  const day = (key: string, minutes: number): [string, number] => [key, minutes * 60000];

  test("a past day that did not qualify breaks the streak", () => {
    const totals = new Map([day("2026-10-19", 30), day("2026-10-20", 30), day("2026-10-21", 0)]);
    assert.deepEqual(deepWorkStreak(totals, "2026-10-21", false), { current: 0, longest: 2 });
  });

  test("the current day keeps yesterday's streak alive while in progress", () => {
    const totals = new Map([day("2026-10-19", 30), day("2026-10-20", 30)]);
    assert.deepEqual(deepWorkStreak(totals, "2026-10-21", true), { current: 2, longest: 2 });
  });
});
