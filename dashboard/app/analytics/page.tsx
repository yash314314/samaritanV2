"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Minus, TrendingDown, TrendingUp } from "lucide-react";
import PageHeader from "@/components/sam/PageHeader";
import SectionHeader from "@/components/sam/SectionHeader";
import SamLoading from "@/components/sam/SamLoading";
import { Decode } from "@/components/sam/Decode";
import RangeMenu from "@/components/analytics/RangeMenu";
import IntentDistribution from "@/components/analytics/IntentDistribution";
import HourlyBreakdown from "@/components/analytics/HourlyBreakdown";
import {
  EMPTY_HEATMAP_BUCKET,
  HeatmapGrid,
  HeatmapHourModal,
  type HeatmapSelection,
} from "@/components/analytics/AnalyticsHeatmap";
import type { FocusTrendBucket, HeatmapResponse, IntentShare, TimelineSession } from "@/components/analytics/types";
import { useAppContext } from "@/context/AppContext";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import {
  addDaysToKey,
  formatDayKey,
  formatHour,
  formatShortDayKey,
  formatShortDuration,
  istDateKey,
  istHour,
} from "@/lib/analyticsTime";
import { authFetch, getUserId } from "@/lib/auth";
import { API_BASE } from "@/lib/apiBase";

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════

const MAX_ACTIVE_SECONDS_PER_DAY = 20 * 3600;
// An hour or a day needs this much active time before its scores mean
// anything; a few seconds of activity would read as 0% or 100%.
const MIN_ACTIVE_MINUTES_PER_HOUR = 5;
const MIN_ACTIVE_MINUTES_PER_DAY = 15;
// Productivity is drawn beside focus (series 1). Slot 4 is the one that stays
// clearly apart from signal ink in every palette, Monochrome included.
const SECOND_SERIES = "var(--sam-series-4)";

type AnalyticsRange = "day" | "7d" | "30d";
type AnalyticsTab = "overview" | "heatmap";

const RANGE_DAYS: Record<AnalyticsRange, number> = { day: 1, "7d": 7, "30d": 30 };

// The range ends on the day picked in the top bar (today by default).
function analyticsRange(value: AnalyticsRange, anchor: string, today: string) {
  const days = RANGE_DAYS[value];
  const isToday = anchor === today;
  const from = addDaysToKey(anchor, 1 - days);
  const label =
    value === "day"
      ? isToday ? "Today" : formatShortDayKey(anchor)
      : isToday ? `Last ${days} days` : `${days} days to ${formatShortDayKey(anchor)}`;
  return { value, days, from, to: anchor, label, isToday };
}

// ═══════════════════════════════════════════════════════════
//  MATH
// ═══════════════════════════════════════════════════════════

const finite = (n: number) => (Number.isFinite(n) ? n : 0);
const round0 = (n: number) => Math.round(finite(n));
const round1 = (n: number) => Number(finite(n).toFixed(1));
const clampPct = (n: number) => Math.min(100, Math.max(0, finite(n)));

// ═══════════════════════════════════════════════════════════
//  FETCH
// ═══════════════════════════════════════════════════════════

async function fetcher<T>(url: string): Promise<T> {
  const res = await authFetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface AssistantInsights {
  productivityScore: number;
  focusScore: number;
  deepWorkRatio: number;
  communicationRatio: number;
  fragmentationScore: number;
  energyScore: number;
  dominantIntent?: string;
  deepWorkSessions: number;
  avgFocusBlockMinutes: number;
  cognitiveStability: number;
  switchingRate: number;
  suggestion: string;
}

interface DashboardResponse {
  assistant: AssistantInsights;
  weekly: {
    weeklyFocusScore: number;
    weeklyDeepWorkRatio: number;
    weeklyCommunicationRatio: number;
    peakProductiveHour: number | null;
  };
  comparison: { todayFocusScore: number; yesterdayFocusScore: number; change: number; reason: string };
  growth: {
    date: string;
    focus: number;
    productivity: number;
    entropy: number;
    trackedMinutes: number;
    deepWorkMinutes: number;
    switches: number;
  }[];
  intents: IntentShare[];
  burnout: {
    burnoutRisk: "low" | "moderate" | "high";
    burnoutScore: number;
    entropyLoad: number;
    avgSessionMinutes: number;
    recommendation: string;
  };
  streak: { currentDeepWorkStreak: number; longestDeepWorkStreak: number };
  meta: { generatedAt: string; system: string; days?: number | null; from?: string; to?: string };
}

interface DailyAnalytics {
  totalSessions: number;
  totalSwitches: number;
  totalIdleSeconds: number;
  totalActiveSeconds: number;
  averageFocusScore: number;
  appUsage: Record<string, number>;
  productivityBreakdown: {
    productiveCount: number;
    distractingCount: number;
    neutralCount: number;
    productiveDurationMs?: number;
    distractingDurationMs?: number;
    neutralDurationMs?: number;
  };
  recovery?: {
    score: number;
    status: string;
    action: string;
    idleRatio: number;
    switchesPerHour: number;
  };
}

interface TrendPoint {
  key: string;
  label: string;
  title: string;
  activeMinutes: number;
  focus: number | null;
  productivity: number | null;
}

// ═══════════════════════════════════════════════════════════
//  UI PIECES
// ═══════════════════════════════════════════════════════════

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`samaritan-card min-w-0 max-w-full ${className}`}>{children}</section>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex min-h-40 flex-1 items-center justify-center">
    <p className="text-[12px] text-key">{message}</p>
  </div>
);

function Meter({ value, tone = "signal" }: { value: number; tone?: "signal" | "alert" }) {
  return (
    <div className="sam-bar mt-2" data-alert={tone === "alert"}>
      <span style={{ width: `${clampPct(value)}%` }} />
    </div>
  );
}

function LegendSwatch({ color }: { color: string }) {
  return <span aria-hidden className="h-2 w-2 shrink-0" style={{ backgroundColor: color }} />;
}

function TrendTooltip({ active, point, minimum }: { active?: boolean; point?: TrendPoint; minimum: number }) {
  if (!active || !point) return null;
  const scored = point.focus !== null || point.productivity !== null;
  return (
    <div className="samaritan-card sam-ui min-w-[11rem] px-3 py-2 text-[11px]">
      <p className="sam-key mb-1.5">{point.title}</p>
      {scored ? (
        <dl className="space-y-0.5 tabular-nums">
          {[
            ["Focus", point.focus, "var(--sam-series-1)"],
            ["Productivity", point.productivity, SECOND_SERIES],
          ].map(([name, value, color]) => (
            <div key={name as string} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-trace">
                <LegendSwatch color={color as string} />
                {name}
              </dt>
              <dd className="text-signal">{value === null ? "—" : `${value}%`}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 pt-0.5 text-key">
            <dt>Active</dt>
            <dd>{formatShortDuration(point.activeMinutes * 60)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-key">
          {point.activeMinutes > 0
            ? `${formatShortDuration(point.activeMinutes * 60)} active, under the ${minimum} minutes needed to score.`
            : "No active time."}
        </p>
      )}
    </div>
  );
}

const STATUS_TONE = { ok: "text-ok", warn: "text-warn", alert: "text-alert" } as const;

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const userId = getUserId();
  const { selectedDate } = useAppContext();
  const [timeRange, setTimeRange] = useState<AnalyticsRange>("day");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  // Ticks each minute so "today" and the hourly chart's last hour roll over.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = istDateKey(now);
  const selectedKey = istDateKey(selectedDate);
  const anchor = selectedKey > today ? today : selectedKey;
  const range = useMemo(() => analyticsRange(timeRange, anchor, today), [timeRange, anchor, today]);
  const rangeOptions = (["day", "7d", "30d"] as const).map((value) => ({
    value,
    label: analyticsRange(value, anchor, today).label,
  }));

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [daily, setDaily] = useState<DailyAnalytics | null>(null);
  const [focusTrend, setFocusTrend] = useState<FocusTrendBucket[] | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse>({});
  const [timeline, setTimeline] = useState<TimelineSession[] | null>(null);
  const [selectedCell, setSelectedCell] = useState<HeatmapSelection | null>(null);
  const closeCell = useCallback(() => setSelectedCell(null), []);

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [animateTrend, setAnimateTrend] = useState(true);
  const { refreshVersion } = useRealtimeRefresh(undefined, { debounceMs: 900 });

  const reportError = useCallback((source: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setErrors((current) => ({ ...current, [source]: message }));
  }, []);
  const clearError = useCallback((source: string) => {
    setErrors((current) => {
      if (!(source in current)) return current;
      const next = { ...current };
      delete next[source];
      return next;
    });
  }, []);

  // ── Dashboard aggregates (KPIs, trend, intents) ──
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDashboardLoading(true);
    });
    fetcher<DashboardResponse>(`${API_BASE}/analytics/dashboard?userId=${userId}&days=${range.days}&to=${range.to}`)
      .then((data) => {
        if (cancelled) return;
        setDashboard(data);
        clearError("Summary");
      })
      .catch((error) => !cancelled && reportError("Summary", error))
      .finally(() => !cancelled && setDashboardLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, range.days, range.to, refreshVersion, reportError, clearError]);

  // ── Tab data ──
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setTabLoading(true);
    });
    const query = `userId=${userId}&from=${range.from}&to=${range.to}`;
    const load = <T,>(source: string, url: string, apply: (data: T) => void) =>
      fetcher<T>(url)
        .then((data) => {
          if (cancelled) return;
          apply(data);
          clearError(source);
        })
        .catch((error) => !cancelled && reportError(source, error));

    const requests: Promise<unknown>[] = [];
    if (activeTab === "overview") {
      requests.push(load<DailyAnalytics>("Daily totals", `${API_BASE}/analytics/daily?${query}`, setDaily));
      if (range.days === 1) {
        requests.push(
          load<FocusTrendBucket[]>(
            "Hourly trend",
            `${API_BASE}/analytics/daily-focus-trend?userId=${userId}&date=${range.to}&bucketMinutes=60`,
            setFocusTrend
          )
        );
      }
    } else {
      requests.push(
        load<HeatmapResponse>("Heatmap", `${API_BASE}/analytics/heatmap?${query}`, setHeatmap),
        load<TimelineSession[]>("Timeline", `${API_BASE}/analytics/timeline?${query}`, setTimeline)
      );
    }
    Promise.all(requests).finally(() => !cancelled && setTabLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeTab, userId, range.from, range.to, range.days, refreshVersion, reportError, clearError]);

  // ── Derived data ──
  const appUsage = useMemo(() => {
    if (!daily?.appUsage) return [];
    const total = Object.values(daily.appUsage).reduce((sum, ms) => sum + ms, 0);
    return Object.entries(daily.appUsage)
      .map(([name, durationMs]) => ({ name, durationMs, percentage: total > 0 ? (durationMs / total) * 100 : 0 }))
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 8);
  }, [daily]);

  const allocation = useMemo(() => {
    if (!daily?.productivityBreakdown) return [];
    const b = daily.productivityBreakdown;
    const productive = b.productiveDurationMs ?? b.productiveCount;
    const distracting = b.distractingDurationMs ?? b.distractingCount;
    const neutral = b.neutralDurationMs ?? b.neutralCount;
    const total = productive + distracting + neutral;
    if (!(total > 0)) return [];
    return [
      { name: "Productive", value: round0((productive / total) * 100), durationMs: b.productiveDurationMs ?? 0, color: "var(--sam-series-1)" },
      { name: "Distracting", value: round0((distracting / total) * 100), durationMs: b.distractingDurationMs ?? 0, color: "var(--sam-alert)" },
      { name: "Neutral", value: round0((neutral / total) * 100), durationMs: b.neutralDurationMs ?? 0, color: "var(--sam-dim)" },
    ];
  }, [daily]);

  const productiveShare = allocation.find((entry) => entry.name === "Productive")?.value ?? 0;
  const distractingShare = allocation.find((entry) => entry.name === "Distracting")?.value ?? 0;
  const productivityBalance = productiveShare - distractingShare;
  const productivityRatio = distractingShare > 0 ? productiveShare / distractingShare : productiveShare > 0 ? null : 0;
  const productivityStatus =
    productiveShare >= 75
      ? { label: "Strong", tone: STATUS_TONE.ok }
      : productiveShare >= 55
        ? { label: "Balanced", tone: STATUS_TONE.ok }
        : productiveShare >= 35
          ? { label: "Mixed", tone: STATUS_TONE.warn }
          : { label: "Distracted", tone: STATUS_TONE.alert };

  const trend = useMemo<TrendPoint[]>(() => {
    if (range.days === 1) {
      if (!focusTrend) return [];
      // Both scores use active time only, like the headline scores. Hours yet
      // to come, and hours with only a few active minutes, are left blank.
      const lastHour = range.isToday ? istHour(now) : 23;
      return focusTrend
        .filter((bucket) => bucket.minute === 0)
        .map((bucket) => {
          const activeMinutes = bucket.hour <= lastHour ? bucket.activeMinutes ?? 0 : 0;
          const scored = activeMinutes >= MIN_ACTIVE_MINUTES_PER_HOUR;
          const focus = bucket.activeFocus ?? null;
          const productivity = bucket.productivity ?? null;
          return {
            key: bucket.label,
            label: formatHour(bucket.hour).slice(0, 2),
            title: `${formatHour(bucket.hour)}–${formatHour(bucket.hour + 1)} IST`,
            activeMinutes,
            focus: scored && focus !== null ? round0(focus) : null,
            productivity: scored && productivity !== null ? round0(productivity) : null,
          };
        });
    }
    // trackedMinutes is active (non-idle) time per day.
    return (dashboard?.growth ?? []).map((point) => {
      const scored = point.trackedMinutes >= MIN_ACTIVE_MINUTES_PER_DAY;
      return {
        key: point.date,
        label: formatShortDayKey(point.date),
        title: formatDayKey(point.date),
        activeMinutes: point.trackedMinutes,
        focus: scored ? round0(point.focus) : null,
        productivity: scored ? round0(point.productivity) : null,
      };
    });
  }, [range.days, range.isToday, focusTrend, dashboard, now]);

  const trendHasData = trend.some((point) => point.focus !== null || point.productivity !== null);
  const trendMinimum = range.days === 1 ? MIN_ACTIVE_MINUTES_PER_HOUR : MIN_ACTIVE_MINUTES_PER_DAY;

  // Bar width follows the chart's width: each slot's focus/productivity pair
  // takes about 60% of the slot and stays side by side at any width.
  const [trendWidth, setTrendWidth] = useState(0);
  const trendRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setTrendWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const trendSlot = trend.length > 0 ? Math.max(0, trendWidth - 40) / trend.length : 0;
  const trendBarSize = Math.max(2, Math.min(18, Math.floor((trendSlot * 0.6 - 2) / 2)));
  const trackedDays = (dashboard?.growth ?? []).filter((point) => point.trackedMinutes > 0).length;

  useEffect(() => {
    if (!trendHasData || !animateTrend) return;
    const timer = window.setTimeout(() => setAnimateTrend(false), 1200);
    return () => window.clearTimeout(timer);
  }, [trendHasData, animateTrend]);

  const warnings = useMemo(() => {
    if (!daily) return [];
    const list: string[] = [];
    if (daily.totalActiveSeconds > MAX_ACTIVE_SECONDS_PER_DAY * range.days) {
      list.push(`Active time of ${formatShortDuration(daily.totalActiveSeconds)} exceeds ${20 * range.days}h for this range; some sessions may overlap.`);
    }
    if (daily.totalActiveSeconds + daily.totalIdleSeconds > 24 * 3600 * range.days + 60) {
      list.push("Active and idle time together exceed the length of this range.");
    }
    return list;
  }, [daily, range.days]);

  const chartTooltipStyle = {
    backgroundColor: "var(--sam-void)",
    border: "1px solid var(--sam-grid)",
    borderRadius: 0,
    color: "var(--sam-trace)",
    fontSize: 11,
  };

  const isLoading = dashboardLoading || tabLoading;
  const errorEntries = Object.entries(errors);
  const assistant = dashboard?.assistant;
  const burnoutTone =
    dashboard?.burnout.burnoutRisk === "high"
      ? STATUS_TONE.alert
      : dashboard?.burnout.burnoutRisk === "moderate"
        ? STATUS_TONE.warn
        : STATUS_TONE.ok;
  const change = dashboard?.comparison.change ?? 0;

  return (
    <div className="dashboard-page flex flex-col text-trace">
      <div className="relative z-[100] shrink-0">
        <PageHeader
          title="Analytics"
          description="Productivity, focus and attention patterns over the selected range."
          actions={
            <>
              {isLoading && dashboard && (
                <span role="status" className="sam-key sam-pulse">
                  Updating
                </span>
              )}
              <RangeMenu label="Range" value={timeRange} options={rangeOptions} onChange={setTimeRange} />
            </>
          }
        />

        <div role="tablist" aria-label="Analytics view" className="sam-ui mb-6 flex gap-6 border-b border-grid">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "heatmap", label: "Heatmap" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b pb-2 text-[11px] uppercase tracking-[0.1em] transition-colors ${
                activeTab === tab.id ? "border-signal text-signal" : "border-transparent text-key hover:text-trace"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-0 min-h-0 w-full flex-1 py-1" aria-busy={isLoading}>
        {errorEntries.length > 0 && (
          <div role="alert" className="mb-4 flex items-start gap-2 border border-alert/40 px-3 py-2.5 text-[12px] text-alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              {errorEntries.map(([source, message]) => (
                <p key={source}>
                  {source} could not be loaded ({message}). It will retry on the next update.
                </p>
              ))}
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="mb-4 space-y-1 border border-warn/40 px-3 py-2.5 text-[12px] text-warn">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {!dashboard || !assistant ? (
          dashboardLoading ? (
            <SamLoading label="Calculating analytics" />
          ) : (
            <EmptyState message="No analytics data found. Start tracking to see insights." />
          )
        ) : activeTab === "overview" ? (
          <div className="grid min-h-0 grid-cols-12 content-start gap-3">
            {/* ── Summary ── */}
            <Card className="col-span-12">
              <div className="grid min-w-0 gap-4 border-b border-grid px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)] lg:px-5">
                <div className="min-w-0">
                  <p className="sam-key">Assessment · {range.label}</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-signal">
                    {assistant.suggestion || "Keep a steady rhythm and protect your strongest focus window."}
                  </p>
                </div>
                <div className="flex min-w-0 items-start gap-3 border border-grid px-3 py-2.5">
                  {range.days === 1 ? (
                    <>
                      {change > 0 ? (
                        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
                      ) : change < 0 ? (
                        <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-key" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-[12px] text-trace">
                          {change > 0 ? "+" : ""}
                          {round1(change)} focus points vs {formatShortDayKey(addDaysToKey(range.to, -1))}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-4 text-key">{dashboard.comparison.reason}</p>
                      </div>
                    </>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-[12px] text-trace">
                        {formatShortDayKey(range.from)} – {formatShortDayKey(range.to)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-key">
                        {trackedDays} of {range.days} days have tracked activity.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <dl className="grid min-w-0 grid-cols-2 gap-px border-b border-grid bg-grid sm:grid-cols-4">
                {[
                  { label: "Productivity", value: `${round0(assistant.productivityScore)}%`, detail: "Weighted by category", score: assistant.productivityScore },
                  { label: "Focus", value: `${round0(assistant.focusScore)}%`, detail: "Depth of attention", score: assistant.focusScore },
                  {
                    label: "Active time",
                    value: daily ? formatShortDuration(daily.totalActiveSeconds) : "—",
                    detail: `${daily?.totalSessions ?? 0} sessions`,
                  },
                  {
                    label: "Idle time",
                    value: daily ? formatShortDuration(daily.totalIdleSeconds) : "—",
                    detail: `${round0(daily?.recovery?.idleRatio ?? 0)}% of tracked time`,
                  },
                  {
                    label: "Switches",
                    value: `${daily?.totalSwitches ?? 0}`,
                    detail: `${round1(daily?.recovery?.switchesPerHour ?? assistant.switchingRate)} per active hour`,
                  },
                  {
                    label: "Stability",
                    value: `${round0(assistant.cognitiveStability)}%`,
                    detail: `${round0(assistant.fragmentationScore)}% fragmentation`,
                    score: assistant.cognitiveStability,
                  },
                  {
                    label: "Deep work streak",
                    value: `${dashboard.streak.currentDeepWorkStreak}d`,
                    detail: `Best ${dashboard.streak.longestDeepWorkStreak}d`,
                  },
                  {
                    label: "Burnout risk",
                    value: dashboard.burnout.burnoutRisk,
                    detail: `${round0(dashboard.burnout.burnoutScore)} risk score`,
                    tone: burnoutTone,
                  },
                ].map((metric) => (
                  <div key={metric.label} className="min-w-0 bg-void px-4 py-3.5">
                    <dt className="sam-key">{metric.label}</dt>
                    <dd className={`sam-numeral mt-1.5 text-[22px] capitalize ${metric.tone ?? ""}`}>
                      <Decode value={metric.value} />
                    </dd>
                    <dd className="mt-0.5 text-[11px] text-key">{metric.detail}</dd>
                    {metric.score !== undefined && (
                      <dd>
                        <Meter value={metric.score} />
                      </dd>
                    )}
                  </div>
                ))}
              </dl>

              <dl className="grid min-w-0 grid-cols-2 gap-px bg-grid sm:grid-cols-3 xl:grid-cols-6">
                {[
                  ["Deep work share", `${round0(dashboard.weekly.weeklyDeepWorkRatio)}%`],
                  ["Deep work sessions", `${assistant.deepWorkSessions}`],
                  ["Avg focus block", `${round0(assistant.avgFocusBlockMinutes)}m`],
                  ["Communication", `${round0(dashboard.weekly.weeklyCommunicationRatio)}%`],
                  ["Peak hour", dashboard.weekly.peakProductiveHour === null ? "—" : formatHour(dashboard.weekly.peakProductiveHour)],
                  ["Days tracked", `${trackedDays} of ${range.days}`],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 bg-void px-4 py-3">
                    <dt className="sam-key truncate">{label}</dt>
                    <dd className="mt-1 truncate text-[13px] tabular-nums text-signal">
                      <Decode value={value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {/* ── Scores by hour or day ── */}
            <Card className="col-span-12 flex h-[380px] flex-col p-4">
              <SectionHeader
                className="mb-4"
                title={range.days === 1 ? "Focus by hour" : "Focus by day"}
                meta={range.label}
                actions={
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-key">
                    <span className="inline-flex items-center gap-1.5">
                      <LegendSwatch color="var(--sam-series-1)" />
                      Focus <span className="tabular-nums text-signal">{round0(assistant.focusScore)}%</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <LegendSwatch color={SECOND_SERIES} />
                      Productivity <span className="tabular-nums text-signal">{round0(assistant.productivityScore)}%</span>
                    </span>
                  </div>
                }
              />
              {trendHasData ? (
                <div ref={trendRef} className="relative min-h-0 w-full min-w-0 flex-1">
                  <BarChart
                    key={`trend-${range.days}-${range.to}`}
                    responsive
                    data={trend}
                    barGap={2}
                    barSize={trendBarSize}
                    margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <CartesianGrid stroke="var(--sam-grid)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--sam-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="var(--sam-dim)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--sam-grid)", fillOpacity: 0.55 }}
                      content={({ active, payload }) => <TrendTooltip active={active} point={payload?.[0]?.payload as TrendPoint | undefined} minimum={trendMinimum} />}
                    />
                    <Bar
                      dataKey="focus"
                      name="Focus"
                      fill="var(--sam-series-1)"
                      minPointSize={2}
                      isAnimationActive={animateTrend}
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                    <Bar
                      dataKey="productivity"
                      name="Productivity"
                      fill={SECOND_SERIES}
                      minPointSize={2}
                      isAnimationActive={animateTrend}
                      animationDuration={700}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </div>
              ) : (
                tabLoading ? <SamLoading compact label="Calculating" /> : <EmptyState message="No focus or productivity recorded in this range yet." />
              )}
              <p className="mt-2 text-[11px] text-key">
                Scores use active time only. {range.days === 1 ? "Hours" : "Days"} with under {trendMinimum} active minutes are left blank.
              </p>
            </Card>

            <div className="col-span-12 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
              {/* ── Intents ── */}
              <Card className="flex h-[400px] flex-col p-4">
                <SectionHeader className="mb-3" title="Intent distribution" />
                <IntentDistribution intents={dashboard.intents} />
              </Card>

              {/* ── Apps ── */}
              <Card className="flex h-[400px] flex-col p-4">
                <SectionHeader className="mb-4" title="App usage" meta={range.label} />
                {appUsage.length > 0 ? (
                  <ul className="dashboard-scroll-panel min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {appUsage.map((app) => (
                      <li key={app.name} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-grid bg-raised font-display text-[11px] uppercase text-trace">
                          {app.name.trim()[0] ?? "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex min-w-0 items-baseline justify-between gap-3">
                            <span className="truncate text-[12px] text-signal" title={app.name}>
                              {app.name}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-key">
                              {formatShortDuration(app.durationMs / 1000)} · {app.percentage < 1 ? "<1" : round0(app.percentage)}%
                            </span>
                          </div>
                          <div className="h-[3px] w-full bg-track">
                            <div className="sam-fill h-full bg-signal" style={{ width: `${clampPct(app.percentage)}%` }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  tabLoading ? <SamLoading compact label="Calculating" /> : <EmptyState message="No app usage in this range." />
                )}
              </Card>

              {/* ── Allocation ── */}
              <Card className="flex h-[400px] flex-col p-4">
                <SectionHeader
                  className="mb-3"
                  title="Productivity breakdown"
                  actions={
                    allocation.length > 0 && (
                      <span className={`border border-current px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${productivityStatus.tone}`}>
                        {productivityStatus.label}
                      </span>
                    )
                  }
                />
                {allocation.length > 0 ? (
                  <div className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3">
                    <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(136px,0.9fr)] gap-3">
                      <div className="relative min-h-0 min-w-0">
                        <PieChart responsive style={{ width: "100%", height: "100%" }}>
                          <Pie
                            data={allocation}
                            cx="50%"
                            cy="50%"
                            innerRadius="58%"
                            outerRadius="80%"
                            paddingAngle={2}
                            dataKey="value"
                            stroke="var(--sam-void)"
                            strokeWidth={2}
                            isAnimationActive={false}
                          >
                            {allocation.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [`${round0(Number(value ?? 0))}%`, String(name)]} />
                        </PieChart>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <span className="sam-numeral text-[22px]">
                            <Decode value={`${productiveShare}%`} />
                          </span>
                          <span className="sam-key text-[10px]">productive</span>
                        </div>
                      </div>
                      <ul className="flex min-w-0 flex-col justify-center gap-2.5 border-l border-grid pl-3">
                        {allocation.map((entry) => (
                          <li key={entry.name} className="min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span aria-hidden className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="truncate text-[11px] text-trace">{entry.name}</span>
                              </span>
                              <span className="shrink-0 text-[12px] tabular-nums text-signal">{entry.value}%</span>
                            </div>
                            <p className="mt-0.5 pl-[18px] text-[11px] tabular-nums text-key">{formatShortDuration(entry.durationMs / 1000)}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <dl className="grid grid-cols-3 divide-x divide-grid border-t border-grid pt-3">
                      <div className="min-w-0 pr-2">
                        <dt className="sam-key truncate text-[10px]">Active time</dt>
                        <dd className="mt-1 truncate text-[12px] tabular-nums text-signal">{formatShortDuration(daily?.totalActiveSeconds ?? 0)}</dd>
                      </div>
                      <div className="min-w-0 px-2">
                        <dt className="sam-key truncate text-[10px]">Net balance</dt>
                        <dd className={`mt-1 truncate text-[12px] tabular-nums ${productivityBalance >= 0 ? "text-ok" : "text-alert"}`}>
                          {productivityBalance > 0 ? "+" : ""}
                          {productivityBalance} pts
                        </dd>
                      </div>
                      <div className="min-w-0 pl-2">
                        <dt className="sam-key truncate text-[10px]">P:D ratio</dt>
                        <dd className="mt-1 truncate text-[12px] tabular-nums text-signal">
                          {productivityRatio === null ? "No distraction" : `${round1(productivityRatio)}x`}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  tabLoading ? <SamLoading compact label="Calculating" /> : <EmptyState message="No categorised activity in this range." />
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 grid-cols-12 content-start gap-3 pb-2">
            <Card className="col-span-12 p-4">
              <SectionHeader className="mb-2" title="Activity heatmap" meta="IST hours" />
              <p className="mb-4 text-[12px] text-key">Productivity score by hour. Hover a cell for a summary; select it for the activity log.</p>
              {tabLoading && Object.keys(heatmap).length === 0 ? (
                <SamLoading compact label="Calculating heatmap" />
              ) : (
                <HeatmapGrid data={heatmap} from={range.from} to={range.to} onSelect={setSelectedCell} />
              )}
            </Card>

            <Card className="col-span-12 p-4">
              <SectionHeader className="mb-2" title="Recent hourly breakdown" meta={range.label} />
              <p className="mb-4 text-[12px] text-key">Sessions grouped by hour, newest first. Open an hour to see its sessions and pages.</p>
              {timeline === null ? (
                errors.Timeline ? <EmptyState message="Sessions could not be loaded." /> : <SamLoading compact label="Calculating sessions" />
              ) : (
                <HourlyBreakdown key={`${range.from}-${range.to}`} sessions={timeline} />
              )}
            </Card>
          </div>
        )}
      </div>

      <HeatmapHourModal
        selection={selectedCell}
        bucket={selectedCell ? (heatmap[selectedCell.date]?.[selectedCell.hour] ?? EMPTY_HEATMAP_BUCKET) : null}
        sessions={timeline ?? []}
        onClose={closeCell}
      />
    </div>
  );
}
