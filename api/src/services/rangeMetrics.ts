/**
 * Pure time-range metrics shared by every analytics endpoint.
 *
 * Activities are clipped to the requested range and overlaps are resolved so
 * each instant is attributed to exactly one activity:
 *   - idle wins over active (the tracker backdates idle to the last input while
 *     the foreground segment it closes runs until the idle was detected);
 *   - between two active segments the one that started later wins (the
 *     foreground switched to it).
 * Totals for a range therefore never exceed its wall-clock length and the sum
 * of per-day (or per-hour) slices equals the total for the whole range.
 */
import {
  getBaseFocus,
  isIdleActivity,
  type ActivityMetricInput,
} from "./metricEngine";
import {
  DAY_MS,
  addDaysToDateKey,
  getISTHour,
  istDayStart,
  nextISTHourBoundary,
  toISTDateKey,
} from "../utils/time";

export const PRODUCTIVE_CATEGORIES = new Set(["deep_work", "development_tools", "productivity", "research"]);
export const DISTRACTING_CATEGORIES = new Set(["media", "entertainment"]);
/** A day counts towards the deep-work streak once it holds this much deep_work time. */
export const DEEP_WORK_DAY_THRESHOLD_MS = 10 * 60 * 1000;
/** Deep-work activities separated by at most this gap form one focus block. */
export const FOCUS_BLOCK_MAX_GAP_MS = 2 * 60 * 1000;

export type RangeActivity = ActivityMetricInput & {
  id: string;
  sessionId: string;
  windowTitle?: string | null;
  energyImpact?: number | null;
  startTime: Date;
  endTime: Date;
  duration: number;
};

export type TimeSegment = { startMs: number; endMs: number };

export type EffectiveActivity<T extends RangeActivity = RangeActivity> = {
  activity: T;
  idle: boolean;
  /** Disjoint, ordered pieces of the activity that own their instants. */
  segments: TimeSegment[];
  ms: number;
  /** First and last owned instant. */
  startMs: number;
  endMs: number;
};

/** Recorded interval of an activity; `endTime` wins, `duration` covers rows without one. */
export function activityBounds(activity: Pick<RangeActivity, "startTime" | "endTime" | "duration">) {
  const startMs = activity.startTime.getTime();
  const endMs = activity.endTime.getTime() > startMs
    ? activity.endTime.getTime()
    : startMs + Math.max(0, activity.duration ?? 0);
  return { startMs, endMs };
}

type SweepItem<T extends RangeActivity> = {
  order: number;
  activity: T;
  idle: boolean;
  priorityStartMs: number;
  startMs: number;
  endMs: number;
  segments: TimeSegment[];
};

function outranks<T extends RangeActivity>(candidate: SweepItem<T>, current: SweepItem<T>) {
  if (candidate.idle !== current.idle) return candidate.idle;
  if (candidate.idle) {
    return candidate.priorityStartMs < current.priorityStartMs ||
      (candidate.priorityStartMs === current.priorityStartMs && candidate.order < current.order);
  }
  return candidate.priorityStartMs > current.priorityStartMs ||
    (candidate.priorityStartMs === current.priorityStartMs && candidate.order > current.order);
}

/**
 * Clip activities to [rangeStartMs, rangeEndMs) and resolve overlaps.
 * Activities that end up owning no time are dropped. Output is ordered by start.
 */
export function resolveActivityTime<T extends RangeActivity>(
  activities: T[],
  rangeStartMs: number,
  rangeEndMs: number
): EffectiveActivity<T>[] {
  const items: SweepItem<T>[] = [];
  activities.forEach((activity, order) => {
    const bounds = activityBounds(activity);
    const startMs = Math.max(bounds.startMs, rangeStartMs);
    const endMs = Math.min(bounds.endMs, rangeEndMs);
    if (endMs <= startMs) return;
    items.push({
      order,
      activity,
      idle: isIdleActivity(activity),
      priorityStartMs: bounds.startMs,
      startMs,
      endMs,
      segments: [],
    });
  });
  items.sort((left, right) => left.startMs - right.startMs || left.order - right.order);

  const boundaries = [...new Set(items.flatMap((item) => [item.startMs, item.endMs]))].sort((a, b) => a - b);
  const open: SweepItem<T>[] = [];
  let next = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStart = boundaries[index];
    const segmentEnd = boundaries[index + 1];
    while (next < items.length && items[next].startMs <= segmentStart) open.push(items[next++]);
    for (let position = open.length - 1; position >= 0; position -= 1) {
      if (open[position].endMs <= segmentStart) open.splice(position, 1);
    }
    if (open.length === 0) continue;

    let winner = open[0];
    for (let position = 1; position < open.length; position += 1) {
      if (outranks(open[position], winner)) winner = open[position];
    }
    const last = winner.segments[winner.segments.length - 1];
    if (last && last.endMs === segmentStart) last.endMs = segmentEnd;
    else winner.segments.push({ startMs: segmentStart, endMs: segmentEnd });
  }

  return items
    .filter((item) => item.segments.length > 0)
    .map((item) => toEffective(item.activity, item.idle, item.segments));
}

function toEffective<T extends RangeActivity>(activity: T, idle: boolean, segments: TimeSegment[]): EffectiveActivity<T> {
  return {
    activity,
    idle,
    segments,
    ms: segments.reduce((sum, segment) => sum + segment.endMs - segment.startMs, 0),
    startMs: segments[0].startMs,
    endMs: segments[segments.length - 1].endMs,
  };
}

/** Restrict already-resolved activities to a sub-range (e.g. one IST day or hour). */
export function sliceEffective<T extends RangeActivity>(
  items: EffectiveActivity<T>[],
  startMs: number,
  endMs: number
): EffectiveActivity<T>[] {
  const sliced: EffectiveActivity<T>[] = [];
  for (const item of items) {
    if (item.endMs <= startMs || item.startMs >= endMs) continue;
    const segments = item.segments
      .map((segment) => ({ startMs: Math.max(segment.startMs, startMs), endMs: Math.min(segment.endMs, endMs) }))
      .filter((segment) => segment.endMs > segment.startMs);
    if (segments.length) sliced.push(toEffective(item.activity, item.idle, segments));
  }
  return sliced;
}

export type ActivityTotals = {
  activeMs: number;
  idleMs: number;
  trackedMs: number;
  productiveMs: number;
  distractingMs: number;
  neutralMs: number;
  productiveCount: number;
  distractingCount: number;
  neutralCount: number;
  deepWorkMs: number;
  communicationMs: number;
  /** Σ baseFocus × ms over active time. */
  focusWeightedMs: number;
  /** Σ energyImpact × ms over tracked (active + idle) time. */
  energyWeightedMs: number;
  activeCount: number;
  switches: number;
  appUsage: Record<string, number>;
  categoryMs: Record<string, number>;
  intents: Record<string, { ms: number; focusWeightedMs: number }>;
};

export function summarizeActivities(items: EffectiveActivity[]): ActivityTotals {
  const totals: ActivityTotals = {
    activeMs: 0,
    idleMs: 0,
    trackedMs: 0,
    productiveMs: 0,
    distractingMs: 0,
    neutralMs: 0,
    productiveCount: 0,
    distractingCount: 0,
    neutralCount: 0,
    deepWorkMs: 0,
    communicationMs: 0,
    focusWeightedMs: 0,
    energyWeightedMs: 0,
    activeCount: 0,
    switches: 0,
    appUsage: {},
    categoryMs: {},
    intents: {},
  };
  const lastContextBySession = new Map<string, string>();

  for (const item of [...items].sort((left, right) => left.startMs - right.startMs)) {
    const { activity, ms } = item;
    if (ms <= 0) continue;
    totals.trackedMs += ms;
    totals.energyWeightedMs += (activity.energyImpact ?? 0) * ms;
    if (item.idle) {
      totals.idleMs += ms;
      continue;
    }

    const category = activity.category ?? "unknown";
    const intent = activity.intent ?? "unknown";
    const focus = getBaseFocus(activity);
    totals.activeMs += ms;
    totals.activeCount += 1;
    totals.focusWeightedMs += focus * ms;
    totals.appUsage[activity.appName] = (totals.appUsage[activity.appName] ?? 0) + ms;
    totals.categoryMs[category] = (totals.categoryMs[category] ?? 0) + ms;
    const intentTotals = totals.intents[intent] ?? { ms: 0, focusWeightedMs: 0 };
    intentTotals.ms += ms;
    intentTotals.focusWeightedMs += focus * ms;
    totals.intents[intent] = intentTotals;

    if (category === "deep_work") totals.deepWorkMs += ms;
    if (category === "communication") totals.communicationMs += ms;
    if (PRODUCTIVE_CATEGORIES.has(category)) {
      totals.productiveMs += ms;
      totals.productiveCount += 1;
    } else if (DISTRACTING_CATEGORIES.has(category)) {
      totals.distractingMs += ms;
      totals.distractingCount += 1;
    } else {
      totals.neutralMs += ms;
      totals.neutralCount += 1;
    }

    // Same switch definition as recalculateSessionMetrics: a change of
    // app + window title between consecutive active activities of a session.
    const context = `${activity.appName}::${activity.windowTitle ?? ""}`;
    const previous = lastContextBySession.get(activity.sessionId);
    if (previous !== undefined && previous !== context) totals.switches += 1;
    lastContextBySession.set(activity.sessionId, context);
  }

  return totals;
}

/** Duration-weighted base focus over active time, 0-100. */
export function focusScoreOf(totals: Pick<ActivityTotals, "activeMs" | "focusWeightedMs">) {
  return totals.activeMs > 0 ? (totals.focusWeightedMs / totals.activeMs) * 100 : 0;
}

/** Share of active time spent in productive categories, 0-100 (same as /analytics/daily). */
export function productivityScoreOf(totals: Pick<ActivityTotals, "activeMs" | "productiveMs">) {
  return totals.activeMs > 0 ? (totals.productiveMs / totals.activeMs) * 100 : 0;
}

/** Mean energy impact (-1..1) over tracked time; 0 when nothing was tracked. */
export function rawEnergyOf(totals: Pick<ActivityTotals, "trackedMs" | "energyWeightedMs">) {
  return totals.trackedMs > 0 ? totals.energyWeightedMs / totals.trackedMs : 0;
}

/** Energy on a 0-100 scale where 50 is neutral; 0 when nothing was tracked. */
export function energyScoreOf(totals: Pick<ActivityTotals, "trackedMs" | "energyWeightedMs">) {
  if (totals.trackedMs <= 0) return 0;
  return Math.min(100, Math.max(0, ((rawEnergyOf(totals) + 1) / 2) * 100));
}

/** Context switches per active minute. */
export function switchingRateOf(totals: Pick<ActivityTotals, "activeMs" | "switches">) {
  const minutes = totals.activeMs / 60000;
  return minutes > 0 ? totals.switches / minutes : 0;
}

// Switches per active minute -> 0-100. A soft curve rather than a hard cap:
// one switch a minute is ordinary multitasking (about 49), three or more
// reads as heavily fragmented (86+), and the score never pins at 100.
const FRAGMENTATION_SCALE = 1.5;

export function fragmentationScoreOf(switchingRate: number) {
  if (!Number.isFinite(switchingRate) || switchingRate <= 0) return 0;
  return 100 * (1 - Math.exp(-switchingRate / FRAGMENTATION_SCALE));
}

/**
 * Intent distribution over active time. Percentages sum to ~100; intents
 * that round to 0% are dropped. avgFocus is 0-100.
 */
export function intentDistribution(totals: Pick<ActivityTotals, "activeMs" | "intents">) {
  if (totals.activeMs <= 0) return [];
  return Object.entries(totals.intents)
    .filter(([, value]) => value.ms > 0)
    .map(([intent, value]) => ({
      intent,
      percentage: Number(((value.ms / totals.activeMs) * 100).toFixed(2)),
      avgFocus: Number(Math.min(100, Math.max(0, (value.focusWeightedMs / value.ms) * 100)).toFixed(2)),
    }))
    .filter((entry) => entry.percentage > 0)
    .sort((left, right) => right.percentage - left.percentage);
}

/** Split resolved activities into IST calendar days within [startMs, endMs). */
export function splitByISTDay<T extends RangeActivity>(items: EffectiveActivity<T>[], fromKey: string, toKey: string) {
  const days = new Map<string, EffectiveActivity<T>[]>();
  for (let key = fromKey; key <= toKey; key = addDaysToDateKey(key, 1)) {
    const dayStart = istDayStart(key).getTime();
    days.set(key, sliceEffective(items, dayStart, dayStart + DAY_MS));
  }
  return days;
}

/** Time per IST hour-of-day (0-23) for the given predicate. */
export function msByISTHour(items: EffectiveActivity[], include: (item: EffectiveActivity) => boolean) {
  const hours = new Array<number>(24).fill(0);
  for (const item of items) {
    if (!include(item)) continue;
    for (const segment of item.segments) {
      let cursor = segment.startMs;
      while (cursor < segment.endMs) {
        const boundary = Math.min(nextISTHourBoundary(cursor), segment.endMs);
        hours[getISTHour(cursor)] += boundary - cursor;
        cursor = boundary;
      }
    }
  }
  return hours;
}

/** IST hour-of-day with the most productive time, or null when there is none. */
export function peakProductiveHourOf(items: EffectiveActivity[]): number | null {
  const hours = msByISTHour(items, (item) => !item.idle && PRODUCTIVE_CATEGORIES.has(item.activity.category ?? ""));
  let peak: number | null = null;
  hours.forEach((ms, hour) => {
    if (ms > 0 && (peak === null || ms > hours[peak])) peak = hour;
  });
  return peak;
}

export type FocusBlock = { start: Date; end: Date; duration: number };

/**
 * Contiguous deep_work runs. A run ends at any other owned time (including
 * idle) or at a gap longer than `maxGapMs`. `duration` is owned time in ms.
 */
export function detectDeepWorkBlocks(items: EffectiveActivity[], maxGapMs = FOCUS_BLOCK_MAX_GAP_MS): FocusBlock[] {
  const pieces = items
    .flatMap((item) => item.segments.map((segment) => ({
      ...segment,
      deepWork: !item.idle && item.activity.category === "deep_work",
    })))
    .sort((left, right) => left.startMs - right.startMs);

  const blocks: FocusBlock[] = [];
  let current: { startMs: number; endMs: number; ms: number } | null = null;
  const flush = () => {
    if (current) blocks.push({ start: new Date(current.startMs), end: new Date(current.endMs), duration: current.ms });
    current = null;
  };

  for (const piece of pieces) {
    if (!piece.deepWork) {
      flush();
      continue;
    }
    if (current && piece.startMs - current.endMs <= maxGapMs) {
      current.endMs = Math.max(current.endMs, piece.endMs);
      current.ms += piece.endMs - piece.startMs;
    } else {
      flush();
      current = { startMs: piece.startMs, endMs: piece.endMs, ms: piece.endMs - piece.startMs };
    }
  }
  flush();
  return blocks;
}

/** Active time per session (used to weight session-level scores). */
export function activeMsBySession(items: EffectiveActivity[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.idle) continue;
    totals.set(item.activity.sessionId, (totals.get(item.activity.sessionId) ?? 0) + item.ms);
  }
  return totals;
}

export type StreakResult = { current: number; longest: number };

/**
 * Deep-work streak over IST days. A day qualifies with at least
 * DEEP_WORK_DAY_THRESHOLD_MS of deep_work time. The current streak ends on
 * `todayKey`, or on the day before while today has not qualified yet.
 */
// `inProgress` is true when todayKey is the current day: it may still qualify,
// so the streak counts back from yesterday. A finished day gets no grace.
export function deepWorkStreak(deepWorkMsByDay: Map<string, number>, todayKey: string, inProgress = true): StreakResult {
  const qualifying = [...deepWorkMsByDay.entries()]
    .filter(([key, ms]) => key <= todayKey && ms >= DEEP_WORK_DAY_THRESHOLD_MS)
    .map(([key]) => key)
    .sort();
  const set = new Set(qualifying);

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of qualifying) {
    run = previous !== null && addDaysToDateKey(previous, 1) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }

  let cursor = set.has(todayKey) || !inProgress ? todayKey : addDaysToDateKey(todayKey, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }
  return { current, longest };
}

/** deep_work time per IST day for streak computation. */
export function deepWorkMsByISTDay(items: EffectiveActivity[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.idle || item.activity.category !== "deep_work") continue;
    for (const segment of item.segments) {
      let cursor = segment.startMs;
      while (cursor < segment.endMs) {
        const key = toISTDateKey(cursor);
        const dayEnd = istDayStart(key).getTime() + DAY_MS;
        const pieceEnd = Math.min(dayEnd, segment.endMs);
        totals.set(key, (totals.get(key) ?? 0) + pieceEnd - cursor);
        cursor = pieceEnd;
      }
    }
  }
  return totals;
}
