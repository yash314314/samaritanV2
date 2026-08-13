"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronDown,
  Activity,
  Zap,
  BrainCircuit,
  Flame,
  AlertTriangle,
  Timer,
  MousePointerClick,
  BarChart3,
  Thermometer,
  LayoutDashboard,
  Focus,
  ShieldAlert,
} from "lucide-react";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import AppCategoryTags from "../../components/AppCategoryTags";

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════

const API_BASE = "http://localhost:4000";
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const MAX_SANE_DAILY_SECONDS = 20 * 3600;

// ═══════════════════════════════════════════════════════════
//  TIME UTILS
// ═══════════════════════════════════════════════════════════

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toISTDateString(d = new Date()): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().split("T")[0];
}

/** hh:mm:ss from seconds */
function formatHMS(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m.toString().padStart(2, "0")}m`);
  parts.push(`${s.toString().padStart(2, "0")}s`);
  return parts.join(" ");
}

/** Format a Date to HH:MM:SS in IST */
function formatTimeIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const h = ist.getUTCHours().toString().padStart(2, "0");
  const m = ist.getUTCMinutes().toString().padStart(2, "0");
  const s = ist.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** compact Xh Ym for cards */
function formatShortDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ═══════════════════════════════════════════════════════════
//  MATH
// ═══════════════════════════════════════════════════════════

interface ValidationResult {
  valid: boolean;
  warning?: string;
}

function validateDuration(seconds: number, label: string): ValidationResult {
  if (!isFinite(seconds)) return { valid: false, warning: `${label}: non-numeric` };
  if (seconds < 0) return { valid: false, warning: `${label}: negative value` };
  if (seconds > MAX_SANE_DAILY_SECONDS) {
    return { valid: false, warning: `${label}: ${formatShortDuration(seconds)} exceeds 20h` };
  }
  return { valid: true };
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, isFinite(num) ? num : 0));
}

function round0(n: number): number {
  return Math.round(isFinite(n) ? n : 0);
}

function round1(n: number): number {
  return Number((isFinite(n) ? n : 0).toFixed(1));
}

function round2(n: number): number {
  return Number((isFinite(n) ? n : 0).toFixed(2));
}

// ═══════════════════════════════════════════════════════════
//  FETCH
// ═══════════════════════════════════════════════════════════

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
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
  dominantIntent: string;
  deepWorkSessions: number;
  avgFocusBlockMinutes: number;
  cognitiveStability: number;
  switchingRate: number;
  suggestion: string;
}

interface WeeklyInsights {
  weeklyFocusScore: number;
  weeklyDeepWorkRatio: number;
  weeklyCommunicationRatio: number;
  peakProductiveHour: number | null;
}

interface DailyComparison {
  todayFocusScore: number;
  yesterdayFocusScore: number;
  change: number;
  reason: string;
}

interface GrowthPoint {
  date: string;
  focus: number;
  productivity: number;
  entropy: number;
  trackedMinutes: number;
  deepWorkMinutes: number;
  switches: number;
}

interface IntentHeatmapItem {
  intent: string;
  percentage: number;
  avgFocus: number;
}

interface BurnoutRisk {
  burnoutRisk: "low" | "moderate" | "high";
  burnoutScore: number;
  entropyLoad: number;
  avgSessionMinutes: number;
  recommendation: string;
}

interface StreakData {
  currentDeepWorkStreak: number;
  longestDeepWorkStreak: number;
}

interface DashboardResponse {
  assistant: AssistantInsights;
  weekly: WeeklyInsights;
  comparison: DailyComparison;
  growth: GrowthPoint[];
  intents: IntentHeatmapItem[];
  burnout: BurnoutRisk;
  streak: StreakData;
  meta: { generatedAt: string; system: string };
}

interface DailyAnalytics {
  totalSessions: number;
  totalSwitches: number;
  totalIdleSeconds: number;
  totalActiveSeconds: number;
  averageFocusScore: number;
  averageBurnoutScore: number;
  appUsage: Record<string, number>;
  productivityBreakdown: {
    productiveCount: number;
    distractingCount: number;
    neutralCount: number;
    productiveDurationMs?: number;
    distractingDurationMs?: number;
    neutralDurationMs?: number;
  };
  averageEntropyScore: number;
  deepWorkSessions?: number;
  totalDeepWorkSeconds?: number;
  recovery?: {
    score: number;
    status: string;
    action: string;
    idleRatio: number;
    switchesPerHour: number;
  };
}

interface HeatmapBucket {
  score: number;
  productivity: number;
  duration: number;
  trackedMinutes: number;
  idleMinutes: number;
  dominantApp: string | null;
  dominantCategory: string | null;
  dominantIntent: string | null;
  topApps: {
    name: string;
    duration: number;
    minutes: number;
    percentage: number;
    category?: string;
    categories?: { name: string; duration: number; minutes: number; percentage: number }[];
  }[];
  categoryBreakdown: { name: string; duration: number; minutes: number; percentage: number }[];
  intentBreakdown: { name: string; duration: number; minutes: number; percentage: number }[];
}

type HeatmapDay = Record<number, HeatmapBucket>;
type HeatmapResponse = Record<string, HeatmapDay>;

interface FocusTrendBucket {
  index: number;
  hour: number;
  minute: number;
  label: string;
  start: string;
  end: string;
  duration: number;
  focus: number;
}

interface DailySummary {
  date: string;
  deepWorkHours: number;
  focusScore: number;
  longestFocusBlockMinutes: number;
  totalActivities: number;
  dominantIntent: string;
}

// ═══════════════════════════════════════════════════════════
//  TIMELINE TYPES — matches /analytics/timeline output format
// ═══════════════════════════════════════════════════════════

interface TimelineItem {
  title: string;
  iconUrl: string | null;
  domain: string | null;
  url: string | null;
  start: string; // ISO
  end: string; // ISO
  duration: number; // ms
}

interface TimelineSession {
  appName: string;
  iconUrl: string | null;
  domain: string | null;
  url: string | null;
  start: string; // ISO
  end: string; // ISO
  duration: number; // ms
  category: string;
  items: TimelineItem[];
}

// ═══════════════════════════════════════════════════════════
//  UI COMPONENTS
// ═══════════════════════════════════════════════════════════

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`samaritan-card min-w-0 max-w-full overflow-hidden ${className}`}>{children}</div>
);

const TimeRangeSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ranges = ["Today", "Last 7 Days", "Last 30 Days"];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        {value}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50">
          {ranges.map((range) => (
            <button
              key={range}
              onClick={() => {
                onChange(range);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 first:rounded-t-lg last:rounded-b-lg text-zinc-300 ${
                value === range ? "bg-zinc-800 font-medium" : ""
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-5 h-5 text-zinc-500" />
    <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
    <Activity className="w-8 h-8 mb-2 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

const ValidationBadge = ({ result }: { result: ValidationResult }) => {
  if (result.valid) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
      <ShieldAlert className="w-3 h-3" />
      {result.warning}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════
//  HEATMAP TOOLTIP — robust floating detail card
// ═══════════════════════════════════════════════════════════

const HeatmapTooltipCard = ({
  date,
  hour,
  bucket,
}: {
  date: string;
  hour: number;
  bucket: HeatmapBucket;
}) => {
  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl shadow-black/80 p-4 w-80 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-zinc-800">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{date}</p>
          <p className="text-white text-lg font-bold">
            {hour}:00 – {hour + 1}:00 <span className="text-zinc-500 text-sm font-normal">IST</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-white text-lg font-bold">{formatHMS(bucket.duration / 1000)}</p>
          <p className="text-zinc-500 text-xs">
            {bucket.topApps?.length ?? 0} apps • {bucket.trackedMinutes}m tracked
          </p>
        </div>
      </div>

      {/* ── Raw Score Header ── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-900/60 rounded-lg p-2 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Raw Score</p>
          <p className="text-sm font-bold text-purple-400 font-mono">{round2(bucket.score)}</p>
        </div>
        <div className="bg-zinc-900/60 rounded-lg p-2 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Productivity</p>
          <p className="text-sm font-bold text-emerald-400 font-mono">{round0(bucket.productivity)}%</p>
        </div>
        <div className="bg-zinc-900/60 rounded-lg p-2 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Idle</p>
          <p className="text-sm font-bold text-rose-400 font-mono">{bucket.idleMinutes}m</p>
        </div>
      </div>

      {bucket.categoryBreakdown && bucket.categoryBreakdown.length > 0 && (
        <div className="mb-3">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Categories</p>
          <div className="space-y-1.5">
            {bucket.categoryBreakdown.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span className="text-zinc-300 text-xs flex-1">{cat.name}</span>
                <span className="text-zinc-500 text-xs font-mono">{cat.minutes}m</span>
                <span className="text-zinc-600 text-xs w-8 text-right">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bucket.topApps && bucket.topApps.length > 0 && (
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">Top Apps</p>
          <div className="space-y-1.5">
            {bucket.topApps.slice(0, 5).map((app) => (
              <div key={app.name} className="flex items-start gap-2 bg-zinc-900/60 rounded-lg p-1.5">
                <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">
                  {app.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-zinc-200">{app.name}</div>
                  <AppCategoryTags app={app} />
                </div>
                <span className="text-zinc-500 text-xs font-mono">{app.minutes}m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bucket.dominantIntent && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <p className="text-zinc-500 text-xs">Dominant Intent</p>
          <p className="text-zinc-300 text-sm font-medium">{bucket.dominantIntent}</p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  HOURLY BREAKDOWN — timeline grouped by IST hour
// ═══════════════════════════════════════════════════════════

const HourlyBreakdown = ({ sessions }: { sessions: TimelineSession[] }) => {
  const byHour = useMemo(() => {
    const map = new Map<number, TimelineSession[]>();
    sessions.forEach((s) => {
      const d = new Date(new Date(s.start).getTime() + IST_OFFSET_MS);
      const h = d.getUTCHours();
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(s);
    });
    return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
  }, [sessions]);

  if (sessions.length === 0) return <EmptyState message="No timeline data available" />;

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
      {[...byHour.entries()].map(([hour, hourSessions]) => {
        const sortedSessions = [...hourSessions].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
        const totalMs = sortedSessions.reduce((sum, s) => sum + s.duration, 0);
        const uniqueApps = [...new Set(sortedSessions.map((s) => s.appName))];
        return (
          <div key={hour} className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
            <div className="bg-zinc-900/80 px-4 py-3 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                  <span className="text-sm font-bold text-zinc-300">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{sortedSessions.length} sessions</p>
                  <p className="text-xs text-zinc-500">
                    {formatHMS(totalMs / 1000)} total • {uniqueApps.length} apps
                  </p>
                </div>
              </div>
              <div className="flex -space-x-2 overflow-hidden">
                {sortedSessions.slice(0, 4).map((s, i) =>
                  s.iconUrl ? (
                    <img
                      key={i}
                      src={s.iconUrl}
                      alt=""
                      className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-400 font-bold"
                    >
                      {s.appName[0]}
                    </div>
                  )
                )}
                {sortedSessions.length > 4 && (
                  <div className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-400 font-bold">
                    +{sortedSessions.length - 4}
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-zinc-800/50">
              {sortedSessions.map((session, idx) => (
                <div key={idx} className="px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                  <div className="flex items-start gap-3">
                    {session.iconUrl ? (
                      <img
                        src={session.iconUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-contain shrink-0 bg-zinc-800/50 p-0.5 border border-zinc-800"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 font-bold shrink-0 border border-zinc-700">
                        {session.appName[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-300">{session.appName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                            {session.category}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono shrink-0">
                          {formatHMS(session.duration / 1000)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                        {formatTimeIST(session.start)} – {formatTimeIST(session.end)}
                      </p>

                      {session.items && session.items.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {session.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 pl-3 py-1 border-l-2 border-zinc-700/50"
                            >
                              {item.iconUrl ? (
                                <img
                                  src={item.iconUrl}
                                  alt=""
                                  className="w-4 h-4 rounded object-contain shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="w-4 h-4 rounded bg-zinc-800 shrink-0" />
                              )}
                              <span className="text-xs text-zinc-400 truncate flex-1">
                                {item.title}
                              </span>
                              <span className="text-[10px] text-zinc-600 font-mono">
                                {formatHMS(item.duration / 1000)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  HEATMAP — Force visible colour variations + rich tooltip
// ═══════════════════════════════════════════════════════════

const HeatmapGrid = ({ data }: { data: HeatmapResponse }) => {
  const dates = useMemo(() => Object.keys(data).sort(), [data]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Find min/max across all data to normalize colors
  const { minScore, maxScore } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let hasData = false;
    dates.forEach((date) => {
      hours.forEach((h) => {
        const bucket = data[date]?.[h];
        if (bucket) {
          hasData = true;
          min = Math.min(min, bucket.score);
          max = Math.max(max, bucket.score);
        }
      });
    });
    if (!hasData) return { minScore: 0, maxScore: 1 };
    // If all same, force range
    if (min === max) return { minScore: 0, maxScore: Math.max(max, 1) };
    return { minScore: min, maxScore: max };
  }, [data, dates]);

  const getColor = (score: number) => {
    if (!isFinite(score)) return "bg-zinc-900";
    // Normalize to 0-1 range based on actual min/max
    const normalized = maxScore > minScore ? (score - minScore) / (maxScore - minScore) : 0;

    // 10 distinct purple shades for maximum variation
    if (normalized === 0) return "bg-zinc-950";
    if (normalized < 0.1) return "bg-purple-950/40";
    if (normalized < 0.2) return "bg-purple-950";
    if (normalized < 0.3) return "bg-purple-900/80";
    if (normalized < 0.4) return "bg-purple-900";
    if (normalized < 0.5) return "bg-purple-800/80";
    if (normalized < 0.6) return "bg-purple-800";
    if (normalized < 0.7) return "bg-purple-700";
    if (normalized < 0.8) return "bg-purple-600";
    if (normalized < 0.9) return "bg-purple-500";
    return "bg-purple-400";
  };

  // Tooltip state
  const [hovered, setHovered] = useState<{
    date: string;
    hour: number;
    bucket: HeatmapBucket;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseEnter = (
    date: string,
    hour: number,
    bucket: HeatmapBucket | undefined,
    e: React.MouseEvent
  ) => {
    if (!bucket || bucket.duration === 0) return;
    setHovered({ date, hour, bucket });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hovered) setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => setHovered(null);

  if (dates.length === 0) return <EmptyState message="No heatmap data available" />;

  return (
    <div className="relative" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex">
            <div className="w-16 flex-shrink-0" />
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-xs text-zinc-600 py-1">
                {h}
              </div>
            ))}
          </div>
          {dates.slice(-7).map((date) => (
            <div key={date} className="flex items-center py-0.5">
              <div className="w-16 flex-shrink-0 text-xs text-zinc-500 pr-2">
                {date.slice(5)}
              </div>
              {hours.map((h) => {
                const bucket = data[date]?.[h];
                const score = bucket?.score ?? 0;
                return (
                  <div key={h} className="flex-1 px-0.5">
                    <div
                      className={`h-6 rounded-sm ${getColor(
                        score
                      )} cursor-crosshair transition-all hover:ring-2 hover:ring-purple-400/50 relative`}
                      onMouseEnter={(e) => handleMouseEnter(date, h, bucket, e)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 ml-16">
            <span className="text-xs text-zinc-600">{round2(minScore)}</span>
            {[
              "bg-zinc-950",
              "bg-purple-950/40",
              "bg-purple-950",
              "bg-purple-900/80",
              "bg-purple-900",
              "bg-purple-800/80",
              "bg-purple-800",
              "bg-purple-700",
              "bg-purple-600",
              "bg-purple-500",
              "bg-purple-400",
            ].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-[1px] ${c}`} />
            ))}
            <span className="text-xs text-zinc-600">{round2(maxScore)}</span>
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 12,
            transform: "translateY(-100%)",
          }}
        >
          <HeatmapTooltipCard date={hovered.date} hour={hovered.hour} bucket={hovered.bucket} />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const userId = USER_ID;
  const [timeRange, setTimeRange] = useState("Today");
  const [activeTab, setActiveTab] = useState<"overview" | "focus" | "heatmap">("overview");

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [daily, setDaily] = useState<DailyAnalytics | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse>({});
  const [focusTrend, setFocusTrend] = useState<FocusTrendBucket[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineSession[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [animateGrowth, setAnimateGrowth] = useState(true);
  const { refreshVersion } = useRealtimeRefresh(undefined, { debounceMs: 900 });

  // ── Fetch dashboard ──
  useEffect(() => {
    let cancelled = false;
    setDashboardLoading(true);
    setDashboardError(null);

    fetcher<DashboardResponse>(`${API_BASE}/analytics/dashboard?userId=${userId}`)
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err) => {
        if (!cancelled) setDashboardError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshVersion]);

  // ── Fetch tab data ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setValidations([]);

    const istToday = toISTDateString();

    const promises: Promise<void>[] = [];

    if (activeTab === "overview" || activeTab === "focus") {
      promises.push(
        fetcher<DailyAnalytics>(`${API_BASE}/analytics/daily?userId=${userId}&date=${istToday}`)
          .then((d) => {
            if (!cancelled) {
              const vActive = validateDuration(d.totalActiveSeconds, "Active time");
              const vIdle = validateDuration(d.totalIdleSeconds, "Idle time");
              setValidations((prev) => [...prev, vActive, vIdle]);
              setDaily(d);
            }
          })
          .catch(() => {}),
        fetcher<FocusTrendBucket[]>(
          `${API_BASE}/analytics/daily-focus-trend?userId=${userId}&date=${istToday}&bucketMinutes=60`
        )
          .then((d) => {
            if (!cancelled) setFocusTrend(d);
          })
          .catch(() => {}),
        fetcher<DailySummary>(`${API_BASE}/analytics/daily-summary?userId=${userId}&date=${istToday}`)
          .then((d) => {
            if (!cancelled) setDailySummary(d);
          })
          .catch(() => {})
      );
    }

    if (activeTab === "heatmap") {
      promises.push(
        fetcher<HeatmapResponse>(`${API_BASE}/analytics/heatmap?userId=${userId}`)
          .then((d) => {
            if (!cancelled) setHeatmap(d);
          })
          .catch(() => {}),
        // Fetch timeline for exact activity timestamps
        fetcher<TimelineSession[]>(`${API_BASE}/analytics/timeline?userId=${userId}&date=${istToday}`)
          .then((d) => {
            if (!cancelled) setTimeline(d);
          })
          .catch(() => {})
      );
    }

    Promise.all(promises).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, userId, refreshVersion]);

  // ── Derived chart data ──
  const appUsageChart = useMemo(() => {
    if (!daily?.appUsage) return [];
    const total = Object.values(daily.appUsage).reduce((a, b) => a + b, 0);
    return Object.entries(daily.appUsage)
      .map(([name, durationMs]) => ({
        name,
        durationMs,
        percentage: total > 0 ? round0((durationMs / total) * 100) : 0,
      }))
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 8);
  }, [daily]);

  const categoryChart = useMemo(() => {
    if (!daily?.productivityBreakdown) return [];
    const {
      productiveCount,
      distractingCount,
      neutralCount,
      productiveDurationMs,
      distractingDurationMs,
      neutralDurationMs,
    } = daily.productivityBreakdown;
    const productive = productiveDurationMs ?? productiveCount;
    const distracting = distractingDurationMs ?? distractingCount;
    const neutral = neutralDurationMs ?? neutralCount;
    const total = productive + distracting + neutral;
    if (total === 0) return [];
    return [
      {
        name: "Productive",
        value: round0((productive / total) * 100),
        durationMs: productiveDurationMs ?? 0,
        color: "#a855f7",
      },
      {
        name: "Distracting",
        value: round0((distracting / total) * 100),
        durationMs: distractingDurationMs ?? 0,
        color: "#e11d48",
      },
      {
        name: "Neutral",
        value: round0((neutral / total) * 100),
        durationMs: neutralDurationMs ?? 0,
        color: "#52525b",
      },
    ];
  }, [daily]);

  const productiveAllocation = categoryChart.find((entry) => entry.name === "Productive");
  const distractingAllocation = categoryChart.find((entry) => entry.name === "Distracting");
  const productiveShare = productiveAllocation?.value ?? 0;
  const distractingShare = distractingAllocation?.value ?? 0;
  const productivityBalance = productiveShare - distractingShare;
  const productivityRatio = distractingShare > 0
    ? productiveShare / distractingShare
    : productiveShare > 0
      ? null
      : 0;
  const productivityStatus = productiveShare >= 75
    ? "Strong"
    : productiveShare >= 55
      ? "Balanced"
      : productiveShare >= 35
        ? "Mixed"
        : "Distracted";

  const growthChart = useMemo(() => {
    if (!dashboard?.growth) return [];
    return dashboard.growth.map((g) => ({
      date: g.date,
      label: new Date(`${g.date}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
      }),
      focus: round0(g.focus),
      productivity: round0(g.productivity),
      entropy: round0(g.entropy),
      trackedMinutes: round1(g.trackedMinutes),
      deepWorkMinutes: round1(g.deepWorkMinutes),
      switches: g.switches,
    }));
  }, [dashboard]);

  const weeklyTrackedMinutes = growthChart.reduce((sum, point) => sum + point.trackedMinutes, 0);
  const activeGrowthDays = growthChart.filter((point) => point.trackedMinutes > 0);
  const averageWeeklyProductivity = activeGrowthDays.length > 0
    ? activeGrowthDays.reduce((sum, point) => sum + point.productivity, 0) / activeGrowthDays.length
    : 0;

  useEffect(() => {
    if (growthChart.length === 0 || !animateGrowth) return;
    const timer = window.setTimeout(() => setAnimateGrowth(false), 1200);
    return () => window.clearTimeout(timer);
  }, [growthChart.length, animateGrowth]);

  const intentChart = useMemo(() => {
    if (!dashboard?.intents) return [];
    return dashboard.intents
      .map((i) => ({
        intent: i.intent.replace(/_/g, " "),
        percentage: round0(i.percentage),
        avgFocus: round0(i.avgFocus),
      }))
      .filter((intent) => intent.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 8);
  }, [dashboard]);

  // ── Chart theme ──
  const chartTooltipStyle = {
    backgroundColor: "#09090b",
    border: "1px solid #27272a",
    borderRadius: "8px",
    color: "#e4e4e7",
  };
  const chartGridColor = "#27272a";
  const chartAxisColor = "#52525b";

  const isLoading = dashboardLoading || loading;

  return (
    <div className="dashboard-page flex flex-col text-zinc-100">
      {/* ═══ HEADER ═══ */}
      <div className="samaritan-card mb-3 shrink-0">
        <div className="w-full px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
                <LayoutDashboard className="w-6 h-6 text-purple-500" />
                Analytics
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">Samaritan Intelligence Dashboard</p>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>

          <div className="mt-3 flex w-fit gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            {(
              [
                { id: "overview", label: "Overview", icon: BarChart3 },
                { id: "focus", label: "Focus", icon: Focus },
                { id: "heatmap", label: "Heatmap", icon: Thermometer },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 w-full flex-1 overflow-hidden px-4 py-1 sm:px-5">
        {/* ── Validation Warnings ── */}
        {validations.some((v) => !v.valid) && (
          <div className="mb-6 space-y-2">
            {validations
              .filter((v) => !v.valid)
              .map((v, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  {v.warning}
                </div>
              ))}
          </div>
        )}

        {/* ── Error Banner ── */}
        {(dashboardError || error) && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {dashboardError ?? error}
          </div>
        )}

        {isLoading && !dashboard ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : !dashboard ? (
          <EmptyState message="No analytics data found. Start tracking to see insights." />
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════
                  OVERVIEW
                ═══════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <div className="dashboard-scroll-panel grid h-full min-h-0 auto-rows-max grid-cols-12 content-start gap-3 pr-1">
                <Card className="col-span-12 w-full p-0">
                  <div className="grid min-w-0 gap-4 border-b border-zinc-800 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)] lg:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-400">
                        <BrainCircuit className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h2 className="text-sm font-semibold text-zinc-100">Performance Intelligence</h2>
                          <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-300">
                            Live today + 7 days
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-zinc-400">
                          {dashboard.assistant.suggestion || "Keep building a steady rhythm and protect your strongest focus window."}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                      {dashboard.comparison.change > 0 ? (
                        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : dashboard.comparison.change < 0 ? (
                        <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-300">
                          {dashboard.comparison.change > 0 ? "+" : ""}{round1(dashboard.comparison.change)} focus points vs yesterday
                        </p>
                        <p className="mt-0.5 text-xs leading-4 text-zinc-500">{dashboard.comparison.reason}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-2 border-b border-zinc-800 sm:grid-cols-4 xl:grid-cols-8">
                    {[
                      {
                        label: "Productivity",
                        value: `${round0(dashboard.assistant.productivityScore)}%`,
                        detail: "Weighted impact",
                        icon: Target,
                        tone: "text-emerald-400",
                        score: dashboard.assistant.productivityScore,
                      },
                      {
                        label: "Focus",
                        value: `${round0(dashboard.assistant.focusScore)}%`,
                        detail: "Cognitive quality",
                        icon: Focus,
                        tone: "text-purple-400",
                        score: dashboard.assistant.focusScore,
                      },
                      {
                        label: "Active Time",
                        value: daily ? formatShortDuration(daily.totalActiveSeconds) : "—",
                        detail: `${daily?.totalSessions ?? 0} sessions`,
                        icon: Clock,
                        tone: "text-sky-400",
                      },
                      {
                        label: "Idle Time",
                        value: daily ? formatShortDuration(daily.totalIdleSeconds) : "—",
                        detail: `${round0(daily?.recovery?.idleRatio ?? 0)}% recovery share`,
                        icon: Timer,
                        tone: "text-rose-400",
                      },
                      {
                        label: "Switches",
                        value: `${daily?.totalSwitches ?? 0}`,
                        detail: `${round1(daily?.recovery?.switchesPerHour ?? dashboard.assistant.switchingRate)} per hour`,
                        icon: MousePointerClick,
                        tone: "text-fuchsia-400",
                      },
                      {
                        label: "Stability",
                        value: `${round0(dashboard.assistant.cognitiveStability)}%`,
                        detail: `${round0(dashboard.assistant.fragmentationScore)} fragmentation`,
                        icon: Activity,
                        tone: "text-cyan-400",
                        score: dashboard.assistant.cognitiveStability,
                      },
                      {
                        label: "Deep Work Streak",
                        value: `${dashboard.streak.currentDeepWorkStreak}d`,
                        detail: `Best ${dashboard.streak.longestDeepWorkStreak}d`,
                        icon: Flame,
                        tone: "text-amber-400",
                      },
                      {
                        label: "Burnout Risk",
                        value: dashboard.burnout.burnoutRisk,
                        detail: `${round0(dashboard.burnout.burnoutScore)} risk score`,
                        icon: AlertTriangle,
                        tone:
                          dashboard.burnout.burnoutRisk === "high"
                            ? "text-rose-400"
                            : dashboard.burnout.burnoutRisk === "moderate"
                            ? "text-amber-400"
                            : "text-emerald-400",
                      },
                    ].map((metric, index) => (
                      <div
                        key={metric.label}
                        className={`min-w-0 px-3 py-3.5 sm:px-4 ${index > 0 ? "border-l border-zinc-800" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <metric.icon className={`h-3.5 w-3.5 shrink-0 ${metric.tone}`} />
                          <p className="truncate text-[11px] font-medium uppercase text-zinc-500">{metric.label}</p>
                        </div>
                        <p className={`mt-2 truncate text-xl font-semibold capitalize text-zinc-100 ${metric.label === "Burnout Risk" ? metric.tone : ""}`}>
                          {metric.value}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">{metric.detail}</p>
                        {metric.score !== undefined && (
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-purple-500 transition-[width] duration-700 ease-out"
                              style={{ width: `${clamp(metric.score, 0, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid min-w-0 grid-cols-2 divide-x divide-y divide-zinc-800 sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
                    {[
                      ["7-day focus", `${round0(dashboard.weekly.weeklyFocusScore)}%`],
                      ["7-day productivity", `${round0(averageWeeklyProductivity)}%`],
                      ["Deep work share", `${round0(dashboard.weekly.weeklyDeepWorkRatio)}%`],
                      ["Communication", `${round0(dashboard.weekly.weeklyCommunicationRatio)}%`],
                      ["Peak hour", dashboard.weekly.peakProductiveHour === null ? "—" : `${dashboard.weekly.peakProductiveHour.toString().padStart(2, "0")}:00`],
                      ["Tracked this week", formatShortDuration(weeklyTrackedMinutes * 60)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0 px-4 py-3">
                        <p className="truncate text-[11px] uppercase text-zinc-600">{label}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-zinc-300">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                  <Card className="col-span-12 isolate flex h-[360px] min-h-[360px] w-full shrink-0 flex-col p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <SectionTitle icon={TrendingUp} title="Weekly Growth Trend" />
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-purple-300">
                          Focus {round0(dashboard.weekly.weeklyFocusScore)}%
                        </span>
                        <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                          Productivity {round0(averageWeeklyProductivity)}%
                        </span>
                      </div>
                    </div>
                    {growthChart.length > 0 ? (
                      <div className="relative h-[270px] min-h-[270px] w-full min-w-0 flex-1 overflow-hidden">
                        <LineChart
                          key={`growth-${growthChart.map((point) => point.date).join("-")}`}
                          responsive
                          data={growthChart}
                          margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                          style={{ width: "100%", height: "100%" }}
                        >
                        <defs>
                          <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="label" stroke={chartAxisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke={chartAxisColor} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value, name) => {
                            const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                            return [`${round0(numericValue)}%`, String(name)];
                          }}
                        />
                        <Legend wrapperStyle={{ color: "#71717a" }} />
                        <Line
                          type="monotone"
                          dataKey="focus"
                          name="Focus"
                          stroke="#a855f7"
                          strokeWidth={3}
                          dot={{ r: 3, fill: "#a855f7", stroke: "#09090b", strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: "#f3e8ff", stroke: "#a855f7", strokeWidth: 2 }}
                          connectNulls
                          isAnimationActive={animateGrowth}
                          animationDuration={900}
                          animationEasing="ease-out"
                        />
                        <Line
                          type="monotone"
                          dataKey="productivity"
                          name="Productivity"
                          stroke="#34d399"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ r: 2, fill: "#34d399" }}
                          connectNulls
                          isAnimationActive={animateGrowth}
                          animationDuration={1050}
                          animationEasing="ease-out"
                        />
                        </LineChart>
                      </div>
                    ) : (
                      <div className="flex min-h-[270px] flex-1 items-center justify-center text-sm text-zinc-500">
                        No weekly growth data yet
                      </div>
                    )}
                  </Card>

                  <div className="col-span-12 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
                    <Card className="isolate flex h-[360px] min-h-[360px] w-full shrink-0 flex-col p-4">
                      <SectionTitle icon={BrainCircuit} title="Intent Distribution" />
                      {intentChart.length > 0 ? (
                        <div className="relative min-h-0 w-full flex-1 overflow-hidden">
                          <BarChart
                            responsive
                            data={intentChart}
                            layout="vertical"
                            margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
                            style={{ width: "100%", height: "100%" }}
                          >
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis type="number" domain={[0, 100]} stroke={chartAxisColor} fontSize={11} />
                          <YAxis
                            dataKey="intent"
                            type="category"
                            stroke={chartAxisColor}
                            fontSize={11}
                            width={100}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            cursor={{ fill: "#a855f7", fillOpacity: 0.1 }}
                            formatter={(value, name) => [`${round0(Number(value ?? 0))}%`, String(name)]}
                          />
                          <Legend wrapperStyle={{ color: "#71717a" }} />
                          <Bar
                            dataKey="percentage"
                            name="Time"
                            fill="#a855f7"
                            radius={[0, 4, 4, 0]}
                            maxBarSize={16}
                            isAnimationActive={false}
                          />
                          <Bar
                            dataKey="avgFocus"
                            name="Avg Focus"
                            fill="#3b82f6"
                            radius={[0, 4, 4, 0]}
                            maxBarSize={16}
                            isAnimationActive={false}
                          />
                          </BarChart>
                        </div>
                      ) : (
                        <EmptyState message="No intent data available" />
                      )}
                    </Card>

                    <Card className="isolate flex h-[360px] min-h-[360px] w-full shrink-0 flex-col p-4">
                      <SectionTitle icon={BarChart3} title="App Usage Today" />
                      <div className="dashboard-scroll-panel min-h-0 flex-1 space-y-3 pr-2">
                        {appUsageChart.map((app) => (
                          <div key={app.name} className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
                              {app.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex min-w-0 items-center justify-between gap-3">
                                <span className="truncate text-sm font-medium text-zinc-300">{app.name}</span>
                                <span className="shrink-0 text-xs text-zinc-500">
                                  {formatShortDuration(app.durationMs / 1000)} ({app.percentage}%)
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-zinc-800">
                                <div
                                  className="h-2 rounded-full bg-purple-500 transition-all"
                                  style={{ width: `${app.percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        {appUsageChart.length === 0 && <EmptyState message="No app usage data" />}
                      </div>
                    </Card>

                  <Card className="isolate flex h-[360px] min-h-[360px] w-full shrink-0 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <SectionTitle icon={PieChart} title="Productivity Breakdown" />
                      <span
                        className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${
                          productiveShare >= 55
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : productiveShare >= 35
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                              : "border-rose-500/20 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {productivityStatus}
                      </span>
                    </div>
                    {categoryChart.length > 0 ? (
                      <div className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden">
                        <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(112px,0.75fr)] gap-3 overflow-hidden">
                        <div className="relative min-h-0 min-w-0 overflow-hidden">
                          <PieChart
                            responsive
                            style={{ width: "100%", height: "100%" }}
                          >
                            <Pie
                              data={categoryChart}
                              cx="50%"
                              cy="50%"
                              innerRadius="50%"
                              outerRadius="76%"
                              paddingAngle={4}
                              dataKey="value"
                              stroke="#09090b"
                              strokeWidth={2}
                              isAnimationActive={false}
                            >
                              {categoryChart.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              formatter={(value, name) => [`${round0(Number(value ?? 0))}%`, String(name)]}
                            />
                          </PieChart>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-semibold text-zinc-100">{productiveShare}%</span>
                            <span className="text-[10px] uppercase text-zinc-500">productive</span>
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-col justify-center gap-2.5 border-l border-zinc-800 pl-3">
                          <p className="text-[10px] font-medium uppercase text-zinc-500">Active allocation</p>
                          {categoryChart.map((entry) => (
                            <div key={entry.name} className="min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="truncate text-[11px] text-zinc-400">{entry.name}</span>
                                </div>
                                <span className="shrink-0 text-xs font-semibold text-zinc-200">{entry.value}%</span>
                              </div>
                              <p className="mt-0.5 pl-[18px] text-[11px] text-zinc-600">
                                {formatShortDuration(entry.durationMs / 1000)}
                              </p>
                            </div>
                          ))}
                        </div>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-zinc-800 border-t border-zinc-800 pt-3">
                          <div className="min-w-0 pr-2">
                            <p className="truncate text-[9px] uppercase text-zinc-600">Active time</p>
                            <p className="mt-1 truncate text-xs font-semibold text-zinc-300">
                              {formatShortDuration(daily?.totalActiveSeconds ?? 0)}
                            </p>
                          </div>
                          <div className="min-w-0 px-2">
                            <p className="truncate text-[9px] uppercase text-zinc-600">Net balance</p>
                            <p className={`mt-1 truncate text-xs font-semibold ${productivityBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {productivityBalance > 0 ? "+" : ""}{productivityBalance} pts
                            </p>
                          </div>
                          <div className="min-w-0 pl-2">
                            <p className="truncate text-[9px] uppercase text-zinc-600">P:D ratio</p>
                            <p className="mt-1 truncate text-xs font-semibold text-zinc-300">
                              {productivityRatio === null ? "No distraction" : `${round1(productivityRatio)}x`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState message="No category data available" />
                    )}
                  </Card>
                  </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                  FOCUS
                ═══════════════════════════════════════════════════ */}
            {activeTab === "focus" && (
              <div className="dashboard-scroll-panel grid min-h-0 grid-cols-12 gap-3 pr-1">
                {dailySummary && (
                  <div className="col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Deep Work</p>
                          <p className="text-lg font-bold text-zinc-100">{round1(dailySummary.deepWorkHours)}h</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Focus className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Focus Score</p>
                          <p className="text-lg font-bold text-zinc-100">{round0(dailySummary.focusScore)}%</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Timer className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Longest Block</p>
                          <p className="text-lg font-bold text-zinc-100">{dailySummary.longestFocusBlockMinutes}m</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                <Card className="dashboard-grid-card col-span-12 min-h-[430px] p-4">
                  <SectionTitle icon={Activity} title="Hourly Focus Trend (IST)" />
                  <ResponsiveContainer width="100%" height={380}>
                    <AreaChart data={focusTrend}>
                      <defs>
                        <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="label" stroke={chartAxisColor} fontSize={12} />
                      <YAxis domain={[0, 100]} stroke={chartAxisColor} fontSize={12} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value) => [
                          typeof value === "number" ? `${round0(value)}%` : "—",
                          "Focus",
                        ]}
                      />
                      <Area type="monotone" dataKey="focus" stroke="#a855f7" fill="url(#focusGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                  HEATMAP
                ═══════════════════════════════════════════════════ */}
            {activeTab === "heatmap" && (
              <div className="dashboard-scroll-panel grid min-h-0 grid-cols-12 gap-3 pr-1">
                <Card className="dashboard-grid-card col-span-12 min-h-[420px] p-4">
                  <SectionTitle icon={Thermometer} title="Activity Heatmap (IST Hours)" />
                  <p className="text-sm text-zinc-500 mb-4">
                    Raw productivity score by hour. Colors normalized to actual min/max range. Hover cells for detail.
                  </p>
                  <HeatmapGrid data={heatmap} />
                </Card>

                {/* ── Recent Hourly Breakdown — exact timeline logs grouped by IST hour ── */}
                <Card className="dashboard-scroll-panel col-span-12 min-h-[320px] p-4">
                  <SectionTitle icon={Clock} title="Recent Hourly Breakdown" />
                  <p className="text-sm text-zinc-500 mb-4">
                    Timeline sessions grouped by hour with nested tracks, pages, and exact timestamps.
                  </p>
                  <HourlyBreakdown sessions={timeline ?? []} />
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
