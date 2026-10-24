import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { productiveMinutesOf } from "../goalProgressService";
import { calculateProjectTime, projectActivityIntervals } from "../projectTimeService";
import { resolveActivityTime, type RangeActivity } from "../rangeMetrics";
import { buildISTDateRange } from "../../utils/time";

type ProjectActivity = RangeActivity & { projectId?: string | null };

let nextId = 0;
/** Activity whose times are given in IST wall-clock ("2026-10-22 09:00:00"). */
function activity(start: string, end: string, overrides: Partial<ProjectActivity> = {}): ProjectActivity {
  const startTime = new Date(`${start.replace(" ", "T")}+05:30`);
  const endTime = new Date(`${end.replace(" ", "T")}+05:30`);
  return {
    id: `p${nextId++}`,
    sessionId: "s1",
    appName: "code",
    windowTitle: "editor",
    type: "active",
    category: "deep_work",
    intent: "coding",
    focusImpact: 0.95,
    energyImpact: 0,
    startTime,
    endTime,
    duration: endTime.getTime() - startTime.getTime(),
    projectId: null,
    ...overrides,
  };
}

const idle = (start: string, end: string) =>
  activity(start, end, { appName: "System Idle", windowTitle: "User inactive", type: "idle", category: "idle", intent: "idle", focusImpact: 0 });

const day = buildISTDateRange("2026-10-22", "2026-10-22");

describe("productiveMinutesOf", () => {
  test("counts productive categories once, without backdated idle or distractions", () => {
    const items = resolveActivityTime([
      // The tracker closes this row two minutes after the idle it backdates.
      activity("2026-10-22 09:00:00", "2026-10-22 09:30:00"),
      idle("2026-10-22 09:28:00", "2026-10-22 09:40:00"),
      activity("2026-10-22 09:40:00", "2026-10-22 10:00:00", { category: "entertainment", intent: "streaming_video" }),
      activity("2026-10-22 10:00:00", "2026-10-22 10:10:00", { category: "communication", intent: "chat" }),
      activity("2026-10-22 10:10:00", "2026-10-22 10:20:00", { category: "research", intent: "reading" }),
    ], day.start.getTime(), day.end.getTime());
    assert.equal(productiveMinutesOf(items), 28 + 10);
  });

  test("keeps only the goal's project", () => {
    const items = resolveActivityTime([
      activity("2026-10-22 09:00:00", "2026-10-22 09:30:00", { projectId: "alpha" }),
      activity("2026-10-22 09:30:00", "2026-10-22 09:45:00", { projectId: "beta" }),
    ], day.start.getTime(), day.end.getTime());
    assert.equal(productiveMinutesOf(items, "alpha"), 30);
    assert.equal(productiveMinutesOf(items, "beta"), 15);
    assert.equal(productiveMinutesOf(items), 45);
  });
});

describe("projectActivityIntervals", () => {
  test("project time ends where the backdated idle begins", () => {
    const intervals = projectActivityIntervals([
      activity("2026-10-22 09:00:00", "2026-10-22 10:00:00", { projectId: "alpha" }),
      idle("2026-10-22 09:58:00", "2026-10-22 10:20:00"),
      activity("2026-10-22 10:20:00", "2026-10-22 10:30:00"),
    ], day.start.getTime(), day.end.getTime());
    assert.equal(calculateProjectTime(intervals).get("alpha")?.minutes, 58);
    assert.equal(intervals.length, 1);
  });

  test("a later foreground row of another project takes over the overlap", () => {
    const intervals = projectActivityIntervals([
      activity("2026-10-22 09:00:00", "2026-10-22 09:40:00", { projectId: "alpha" }),
      activity("2026-10-22 09:30:00", "2026-10-22 10:00:00", { projectId: "beta" }),
    ], day.start.getTime(), day.end.getTime());
    const totals = calculateProjectTime(intervals);
    assert.equal(totals.get("alpha")?.minutes, 30);
    assert.equal(totals.get("beta")?.minutes, 30);
  });

  test("filters to one project and clips to the range", () => {
    const window = buildISTDateRange("2026-10-22", "2026-10-22");
    const intervals = projectActivityIntervals([
      activity("2026-10-21 23:50:00", "2026-10-22 00:20:00", { projectId: "alpha" }),
      activity("2026-10-22 01:00:00", "2026-10-22 01:30:00", { projectId: "beta" }),
    ], window.start.getTime(), window.end.getTime(), "alpha");
    assert.equal(intervals.length, 1);
    assert.equal(calculateProjectTime(intervals).get("alpha")?.minutes, 20);
  });
});
