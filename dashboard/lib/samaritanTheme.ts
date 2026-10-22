// Samaritan tokens for code that cannot use utility classes (charts, inline
// styles). Each value is a CSS variable written by the appearance settings,
// so these strings follow the chosen theme without re-rendering.
import { CATEGORIES, categoryColor } from "./appearance";

export const SAM = {
  void: "var(--sam-void)",
  signal: "var(--sam-signal)",
  trace: "var(--sam-trace)",
  key: "var(--sam-key)",
  dim: "var(--sam-dim)",
  grid: "var(--sam-grid)",
  track: "var(--sam-track)",
  accent: "var(--sam-accent)",
  alert: "var(--sam-alert)",
} as const;

export const SAM_CATEGORY_ORDER = CATEGORIES;

export const DISTRACTION_CATEGORIES = new Set(["media", "entertainment"]);

export function categoryTone(category?: string | null) {
  return categoryColor(category);
}

// 0-100 score to a shade between the track and signal ink.
export function scoreLuminance(score: number) {
  const share = Math.round(12 + (Math.max(0, Math.min(100, score)) / 100) * 88);
  return `color-mix(in srgb, var(--sam-signal) ${share}%, var(--sam-void))`;
}

// Below this a focus/productivity reading is flagged with the alert colour.
export const ALERT_THRESHOLD = 25;
