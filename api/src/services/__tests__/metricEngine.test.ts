import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  clamp,
  clamp01,
  getBaseFocus,
  getActivityProductivityScore,
  isIdleActivity,
  updateSmoothMetricState,
  SmoothMetricState,
  ActivityMetricInput,
} from "../metricEngine";

describe("MetricEngine Unit Tests", () => {
  test("clamp & clamp01 bounds check", () => {
    assert.equal(clamp(-10), 0);
    assert.equal(clamp(150), 100);
    assert.equal(clamp(50), 50);

    assert.equal(clamp01(-0.5), 0);
    assert.equal(clamp01(1.5), 1);
    assert.equal(clamp01(0.75), 0.75);
  });

  test("isIdleActivity detection", () => {
    assert.equal(isIdleActivity({ appName: "System Idle" }), true);
    assert.equal(isIdleActivity({ appName: "Code", type: "idle" }), true);
    assert.equal(isIdleActivity({ appName: "Chrome", category: "idle" }), true);
    assert.equal(isIdleActivity({ appName: "Cursor", category: "deep_work" }), false);
  });

  test("getBaseFocus mapping and defaults", () => {
    assert.equal(getBaseFocus({ appName: "Code", focusImpact: 0.85 }), 0.85);
    assert.equal(getBaseFocus({ appName: "Code", category: "deep_work" }), 0.9);
    assert.equal(getBaseFocus({ appName: "Spotify", category: "media" }), 0.2);
    assert.equal(getBaseFocus({ appName: "UnknownApp" }), 0.25);
  });

  test("getActivityProductivityScore calculations", () => {
    const idleScore = getActivityProductivityScore({ appName: "System Idle", type: "idle" });
    assert.equal(idleScore, 0);

    const codingScore = getActivityProductivityScore({
      appName: "Cursor",
      category: "deep_work",
      intent: "coding",
      confidence: 1.0,
    });
    assert.ok(codingScore >= 90, `Expected coding score >= 90, got ${codingScore}`);

    const entertainmentScore = getActivityProductivityScore({
      appName: "Steam",
      category: "entertainment",
      intent: "gaming",
      confidence: 1.0,
    });
    assert.ok(entertainmentScore < 20, `Expected entertainment score < 20, got ${entertainmentScore}`);
  });

  test("updateSmoothMetricState exponential smoothing", () => {
    const initial: SmoothMetricState = {
      focusScore: 50,
      productivityScore: 50,
      deepWorkScore: 50,
      burnoutScore: 50,
    };

    const productiveActivity: ActivityMetricInput = {
      appName: "Cursor",
      category: "deep_work",
      intent: "coding",
      durationMs: 30 * 60 * 1000,
    };

    const nextState = updateSmoothMetricState(initial, productiveActivity);

    assert.ok(nextState.focusScore > initial.focusScore, "Focus score should rise during deep work");
    assert.ok(nextState.productivityScore > initial.productivityScore, "Productivity score should rise during deep work");
    assert.ok(nextState.deepWorkScore > initial.deepWorkScore, "Deep work score should rise");
    assert.ok(nextState.burnoutScore < initial.burnoutScore, "Burnout score should decrease during productive focus");
  });

  test("updateSmoothMetricState distraction decay", () => {
    const initial: SmoothMetricState = {
      focusScore: 80,
      productivityScore: 80,
      deepWorkScore: 80,
      burnoutScore: 30,
    };

    const distractingActivity: ActivityMetricInput = {
      appName: "YouTube",
      category: "entertainment",
      intent: "streaming_video",
      durationMs: 15 * 60 * 1000,
    };

    const nextState = updateSmoothMetricState(initial, distractingActivity);

    assert.ok(nextState.focusScore < initial.focusScore, "Focus score should rapidly decay during distraction");
    assert.ok(nextState.productivityScore < initial.productivityScore, "Productivity score should decay");
    assert.ok(nextState.burnoutScore > initial.burnoutScore, "Burnout score should rise during distraction");
  });
});
