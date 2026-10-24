import { createContext, useContext } from "react";
import { BOOT_ATTRIBUTE } from "./motionBoot";

// Motion runs on route entry only: the page title decodes, panels acquire and
// numerals resolve while a visit is this young. Later mounts (data refreshes,
// WebSocket updates) render in their final state.
export const ROUTE_ENTRY_WINDOW_MS = 1200;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export type RouteVisit = {
  path: string;
  // performance.now() when the visit's first effect ran; -Infinity when the
  // visit must not animate (the prerendered page was already on screen).
  startedAt: number | null;
  // Mount-time animations already played in this visit, so a remount does
  // not replay them.
  played: Set<string>;
};

export const RouteVisitContext = createContext<RouteVisit | null>(null);

export function useRouteVisit() {
  return useContext(RouteVisitContext);
}

export function createRouteVisit(path: string): RouteVisit {
  return { path, startedAt: null, played: new Set() };
}

let firstVisitPending = true;

// Milliseconds since the visit started. Call from effects only: the first
// call stamps the visit.
export function routeVisitAge(visit: RouteVisit | null): number {
  if (!visit) return Infinity;
  if (visit.startedAt === null) {
    // The first visit of a document only animates if the boot script is
    // still hiding the prerendered page; otherwise it was already seen.
    const hidden = document.documentElement.hasAttribute(BOOT_ATTRIBUTE);
    visit.startedAt = firstVisitPending && !hidden ? -Infinity : performance.now();
    firstVisitPending = false;
  }
  return performance.now() - visit.startedAt;
}

export function endBoot() {
  document.documentElement.removeAttribute(BOOT_ATTRIBUTE);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION).matches;
}

// Glyphs Samaritan cycles through while a value resolves. Every character
// exists in both Samaritan faces.
export const DECODE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/";
const DIGITS = "0123456789";

export function randomGlyph(set = DECODE_GLYPHS) {
  return set[Math.floor(Math.random() * set.length)];
}

export function randomDigit() {
  return randomGlyph(DIGITS);
}
