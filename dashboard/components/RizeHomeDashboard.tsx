"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import FocusTrendChart from "@/components/FocusTrendChart";
import HeatmapGrid from "@/components/HeatmapGrid";
import LiveClock from "@/components/LiveClock";
import RecentActivity from "@/components/RecentActivity";
import SamaritanPrompt from "@/components/SamaritanPrompt";
import { Decode } from "@/components/sam/Decode";
import Timeline from "@/components/Timeline";
import { reviewActivityEntries, type ActivityReview } from "@/lib/api";
import { categoryTone } from "@/lib/samaritanTheme";
import { useCurrentActivity } from "@/lib/useWs";

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

// A live signal older than this means the tracker has gone quiet.
const LIVE_SIGNAL_MS = 3000;

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

function pad2(value: number) {
  return Math.round(value).toString().padStart(2, "0");
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
  const direct = entry?.focus ?? entry?.focusScore ?? entry?.averageFocusScore ?? entry?.score;
  if (direct !== null && direct !== undefined) return score(direct);
  const impact = Number(entry?.focusImpact);
  return Number.isFinite(impact) ? score(impact * 100) : 0;
}

function getEntryProductivity(entry: any) {
  return score(entry?.productivity ?? entry?.productivityScore ?? entry?.averageProductivityScore ?? entry?.score);
}

const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

function formatTimeRange(entry: any) {
  const start = entry?.start ? new Date(entry.start) : null;
  const end = entry?.end ? new Date(entry.end) : null;
  if (!start || Number.isNaN(start.getTime())) return "--:--";
  if (!end || Number.isNaN(end.getTime())) return clockFormat.format(start);
  return `${clockFormat.format(start)}–${clockFormat.format(end)}`;
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

// What Samaritan says about the day, in its own terse voice.
function assessDay(daily: any) {
  const focus = score(daily?.averageFocusScore);
  const burnout = score(daily?.averageBurnoutScore);
  const entropy = score(daily?.averageEntropyScore);
  const tracked = Number(daily?.totalActiveSeconds ?? 0) + Number(daily?.totalIdleSeconds ?? 0);

  if (tracked < 900) return ["BUILDING BASELINE"];
  if (burnout >= 70) return ["STRAIN DETECTED", "PROTECT RECOVERY"];
  if (entropy >= 70) return ["FRAGMENTED PATTERN", "BATCH SIMILAR WORK"];
  if (focus >= 75 && burnout < 45) return ["SUSTAINED FOCUS", "PRESERVE RHYTHM"];
  if (focus < 40) return ["LOW FOCUS", "START ONE BLOCK"];
  return ["PATTERN STABLE"];
}

function summarizeCategories(timeline: any[]) {
  const totals = new Map<string, any[]>();

  for (const entry of timeline) {
    const category = entry?.category ?? "unknown";
    totals.set(category, [...(totals.get(category) ?? []), entry]);
  }

  const groups = [...totals.entries()]
    .map(([name, entries]) => {
      const activities = entries
        .flatMap((entry) => {
          if (!Array.isArray(entry?.items) || entry.items.length === 0) return [entry];
          return entry.items.map((item: any) => ({
            ...item,
            appName: entry.appName,
            category: item.category ?? entry.category,
            intent: item.intent ?? entry.intent,
          }));
        })
        .sort((a, b) => new Date(b.end ?? b.start).getTime() - new Date(a.end ?? a.start).getTime());
      const summary = summarizeEntryGroup(activities);
      return {
        name,
        ...summary,
        sessions: entries.sort((a, b) => Number(b?.duration ?? 0) - Number(a?.duration ?? 0)),
        activities,
      };
    });
  const total = groups.reduce((sum, group) => sum + group.duration, 0);

  return groups
    .map((group) => ({
      ...group,
      percent: total > 0 ? (group.duration / total) * 100 : 0,
    }))
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

function categoryLabel(name: string) {
  return name.replaceAll("_", " ");
}

/* ---------------- READOUT PRIMITIVES ---------------- */

// `live` rows update continuously and skip the decode animation.
type ReadoutRow = { key: string; value: ReactNode; alert?: boolean; live?: boolean };

// Key/value table in the lock screen's SYSTEM PROFILE layout.
function Readout({ rows }: { rows: ReadoutRow[] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-8 gap-y-1.5">
      {rows.map((row) => (
        <Fragment key={row.key}>
          <dt className="sam-key leading-[18px]">{row.key}</dt>
          <dd className={`sam-value truncate leading-[18px] ${row.alert ? "text-alert" : ""}`}>
            {!row.live && (typeof row.value === "string" || typeof row.value === "number") ? <Decode value={row.value} /> : row.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function SectionHead({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <h2 className="sam-head">{title}</h2>
      {(meta || action) && (
        <div className="flex items-center gap-4">
          {meta && <span className="sam-key">{meta}</span>}
          {action}
        </div>
      )}
    </div>
  );
}

function Bar({ value, tone, alert }: { value: number; tone?: string; alert?: boolean }) {
  return (
    <div className="sam-bar" data-alert={alert ? "true" : undefined}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, ...(tone && !alert ? { background: tone } : {}) }} />
    </div>
  );
}

// Collapsible region that animates its height without measuring.
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="min-h-0 overflow-hidden">{children}</div>
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
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [selectedInterrupter, setSelectedInterrupter] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const liveActivity = useCurrentActivity();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
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
      setReviewError("Choose a category and an intent for every entry before approving.");
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
      setReviewError(error instanceof Error ? error.message : "Reviews could not be saved. Check that the API is running.");
    } finally {
      setReviewing(null);
    }
  };

  const distractionCategories = new Set(["media", "entertainment", "communication", "system", "unknown"]);
  const interrupters = apps
    .filter((app) =>
      (timeline ?? []).some(
        (entry) => entry?.appName === app.name && distractionCategories.has(String(entry?.category ?? "unknown"))
      )
    )
    .slice(0, 5);
  const interrupterMax = Math.max(1, ...interrupters.map((item) => item.duration));

  const activeSeconds = Number(daily?.totalActiveSeconds ?? 0);
  const focusScore = score(daily?.averageFocusScore);
  const burnoutScore = score(daily?.averageBurnoutScore);
  const entropyScore = score(daily?.averageEntropyScore);
  const recovery = useMemo(() => getDailyRecovery(daily), [daily]);
  const recoveryScore = score(recovery?.score);
  const recoveryAlert = recoveryScore < 35 && activeSeconds > 0;
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

  const observedAt = liveActivity?.observedAt ? new Date(liveActivity.observedAt).getTime() : 0;
  const isLive = Boolean(liveActivity && Number.isFinite(observedAt) && now.getTime() - observedAt <= LIVE_SIGNAL_MS);
  const liveApp = isLive ? liveActivity?.appName : null;
  const liveTitle = isLive ? liveActivity?.windowTitle || "Active window" : null;

  const assessment = useMemo(() => assessDay(daily), [daily]);
  const pendingCount = pendingEntries.length;
  const promptStatements = useMemo(
    () => [
      liveApp ? `OBSERVING [${liveApp}]` : "STANDBY",
      `FOCUS ${pad2(focusScore)}`,
      ...assessment,
      ...(pendingCount > 0 ? [`${pendingCount} UNCLASSIFIED`] : []),
    ],
    [liveApp, focusScore, assessment, pendingCount]
  );

  return (
    <div className="sam-ui dashboard-surface space-y-8">
      {/* ---------------- READOUT ---------------- */}
      <section className="grid items-start gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 className="sam-head">System time</h2>
          <LiveClock className="mt-3 text-[44px] leading-none" />
          <div className="mt-8">
            <Readout
              rows={[
                { key: "Status", value: isLive ? "Observing" : "Standby" },
                { key: "Day", value: isToday ? `${pad2(dayProgress)}% elapsed` : "Archive" },
                { key: "Last capture", value: latestEntry ? formatTimeRange(latestEntry) : "None yet", live: true },
              ]}
            />
          </div>
        </div>

        <div className="order-first min-w-0 py-4 sm:col-span-2 xl:order-none xl:col-span-1 xl:pt-10">
          <SamaritanPrompt
            statements={promptStatements}
            caption={liveTitle ?? (latestEntry ? `Last seen in ${latestEntry.appName}: ${getLatestTitle(latestEntry)}` : "Waiting for foreground activity")}
          />
        </div>

        <div className="min-w-0 xl:justify-self-end">
          <h2 className="sam-head">{isToday ? "Today" : date}</h2>
          <div className="mt-4">
            <Readout
              rows={[
                { key: "Tracked", value: formatDuration(activeSeconds) },
                { key: "Idle", value: formatDuration(daily?.totalIdleSeconds) },
                { key: "Focus", value: pad2(focusScore), alert: activeSeconds > 0 && focusScore < 25 },
                { key: "Burnout", value: pad2(burnoutScore), alert: burnoutScore >= 65 },
                { key: "Entropy", value: pad2(entropyScore), alert: entropyScore >= 65 },
                { key: "Switches", value: Number(daily?.totalSwitches ?? 0) },
                { key: "Deep work", value: Number(daily?.deepWorkSessions ?? 0) },
                { key: "Unclassified", value: pendingCount },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ---------------- TIMELINE ---------------- */}
      <div className="sam-rule pt-8">
        <Timeline userId={userId} date={date} />
      </div>

      {/* ---------------- FOCUS TREND ---------------- */}
      <div className="sam-rule pt-8">
        <FocusTrendChart
          data={focusTrend || []}
          bucketMinutes={focusBucketMinutes}
          onBucketMinutesChange={onFocusBucketMinutesChange}
          isLoading={focusTrendLoading}
        />
      </div>

      {/* ---------------- ALLOCATION / INTERRUPTERS / BALANCE ---------------- */}
      <section className="sam-rule grid gap-x-8 gap-y-8 pt-6 lg:grid-cols-3">
        <div className="min-w-0">
          <SectionHead title="Allocation" meta="Hover to preview, click to pin" />
          {categories.length === 0 ? (
            <p className="text-[12px] text-key">No categorised time for this day.</p>
          ) : (
            <ul className="space-y-5">
              {categories.slice(0, 6).map((category) => {
                const locked = lockedCategory === category.name;
                const open = locked || hoveredCategory === category.name;

                return (
                  <li
                    key={category.name}
                    onMouseEnter={() => setHoveredCategory(category.name)}
                    onMouseLeave={() => setHoveredCategory((current) => current === category.name ? null : current)}
                  >
                    <button
                      type="button"
                      onClick={() => setLockedCategory(locked ? null : category.name)}
                      aria-expanded={open}
                      className="block w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="sam-key truncate text-trace">{categoryLabel(category.name)}</span>
                        <span className="shrink-0 tabular-nums text-signal">
                          {formatMs(category.duration)}
                          <span className="ml-3 text-key">{pad2(category.percent)}%</span>
                        </span>
                      </div>
                      <div className="mt-2">
                        <Bar value={Math.max(1, category.percent)} tone={categoryTone(category.name)} />
                      </div>
                      <div className="mt-1.5 flex gap-5 text-[11px] text-key">
                        <span>Focus {pad2(category.focus)}</span>
                        <span>Prod {pad2(category.productivity)}</span>
                        {locked && <span className="text-signal">Pinned</span>}
                      </div>
                    </button>

                    <Reveal open={open}>
                      <ol
                        className="sam-scroll mt-3 max-h-52 space-y-2 overflow-y-auto border-l border-grid pl-3 pr-1"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        {category.activities.map((activity: any, index: number) => (
                          <li key={activity.id ?? `${activity.start}-${index}`} className="text-[11px]">
                            <div className="flex justify-between gap-3">
                              <span className="truncate text-signal">[{activity.appName ?? "unknown"}]</span>
                              <span className="shrink-0 tabular-nums text-trace">{formatMs(Number(activity.duration ?? 0))}</span>
                            </div>
                            <div className="truncate text-key">
                              {formatTimeRange(activity)} {activity.title ?? "Untitled activity"}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <SectionHead title="Interrupters" meta="Time in distracting categories" />
          {interrupters.length === 0 ? (
            <p className="text-[12px] text-key">No interruptions recorded for this day.</p>
          ) : (
            <ol className="space-y-5">
              {interrupters.map((item, index) => {
                const appEntries = [...(entriesByApp.get(item.name) ?? [])].sort(
                  (a, b) => new Date(b.end ?? b.start).getTime() - new Date(a.end ?? a.start).getTime()
                );
                const appSummary = summarizeEntryGroup(appEntries);
                const active = selectedInterrupter === item.name;

                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      onClick={() => setSelectedInterrupter(active ? null : item.name)}
                      aria-expanded={active}
                      className="block w-full text-left"
                    >
                      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-baseline gap-3">
                        <span className="tabular-nums text-alert">{pad2(index + 1)}</span>
                        <span className="truncate text-signal">[{item.name}]</span>
                        <span className="tabular-nums text-trace">{formatMs(item.duration)}</span>
                      </div>
                      <div className="mt-2 pl-[2.5rem]">
                        <Bar value={(item.duration / interrupterMax) * 100} alert />
                        <div className="mt-1.5 text-[11px] text-key">
                          {item.switches} appearances, focus {pad2(appSummary.focus)}, prod {pad2(appSummary.productivity)}
                        </div>
                      </div>
                    </button>

                    <Reveal open={active}>
                      <ol className="sam-scroll ml-[2.5rem] mt-3 max-h-56 space-y-2 overflow-y-auto border-l border-grid pl-3 pr-1">
                        {appEntries.slice(0, 8).map((entry) => (
                          <li key={entryKey(entry)} className="text-[11px]">
                            <div className="flex justify-between gap-3">
                              <span className="tabular-nums text-trace">{formatTimeRange(entry)}</span>
                              <span className="shrink-0 tabular-nums text-trace">{formatMs(Number(entry.duration ?? 0))}</span>
                            </div>
                            <div className="truncate text-key">{getLatestTitle(entry)}</div>
                            <div className="text-dim">
                              {categoryLabel(entry.category ?? "unknown")}, {String(entry.intent ?? "unknown").replaceAll("_", " ")}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="min-w-0">
          <SectionHead title="Daily balance" meta={isToday ? "Live" : "Final"} />
          <div className="flex items-baseline gap-3">
            <span className={`sam-numeral text-[56px] leading-none ${recoveryAlert ? "text-alert" : ""}`}>
              <Decode value={pad2(recoveryScore)} />
            </span>
            <span className="sam-key">/ 100</span>
          </div>
          <div
            className={`mt-3 font-display text-[13px] uppercase tracking-[0.08em] ${recoveryAlert ? "text-alert" : "text-signal"}`}
            title="Weighted from strain reserve, stability, focus, recovery gaps and switch control"
          >
            {recovery?.status ?? "Building baseline"}
          </div>
          <div className="mt-4">
            <Bar value={recoveryScore} alert={recoveryAlert} />
          </div>

          <dl className="mt-6 space-y-3">
            {recoveryFactors.map((factor) => (
              <div key={factor.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="sam-key">{factor.label}</dt>
                  <dd className="sam-value">
                    <Decode value={pad2(factor.value)} />
                  </dd>
                </div>
                <div className="mt-1.5">
                  <Bar value={factor.value} />
                </div>
              </div>
            ))}
          </dl>

          <p className="mt-6 max-w-[48ch] text-trace">{recovery?.action ?? "Keep tracking to establish today's baseline."}</p>
          <p className="mt-2 text-[11px] text-key">
            {Number(recovery?.switchesPerHour ?? 0).toFixed(1)} switches per hour, {Number(recovery?.idleRatio ?? 0).toFixed(0)}% recovery gaps
          </p>
          <Link
            href="/analytics"
            className="mt-5 inline-block text-[11px] uppercase tracking-[0.08em] text-key underline-offset-4 hover:text-signal hover:underline"
          >
            Open analytics
          </Link>
        </div>
      </section>

      {/* ---------------- REVIEW QUEUE / RECENT ACTIVITY ---------------- */}
      <section className="sam-rule grid gap-x-12 gap-y-14 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionHead
            title="Review queue"
            meta={`${pendingCount} to classify`}
            action={pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => approveEntries(pendingEntries, "all")}
                disabled={Boolean(reviewing)}
                className="sam-button"
                data-variant="primary"
              >
                {reviewing === "all" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                Approve all
              </button>
            ) : null}
          />

          {reviewError && <p className="mb-4 text-[12px] text-alert" role="alert">{reviewError}</p>}

          {pendingCount === 0 ? (
            <p className="text-[12px] text-key">Every entry is classified. Ambiguous activity will be queued here.</p>
          ) : (
            <ul className="sam-scroll max-h-[440px] divide-y divide-grid overflow-y-auto pr-2">
              {pendingEntries.map((entry) => {
                const key = entryKey(entry);
                const draft = reviewDrafts[key] ?? createReviewDraft(entry);
                const appName = entry.appName ?? "activity";

                return (
                  <li key={key} className="py-4 first:pt-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate">
                          <span className="text-signal">[{entry.appName ?? "unknown"}]</span>
                          <span className="ml-3 tabular-nums text-key">{formatMs(Number(entry.duration ?? 0))}</span>
                        </div>
                        <div className="mt-1 truncate text-key">{getLatestTitle(entry)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => approveEntries([entry], key)}
                        disabled={Boolean(reviewing) || !draft.category || !draft.intent}
                        className="sam-button shrink-0"
                      >
                        {reviewing === key && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                        Approve
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <select
                        aria-label={`Category for ${appName}`}
                        value={draft.category}
                        onChange={(event) => changeReviewCategory(key, event.target.value)}
                        className="sam-select"
                      >
                        <option value="">Category</option>
                        {REVIEW_CATEGORIES.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>

                      <select
                        aria-label={`Intent for ${appName}`}
                        value={draft.intent}
                        onChange={(event) => updateReviewDraft(key, { intent: event.target.value })}
                        className="sam-select"
                      >
                        <option value="">Intent</option>
                        {REVIEW_INTENTS.map((intent) => (
                          <option key={intent} value={intent}>{intent.replaceAll("_", " ")}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_2.5rem] items-center gap-3">
                      <span className="sam-key">Focus weight</span>
                      <input
                        aria-label={`Focus weight for ${appName}`}
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={draft.focusImpact}
                        onChange={(event) => updateReviewDraft(key, { focusImpact: Number(event.target.value) })}
                        className="h-1 w-full accent-signal"
                      />
                      <span className="sam-value text-right">{draft.focusImpact}%</span>
                    </div>

                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-key">
                      <input
                        type="checkbox"
                        checked={draft.remember}
                        onChange={(event) => updateReviewDraft(key, { remember: event.target.checked })}
                        className="h-3 w-3 accent-signal"
                      />
                      Apply to future activity in this context
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <SectionHead title="Recent activity" meta="Latest first" />
          <RecentActivity data={timeline} limit={10} />
        </div>
      </section>

      {/* ---------------- HEATMAP ---------------- */}
      <div className="sam-rule pt-8">
        <HeatmapGrid data={heatmap} />
      </div>
    </div>
  );
}
