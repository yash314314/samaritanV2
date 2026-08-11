export const clamp = (value: number, min = 0, max = 100) =>
    Math.min(max, Math.max(min, value));
  
  export const clamp01 = (value: number) =>
    Math.min(1, Math.max(0, value));
  
export type ActivityMetricInput = {
  appName: string;
  type?: string | null;
  category?: string | null;
  intent?: string | null;
  focusImpact?: number | null;
  confidence?: number | null;
  duration?: number | null;
  durationMs?: number | null;
};

const categoryFocusDefaults: Record<string, number> = {
  deep_work: 0.9,
  development_tools: 0.7,
  productivity: 0.7,
  research: 0.65,
  communication: 0.4,
  media: 0.2,
  entertainment: 0.1,
  system: 0.15
};

const categoryProductivityDefaults: Record<string, number> = {
  deep_work: 92,
  development_tools: 78,
  productivity: 74,
  research: 68,
  communication: 42,
  system: 20,
  media: 18,
  entertainment: 8,
  idle: 0,
  unknown: 20
};

const intentProductivityDefaults: Record<string, number> = {
  coding: 94,
  debugging: 90,
  api_testing: 84,
  analysis: 84,
  geophysics: 84,
  thinking: 82,
  documentation: 78,
  planning: 76,
  notes: 72,
  reading: 62,
  containers: 60,
  version_control: 58,
  runtime: 52,
  local_server: 52,
  python_environment: 52,
  remote_work: 50,
  chat: 38,
  social_media: 12,
  video: 12,
  streaming_video: 8,
  video_streaming: 8,
  music: 35,
  gaming: 4,
  file_management: 28,
  media_processing: 26,
  idle: 0,
  unknown: 20
};

export type SmoothMetricState = {
  focusScore: number;
  productivityScore: number;
  deepWorkScore: number;
  burnoutScore: number;
};

const FOCUS_RISE_TAU_MS = 45 * 60 * 1000;
const PRODUCTIVITY_RISE_TAU_MS = 60 * 60 * 1000;
const DISTRACTION_DECAY_TAU_MS = 90 * 1000;
const IDLE_DECAY_TAU_MS = 12 * 60 * 1000;
const DEEP_WORK_RISE_TAU_MS = 15 * 60 * 1000;
const BURNOUT_RISE_TAU_MS = 4 * 60 * 60 * 1000;
  
  export function isIdleActivity(a: ActivityMetricInput) {
    return (
      a.type === "idle" ||
      a.appName === "System Idle" ||
      a.category === "idle"
    );
  }
  
export function getBaseFocus(a: ActivityMetricInput) {
  if (a.focusImpact !== null && a.focusImpact !== undefined) {
    return clamp01(a.focusImpact);
  }

  return categoryFocusDefaults[a.category ?? ""] ?? 0.25;
}

export function getActivityProductivityScore(a: ActivityMetricInput) {
  if (isIdleActivity(a)) return 0;

  const category = a.category ?? "unknown";
  const intent = a.intent ?? "unknown";

  const categoryScore =
    categoryProductivityDefaults[category] ??
    categoryProductivityDefaults.unknown;

  const intentScore =
    intentProductivityDefaults[intent] ??
    (intent.includes("streaming")
      ? intentProductivityDefaults.video_streaming
      : intentProductivityDefaults.unknown);

  const focusScore = getBaseFocus(a) * 100;

  const rawScore =
    categoryScore * 0.55 +
    intentScore * 0.25 +
    focusScore * 0.2;

  const confidence = clamp01(a.confidence ?? 0.8);

  return clamp(rawScore * confidence + 20 * (1 - confidence));
}

function getDurationMs(activity: ActivityMetricInput) {
  return Math.max(0, activity.durationMs ?? activity.duration ?? 0);
}

function approach(current: number, target: number, durationMs: number, tauMs: number) {
  if (durationMs <= 0) return current;
  const alpha = 1 - Math.exp(-durationMs / tauMs);
  return current + (target - current) * alpha;
}

function decay(current: number, durationMs: number, tauMs: number) {
  if (durationMs <= 0) return current;
  return current * Math.exp(-durationMs / tauMs);
}

export function updateSmoothMetricState(
  state: SmoothMetricState,
  activity: ActivityMetricInput
): SmoothMetricState {
  const durationMs = getDurationMs(activity);
  if (durationMs <= 0) return state;

  let focusScore = state.focusScore;
  let productivityScore = state.productivityScore;
  let deepWorkScore = state.deepWorkScore;
  let burnoutScore = state.burnoutScore;

  if (isIdleActivity(activity)) {
    focusScore = decay(focusScore, durationMs, IDLE_DECAY_TAU_MS);
    productivityScore = decay(productivityScore, durationMs, IDLE_DECAY_TAU_MS);
    deepWorkScore = decay(deepWorkScore, durationMs, IDLE_DECAY_TAU_MS);
    burnoutScore = decay(burnoutScore, durationMs, BURNOUT_RISE_TAU_MS);
    return {
      focusScore: clamp(focusScore),
      productivityScore: clamp(productivityScore),
      deepWorkScore: clamp(deepWorkScore),
      burnoutScore: clamp(burnoutScore),
    };
  }

  const category = activity.category ?? "unknown";
  const targetFocus = getBaseFocus(activity) * 100;
  const targetProductivity = getActivityProductivityScore(activity);
  const isProductive =
    category === "deep_work" ||
    category === "development_tools" ||
    category === "productivity" ||
    category === "research";
  const isDistracting =
    category === "entertainment" ||
    category === "media" ||
    (activity.intent ?? "").includes("social_media") ||
    (activity.intent ?? "").includes("streaming") ||
    activity.intent === "gaming";

  if (isDistracting) {
    focusScore = decay(focusScore, durationMs, DISTRACTION_DECAY_TAU_MS);
    productivityScore = decay(productivityScore, durationMs, DISTRACTION_DECAY_TAU_MS);
    deepWorkScore = decay(deepWorkScore, durationMs, DISTRACTION_DECAY_TAU_MS);
    burnoutScore = approach(burnoutScore, 75, durationMs, BURNOUT_RISE_TAU_MS);
  } else if (isProductive) {
    focusScore = approach(focusScore, targetFocus, durationMs, FOCUS_RISE_TAU_MS);
    productivityScore = approach(productivityScore, targetProductivity, durationMs, PRODUCTIVITY_RISE_TAU_MS);
    deepWorkScore = approach(
      deepWorkScore,
      category === "deep_work" ? 100 : category === "development_tools" ? 70 : 45,
      durationMs,
      DEEP_WORK_RISE_TAU_MS
    );
    burnoutScore = approach(burnoutScore, 25, durationMs, BURNOUT_RISE_TAU_MS);
  } else {
    focusScore = approach(focusScore, targetFocus, durationMs, FOCUS_RISE_TAU_MS * 1.5);
    productivityScore = approach(productivityScore, targetProductivity, durationMs, PRODUCTIVITY_RISE_TAU_MS * 1.5);
    deepWorkScore = decay(deepWorkScore, durationMs, IDLE_DECAY_TAU_MS);
    burnoutScore = approach(burnoutScore, 35, durationMs, BURNOUT_RISE_TAU_MS);
  }

  return {
    focusScore: clamp(focusScore),
    productivityScore: clamp(productivityScore),
    deepWorkScore: clamp(deepWorkScore),
    burnoutScore: clamp(burnoutScore),
  };
}
