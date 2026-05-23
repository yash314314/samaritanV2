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
  unknown: 45
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
  unknown: 45
};
  
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

  return categoryFocusDefaults[a.category ?? ""] ?? 0.5;
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

  return clamp(rawScore * confidence + 45 * (1 - confidence));
}