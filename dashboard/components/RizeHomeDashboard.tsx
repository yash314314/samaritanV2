"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCheck,
  Coffee,
  Clock3,
  Flame,
  Gauge,
  Layers3,
  ListChecks,
  Loader2,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import FocusTrendChart from "@/components/FocusTrendChart";
import HeatmapGrid from "@/components/HeatmapGrid";
import MetricsPanel from "@/components/MetricsPanel";
import Timeline from "@/components/Timeline";
import { reviewActivityEntries, type ActivityReview } from "@/lib/api";

const REVIEW_CATEGORIES = [
  { value: "deep_work", label: "Deep work", intent: "coding", focus: 90 },
  { value: "development_tools", label: "Development", intent: "runtime", focus: 70 },
  { value: "productivity", label: "Productivity", intent: "planning", focus: 70 },
  { value: "research", label: "Research", intent: "reading", focus: 65 },
  { value: "communication", label: "Communication", intent: "chat", focus: 40 },
  { value: "media", label: "Media", intent: "video", focus: 20 },
  { value: "entertainment", label: "Entertainment", intent: "gaming", focus: 10 },
  { value: "system", label: "System", intent: "utility", focus: 15 },
  { value: "idle", label: "Idle", intent: "idle", focus: 0 },
] as const;

const REVIEW_INTENTS = [
  "coding", "debugging", "api_testing", "analysis", "thinking",
  "documentation", "planning", "notes", "reading", "email", "chat",
  "remote_work", "social_media", "video", "streaming_video", "music",
  "gaming", "file_management", "utility", "idle",
];

type ReviewDraft = {
  category: string;
  intent: string;
  focusImpact: number;
  remember: boolean;
};

type RizeHomeDashboardProps = {
  userId: string;
  date: string;
  daily: any;
  heatmap: any;
  timeline: any[];
  focusTrend: any[];
  focusBucketMinutes: number;
  onFocusBucketMinutesChange: (minutes: number) => void;
  focusTrendLoading: boolean;
};

function formatDuration(secondsOrMs: any) {
  const value = Number(secondsOrMs ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0m";
  const ms = value > 100000 ? value : value * 1000;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function score(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function entryKey(entry: any) {
  return `${entry.start ?? ""}:${entry.appName ?? ""}:${entry.duration ?? 0}`;
}

function getLatestTitle(entry: any) {
  return entry?.items?.at?.(-1)?.title ?? entry?.items?.[0]?.title ?? "Untitled activity";
}

function getLatestEntry(timeline: any[]) {
  return [...(timeline ?? [])].sort(
    (a, b) => new Date(b.end ?? b.start).getTime() - new Date(a.end ?? a.start).getTime()
  )[0];
}

function getEntryFocus(entry: any) {
  return score(entry?.focus ?? entry?.focusScore ?? entry?.averageFocusScore ?? entry?.score);
}

function getEntryProductivity(entry: any) {
  return score(entry?.productivity ?? entry?.productivityScore ?? entry?.averageProductivityScore ?? entry?.score);
}

function formatTimeRange(entry: any) {
  const start = entry?.start ? new Date(entry.start) : null;
  const end = entry?.end ? new Date(entry.end) : null;
  if (!start || Number.isNaN(start.getTime())) return "Unknown time";

  const startText = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!end || Number.isNaN(end.getTime())) return startText;

  return `${startText} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function summarizeEntryGroup(entries: any[]) {
  const duration = entries.reduce((sum, entry) => sum + Number(entry?.duration ?? 0), 0);
  const weightedFocus = entries.reduce((sum, entry) => sum + getEntryFocus(entry) * Number(entry?.duration ?? 0), 0);
  const weightedProductivity = entries.reduce((sum, entry) => sum + getEntryProductivity(entry) * Number(entry?.duration ?? 0), 0);

  return {
    duration,
    focus: duration > 0 ? weightedFocus / duration : 0,
    productivity: duration > 0 ? weightedProductivity / duration : 0,
  };
}

function focusTone(value: number) {
  if (value >= 75) return "#22c55e";
  if (value >= 50) return "#a855f7";
  if (value >= 25) return "#f59e0b";
  return "#52525b";
}

function getDailyRecovery(daily: any) {
  if (daily?.recovery) return daily.recovery;

  const focus = score(daily?.averageFocusScore);
  const burnout = score(daily?.averageBurnoutScore);
  const entropy = score(daily?.averageEntropyScore);
  const activeSeconds = Number(daily?.totalActiveSeconds ?? 0);
  const idleSeconds = Number(daily?.totalIdleSeconds ?? 0);
  const trackedSeconds = activeSeconds + idleSeconds;
  const idleRatio = trackedSeconds > 0 ? idleSeconds / trackedSeconds : 0;
  const switchesPerHour = activeSeconds > 0
    ? Number(daily?.totalSwitches ?? 0) / (activeSeconds / 3600)
    : 0;
  const breakBalance = trackedSeconds < 900
    ? 0
    : idleRatio < 0.15
      ? Math.min(100, (idleRatio / 0.15) * 100)
      : idleRatio <= 0.3
        ? 100
        : Math.max(20, 100 - ((idleRatio - 0.3) / 0.5) * 80);
  const strainReserve = 100 - burnout;
  const stability = 100 - entropy;
  const switchControl = Math.max(0, Math.min(100, 100 - ((switchesPerHour - 8) / 22) * 100));
  const recoveryScore = trackedSeconds < 900
    ? 0
    : strainReserve * 0.3 + stability * 0.2 + focus * 0.2 + breakBalance * 0.15 + switchControl * 0.15;
  const status = trackedSeconds < 900
    ? "Building baseline"
    : recoveryScore >= 75
      ? "Ready"
      : recoveryScore >= 55
        ? "Balanced"
        : recoveryScore >= 35
          ? "Recovery due"
          : "Overextended";

  return {
    score: recoveryScore,
    status,
    action: trackedSeconds < 900
      ? "Keep tracking to establish today's baseline."
      : "Pace is sustainable. Keep the next block intentional.",
    factors: { breakBalance, strainReserve, stability, switchControl },
    idleRatio: idleRatio * 100,
    switchesPerHour,
  };
}

function recoveryTone(value: number) {
  if (value >= 75) return { text: "text-emerald-400", bar: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400" };
  if (value >= 55) return { text: "text-purple-300", bar: "bg-purple-500", badge: "bg-purple-500/10 text-purple-300" };
  if (value >= 35) return { text: "text-amber-400", bar: "bg-amber-400", badge: "bg-amber-500/10 text-amber-400" };
  return { text: "text-red-400", bar: "bg-red-400", badge: "bg-red-500/10 text-red-400" };
}

function summarizeCategories(timeline: any[]) {
  const totals = new Map<string, any[]>();

  for (const entry of timeline) {
    const category = entry?.category ?? "unknown";
    totals.set(category, [...(totals.get(category) ?? []), entry]);
  }

  const total = [...totals.values()]
    .flat()
    .reduce((sum, entry) => sum + Number(entry?.duration ?? 0), 0);

  return [...totals.entries()]
    .map(([name, entries]) => {
      const summary = summarizeEntryGroup(entries);
      return {
        name,
        ...summary,
        sessions: entries.sort((a, b) => Number(b?.duration ?? 0) - Number(a?.duration ?? 0)),
        percent: total > 0 ? (summary.duration / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.duration - a.duration);
}

function summarizeApps(timeline: any[]) {
  const totals = new Map<string, { duration: number; switches: number }>();

  for (const entry of timeline) {
    const name = entry?.appName ?? "Unknown";
    const current = totals.get(name) ?? { duration: 0, switches: 0 };
    current.duration += Number(entry?.duration ?? 0);
    current.switches += 1;
    totals.set(name, current);
  }

  return [...totals.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.duration - a.duration);
}

function needsReview(entry: any) {
  const category = String(entry?.category ?? "").toLowerCase();
  const intent = String(entry?.intent ?? "").toLowerCase();
  const confidence = Number(entry?.confidence ?? 0);
  return (
    !category ||
    category === "unknown" ||
    !intent ||
    intent === "unknown" ||
    confidence < 0.75
  );
}

function createReviewDraft(entry: any): ReviewDraft {
  const category = REVIEW_CATEGORIES.some((option) => option.value === entry?.category)
    ? String(entry.category)
    : "";
  const categoryOption = REVIEW_CATEGORIES.find((option) => option.value === category);
  const rawFocus = Number(entry?.focusImpact);

  return {
    category,
    intent: entry?.intent && entry.intent !== "unknown"
      ? String(entry.intent)
      : categoryOption?.intent ?? "",
    focusImpact: Number.isFinite(rawFocus)
      ? Math.round(Math.max(0, Math.min(1, rawFocus)) * 100)
      : categoryOption?.focus ?? 25,
    remember: true,
  };
}

function getActivityIds(entry: any) {
  const ids = Array.isArray(entry?.activityIds)
    ? entry.activityIds
    : (entry?.items ?? []).map((item: any) => item?.id);
  return [...new Set(ids.filter(Boolean))] as string[];
}

function SmallMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
      <div className="text-[10px] uppercase text-zinc-600">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon: any;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-purple-400" />
          <h2 className="truncate text-sm font-semibold text-zinc-200">{title}</h2>
        </div>
        {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export default function RizeHomeDashboard({
  userId,
  date,
  daily,
  heatmap,
  timeline,
  focusTrend,
  focusBucketMinutes,
  onFocusBucketMinutesChange,
  focusTrendLoading,
}: RizeHomeDashboardProps) {
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [selectedInterrupter, setSelectedInterrupter] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setReviewed([]);
    setReviewError(null);
  }, [date]);

  const categories = useMemo(() => summarizeCategories(timeline ?? []), [timeline]);
  const apps = useMemo(() => summarizeApps(timeline ?? []), [timeline]);
  const entriesByApp = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const entry of timeline ?? []) {
      const name = entry?.appName ?? "Unknown";
      map.set(name, [...(map.get(name) ?? []), entry]);
    }
    return map;
  }, [timeline]);
  const pendingEntries = useMemo(
    () =>
      [...(timeline ?? [])]
        .filter((entry) => needsReview(entry) && !reviewed.includes(entryKey(entry)))
        .sort((a, b) => new Date(b.end ?? b.start).getTime() - new Date(a.end ?? a.start).getTime()),
    [timeline, reviewed]
  );

  useEffect(() => {
    setReviewDrafts((previous) => {
      const next = { ...previous };
      for (const entry of pendingEntries) {
        const key = entryKey(entry);
        if (!next[key]) next[key] = createReviewDraft(entry);
      }
      return next;
    });
  }, [pendingEntries]);

  const updateReviewDraft = (key: string, patch: Partial<ReviewDraft>) => {
    setReviewDrafts((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...patch },
    }));
  };

  const changeReviewCategory = (key: string, category: string) => {
    const option = REVIEW_CATEGORIES.find((item) => item.value === category);
    updateReviewDraft(key, {
      category,
      intent: option?.intent ?? "",
      focusImpact: option?.focus ?? 25,
    });
  };

  const buildReview = (entry: any): ActivityReview | null => {
    const draft = reviewDrafts[entryKey(entry)] ?? createReviewDraft(entry);
    const activityIds = getActivityIds(entry);
    if (!draft?.category || !draft.intent || activityIds.length === 0) return null;
    return {
      activityIds,
      category: draft.category,
      intent: draft.intent,
      focusImpact: draft.focusImpact / 100,
      remember: draft.remember,
    };
  };

  const approveEntries = async (entries: any[], operationKey: string) => {
    const reviews = entries.map(buildReview);
    if (reviews.some((review) => !review)) {
      setReviewError("Choose a category and intent for every entry before approval.");
      return;
    }

    setReviewing(operationKey);
    setReviewError(null);
    try {
      const validReviews = reviews as ActivityReview[];
      for (let index = 0; index < validReviews.length; index += 100) {
        await reviewActivityEntries(userId, validReviews.slice(index, index + 100));
      }
      const keys = entries.map(entryKey);
      setReviewed((previous) => [...new Set([...previous, ...keys])]);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to save reviews.");
    } finally {
      setReviewing(null);
    }
  };

  const topCategory = categories[0];
  const distractionCategories = new Set(["media", "entertainment", "communication", "system", "unknown"]);
  const interrupters = apps
    .filter((app) =>
      (timeline ?? []).some(
        (entry) => entry?.appName === app.name && distractionCategories.has(String(entry?.category ?? "unknown"))
      )
    )
    .slice(0, 4);

  const activeSeconds = Number(daily?.totalActiveSeconds ?? 0);
  const focusScore = score(daily?.averageFocusScore);
  const deepWorkSessions = Number(daily?.deepWorkSessions ?? 0);
  const switchCount = Number(daily?.totalSwitches ?? 0);
  const recovery = useMemo(() => getDailyRecovery(daily), [daily]);
  const recoveryScore = score(recovery?.score);
  const recoveryColors = recoveryTone(recoveryScore);
  const recoveryFactors = [
    { label: "Recovery gaps", value: score(recovery?.factors?.breakBalance) },
    { label: "Strain reserve", value: score(recovery?.factors?.strainReserve) },
    { label: "Stability", value: score(recovery?.factors?.stability) },
    { label: "Switch control", value: score(recovery?.factors?.switchControl) },
  ];
  const isToday = date === new Date().toLocaleDateString("en-CA");
  const latestEntry = useMemo(() => getLatestEntry(timeline ?? []), [timeline]);
  const dayProgress = Math.max(
    0,
    Math.min(100, ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100)
  );
  const pulseBuckets = useMemo(() => {
    const buckets = Array.isArray(focusTrend) ? focusTrend : [];
    const active = buckets.filter((bucket: any) => Number(bucket?.duration ?? 0) > 0);
    const source = active.length > 0 ? active : buckets;
    return source.slice(-28).map((bucket: any) => ({
      label: bucket?.label ?? "--",
      focus: score(bucket?.focus ?? bucket?.averageFocus ?? bucket?.focusScore),
      duration: Number(bucket?.duration ?? 0),
    }));
  }, [focusTrend]);

  return (
    <div className="dashboard-surface grid grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="samaritan-card overflow-hidden p-4">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.9fr)_minmax(320px,0.85fr)]">
          <div className="min-w-0 rounded-lg bg-zinc-950/60 p-3 ring-1 ring-white/5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-purple-300">
                <Sparkles className="h-4 w-4" />
                Home Mission Control
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                <Clock3 className="h-3 w-3" />
                Last captured
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20">
                <Activity className="h-5 w-5 text-purple-300" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-[10px] uppercase text-zinc-600">
                  Last active app
                </div>
                <div className="truncate text-sm font-semibold text-zinc-100">
                  {latestEntry?.appName ?? "Waiting for activity"}
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500">
                  {latestEntry ? getLatestTitle(latestEntry) : "Automatic tracking is standing by."}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                  <span>{latestEntry ? formatTimeRange(latestEntry) : "No session yet"}</span>
                  <span>{pendingEntries.length} pending reviews</span>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Day progress
                </span>
                <span>{dayProgress.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-700"
                  style={{ width: `${dayProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-lg bg-zinc-950/60 p-3 ring-1 ring-white/5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-200">Focus Pulse</div>
                <div className="mt-0.5 text-[11px] text-zinc-600">
                  {focusTrendLoading ? "Syncing buckets" : `${pulseBuckets.length} recent buckets`}
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-500">
                <div>{topCategory?.name ?? "No category"}</div>
                <div className="mt-0.5 text-zinc-600">top allocation</div>
              </div>
            </div>
            <div className="flex h-20 items-end gap-1 overflow-hidden rounded-lg bg-black/40 p-2">
              {pulseBuckets.length > 0 ? (
                pulseBuckets.map((bucket: any, index: number) => (
                  <div
                    key={`${bucket.label}-${index}`}
                    title={`${bucket.label} focus ${bucket.focus.toFixed(0)}`}
                    className="min-w-[2px] flex-1 rounded-sm transition-all duration-500"
                    style={{
                      height: `${Math.max(10, bucket.focus)}%`,
                      backgroundColor: focusTone(bucket.focus),
                      opacity: bucket.duration > 0 ? 0.9 : 0.25,
                      animationDelay: `${index * 35}ms`,
                    }}
                  />
                ))
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                  Focus data will appear here.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SmallMetric label="Tracked" value={formatDuration(activeSeconds)} sub="automatic capture" />
            <SmallMetric label="Focus" value={focusScore.toFixed(0)} sub="quality score" />
            <SmallMetric label="Deep Work" value={deepWorkSessions} sub="sessions today" />
            <SmallMetric label="Switches" value={switchCount} sub="context changes" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-12 gap-4">
        <div className="col-span-12 min-h-0 xl:col-span-3">
          <MetricsPanel daily={daily} timeline={timeline} />
        </div>

        <div className="dashboard-scroll-panel col-span-12 grid min-h-0 min-w-0 auto-rows-min grid-cols-12 gap-4 pr-1 xl:col-span-9">
          <div className="col-span-12 grid min-h-0 min-w-0 gap-4 lg:grid-cols-3">
            <div className="samaritan-card dashboard-grid-card p-4">
              <SectionTitle
                icon={ListChecks}
                title="Pending Time Entries"
                sub={`${pendingEntries.length} classification${pendingEntries.length === 1 ? "" : "s"} to confirm`}
                action={pendingEntries.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => approveEntries(pendingEntries, "all")}
                    disabled={Boolean(reviewing)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-purple-500/20 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-medium text-purple-300 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reviewing === "all" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    Approve all
                  </button>
                ) : null}
              />

              {pendingEntries.length === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center rounded-lg bg-zinc-950/60 text-center">
                  <Check className="mb-2 h-5 w-5 text-emerald-400" />
                  <div className="text-sm font-medium text-zinc-200">All reviewed</div>
                  <div className="mt-1 text-xs text-zinc-500">New ambiguous entries will appear here.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {reviewError && (
                    <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
                      {reviewError}
                    </div>
                  )}
                  <div className="dashboard-scroll-panel max-h-72 space-y-2 pr-1">
                  {pendingEntries.map((entry) => {
                    const key = entryKey(entry);
                    const draft = reviewDrafts[key] ?? createReviewDraft(entry);
                    return (
                      <div key={key} className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-200">
                              {entry.appName ?? "Unknown"}
                            </div>
                            <div className="mt-1 truncate text-xs text-zinc-500">{getLatestTitle(entry)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => approveEntries([entry], key)}
                            disabled={Boolean(reviewing) || !draft.category || !draft.intent}
                            className="flex shrink-0 items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-300 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {reviewing === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Approve
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <select
                            aria-label={`Category for ${entry.appName ?? "activity"}`}
                            value={draft.category}
                            onChange={(event) => changeReviewCategory(key, event.target.value)}
                            className="min-w-0 rounded-md border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-purple-500/50"
                          >
                            <option value="">Choose category</option>
                            {REVIEW_CATEGORIES.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>

                          <select
                            aria-label={`Intent for ${entry.appName ?? "activity"}`}
                            value={draft.intent}
                            onChange={(event) => updateReviewDraft(key, { intent: event.target.value })}
                            className="min-w-0 rounded-md border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-purple-500/50"
                          >
                            <option value="">Choose intent</option>
                            {REVIEW_INTENTS.map((intent) => (
                              <option key={intent} value={intent}>{intent.replaceAll("_", " ")}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                            <span>Focus weight</span>
                            <span className="tabular-nums text-purple-300">{draft.focusImpact}%</span>
                          </div>
                          <input
                            aria-label={`Focus weight for ${entry.appName ?? "activity"}`}
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={draft.focusImpact}
                            onChange={(event) => updateReviewDraft(key, { focusImpact: Number(event.target.value) })}
                            className="h-1.5 w-full accent-purple-500"
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-600">
                          <label className="flex min-w-0 cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={draft.remember}
                              onChange={(event) => updateReviewDraft(key, { remember: event.target.checked })}
                              className="h-3.5 w-3.5 accent-purple-500"
                            />
                            <span className="truncate">Remember this context</span>
                          </label>
                          <span>{formatMs(Number(entry.duration ?? 0))}</span>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

            <div className="samaritan-card dashboard-grid-card p-4">
              <SectionTitle
                icon={Gauge}
                title="Daily Balance"
                sub={isToday ? "Continuously updated" : "Final balance for this day"}
                action={(
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${recoveryColors.badge}`}>
                    {recovery?.status ?? "Building baseline"}
                  </span>
                )}
              />

              <div
                className="border-y border-zinc-900 py-3"
                title="Weighted from strain reserve, stability, focus, recovery gaps, and switch control"
              >
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-600">Recovery balance</div>
                    <div className={`mt-1 text-3xl font-semibold tabular-nums ${recoveryColors.text}`}>
                      {recoveryScore.toFixed(0)}
                      <span className="ml-1 text-sm font-normal text-zinc-600">/100</span>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-zinc-600">
                    <div>{Number(recovery?.switchesPerHour ?? 0).toFixed(1)} switches/hr</div>
                    <div className="mt-1">{Number(recovery?.idleRatio ?? 0).toFixed(0)}% recovery gaps</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${recoveryColors.bar}`}
                    style={{ width: `${recoveryScore}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {recoveryFactors.map((factor) => (
                  <div key={factor.label} className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="truncate text-zinc-500">{factor.label}</span>
                      <span className="tabular-nums text-zinc-400">{factor.value.toFixed(0)}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all duration-700"
                        style={{ width: `${factor.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-start gap-2 border-t border-zinc-900 pt-3">
                <Coffee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  {recovery?.action ?? "Keep tracking to establish today's baseline."}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-zinc-600">
                <span className="truncate">Top: {topCategory?.name ?? "None"}</span>
                <Link href="/analytics" className="flex shrink-0 items-center gap-1 text-purple-300 hover:text-purple-200">
                  Details
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="samaritan-card dashboard-grid-card p-4">
              <SectionTitle icon={BarChart3} title="Dashboards" sub="Fast paths into analysis" />
              <div className="grid grid-cols-1 gap-2">
                {[
                  { href: "/analytics", label: "Productivity", icon: TrendingUp },
                  { href: "/heatmap", label: "Calendar Heatmap", icon: CalendarDays },
                  { href: "/focus", label: "Focus Sessions", icon: Shield },
                  { href: "/projects", label: "Projects", icon: Target },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg bg-zinc-950/70 px-3 py-2 text-sm text-zinc-300 ring-1 ring-white/5 transition hover:bg-zinc-900 hover:text-zinc-100"
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-purple-400" />
                      {item.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-600" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 min-w-0">
            <Timeline userId={userId} date={date} />
          </div>

          <div className="col-span-12 min-h-[340px] min-w-0">
            <FocusTrendChart
              data={focusTrend || []}
              bucketMinutes={focusBucketMinutes}
              onBucketMinutesChange={onFocusBucketMinutesChange}
              isLoading={focusTrendLoading}
            />
          </div>

          <div className="samaritan-card dashboard-scroll-panel col-span-12 p-4 xl:col-span-6">
            <SectionTitle icon={Layers3} title="Category Allocation" sub="Hover a category for session detail" />
            <div className="space-y-2">
              {categories.slice(0, 6).map((category) => (
                <div key={category.name} className="group rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                  <div className="mb-1 flex justify-between gap-3 text-xs">
                    <span className="truncate text-zinc-300">{category.name}</span>
                    <span className="shrink-0 text-zinc-500">{formatMs(category.duration)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-700"
                      style={{ width: `${Math.max(2, category.percent)}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
                    <span>{category.percent.toFixed(0)}% time</span>
                    <span>Focus {category.focus.toFixed(0)}</span>
                    <span>Prod {category.productivity.toFixed(0)}</span>
                  </div>
                  <div className="max-h-0 overflow-hidden transition-all duration-200 group-hover:mt-3 group-hover:max-h-44">
                    <div className="space-y-1.5 border-t border-zinc-800 pt-2">
                      {category.sessions.slice(0, 4).map((entry: any) => (
                        <div key={entryKey(entry)} className="rounded-md bg-black/50 p-2 text-[11px]">
                          <div className="flex justify-between gap-3">
                            <span className="truncate text-zinc-300">{entry.appName ?? "Unknown"}</span>
                            <span className="shrink-0 text-zinc-500">{formatMs(Number(entry.duration ?? 0))}</span>
                          </div>
                          <div className="mt-1 flex justify-between gap-3 text-zinc-600">
                            <span>{formatTimeRange(entry)}</span>
                            <span>F {getEntryFocus(entry).toFixed(0)} / P {getEntryProductivity(entry).toFixed(0)}</span>
                          </div>
                          <div className="mt-1 truncate text-zinc-600">{getLatestTitle(entry)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="rounded-lg bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
                  No category data yet.
                </div>
              )}
            </div>
          </div>

          <div className="samaritan-card dashboard-scroll-panel col-span-12 p-4 xl:col-span-6">
            <SectionTitle icon={Flame} title="Top Interrupters" sub="Click an app to inspect impact" />
            <div className="space-y-2">
              {interrupters.map((item, index) => {
                const appEntries = [...(entriesByApp.get(item.name) ?? [])].sort(
                  (a, b) => new Date(b.end ?? b.start).getTime() - new Date(a.end ?? a.start).getTime()
                );
                const appSummary = summarizeEntryGroup(appEntries);
                const active = selectedInterrupter === item.name;
                return (
                  <div
                    key={item.name}
                    className={`overflow-hidden rounded-lg ring-1 transition ${
                      active
                        ? "bg-purple-500/10 ring-purple-500/40"
                        : "bg-zinc-950/70 ring-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedInterrupter(active ? null : item.name)}
                      className="w-full p-3 text-left transition hover:bg-zinc-900/70"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-200">
                            {index + 1}. {item.name}
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-600">
                            {item.switches} appearances - Focus {appSummary.focus.toFixed(0)} - Prod {appSummary.productivity.toFixed(0)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-zinc-400">{formatMs(item.duration)}</div>
                          <div className="mt-1 text-[10px] text-zinc-600">{active ? "Hide" : "Details"}</div>
                        </div>
                      </div>
                    </button>

                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-purple-500/20 p-3">
                          <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded-md bg-black/40 p-2">
                              <div className="text-zinc-600">Sessions</div>
                              <div className="mt-1 font-semibold text-zinc-200">{appEntries.length}</div>
                            </div>
                            <div className="rounded-md bg-black/40 p-2">
                              <div className="text-zinc-600">Focus</div>
                              <div className="mt-1 font-semibold text-zinc-200">{appSummary.focus.toFixed(0)}</div>
                            </div>
                            <div className="rounded-md bg-black/40 p-2">
                              <div className="text-zinc-600">Productivity</div>
                              <div className="mt-1 font-semibold text-zinc-200">{appSummary.productivity.toFixed(0)}</div>
                            </div>
                          </div>

                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {appEntries.slice(0, 8).map((entry) => (
                              <div key={entryKey(entry)} className="rounded-md bg-black/50 p-2 text-[11px] ring-1 ring-white/5">
                                <div className="flex justify-between gap-3">
                                  <span className="truncate text-zinc-300">{formatTimeRange(entry)}</span>
                                  <span className="shrink-0 text-zinc-500">{formatMs(Number(entry.duration ?? 0))}</span>
                                </div>
                                <div className="mt-1 truncate text-zinc-600">{getLatestTitle(entry)}</div>
                                <div className="mt-1 flex justify-between gap-3 text-zinc-600">
                                  <span className="truncate">{entry.category ?? "unknown"} - {entry.intent ?? "unknown"}</span>
                                  <span className="shrink-0">F {getEntryFocus(entry).toFixed(0)} / P {getEntryProductivity(entry).toFixed(0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {interrupters.length === 0 && (
                <div className="rounded-lg bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
                  No interrupters detected today.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-relaxed text-zinc-500">
              Interrupter impact is calculated from the app's session duration, focus score, and productivity score.
            </div>
          </div>

          <div className="col-span-12 min-w-0">
            <HeatmapGrid data={heatmap} />
          </div>
        </div>
      </div>
    </div>
  );
}
