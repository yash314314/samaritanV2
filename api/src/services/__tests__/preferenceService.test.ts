import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { PreferenceValidationError, sanitizeAppearance } from "../preferenceService";

describe("sanitizeAppearance", () => {
  test("accepts known keys with slug values", () => {
    assert.deepEqual(
      sanitizeAppearance({ theme: "samaritan-dark", accent: "red", palette: "spectrum", font: "geist-mono" }),
      { theme: "samaritan-dark", accent: "red", palette: "spectrum", font: "geist-mono" }
    );
  });

  test("accepts a partial object", () => {
    assert.deepEqual(sanitizeAppearance({ font: "system" }), { font: "system" });
  });

  test("rejects unknown keys, non-slugs and non-objects", () => {
    assert.throws(() => sanitizeAppearance({ colour: "red" }), PreferenceValidationError);
    assert.throws(() => sanitizeAppearance({ theme: "Dark Mode" }), PreferenceValidationError);
    assert.throws(() => sanitizeAppearance({ theme: "<script>" }), PreferenceValidationError);
    assert.throws(() => sanitizeAppearance({ theme: 42 }), PreferenceValidationError);
    assert.throws(() => sanitizeAppearance(["dark"]), PreferenceValidationError);
    assert.throws(() => sanitizeAppearance(null), PreferenceValidationError);
  });
});
