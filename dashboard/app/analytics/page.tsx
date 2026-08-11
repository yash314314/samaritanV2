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
  CheckCircle2,
  Timer,
  MousePointerClick,
  BarChart3,
  Thermometer,
  LayoutDashboard,
  Focus,
  ShieldAlert,
} from "lucide-react";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";

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
  entropy: number;
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
  };
  averageEntropyScore: number;
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
  topApps: { name: string; duration: number; minutes: number; percentage: number }[];
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
  <div className={`samaritan-card ${className}`}>{children}</div>
);

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = "purple",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  color?: "purple" | "emerald" | "amber" | "rose";
}) => {
  const colorMap = {
    purple: "bg-purple-500/10 text-purple-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    rose: "bg-rose-500/10 text-rose-400",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <h3 className="text-2xl font-bold text-zinc-100">{value}</h3>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          {trend === "up" ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : trend === "down" ? (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          ) : (
            <Minus className="w-4 h-4 text-zinc-500" />
          )}
          <span
            className={`text-sm font-medium ${
              trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-zinc-500"
            }`}
          >
            {trendValue}
          </span>
        </div>
      )}
    </Card>
  );
};

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
              <div key={app.name} className="flex items-center gap-2 bg-zinc-900/60 rounded-lg p-1.5">
                <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">
                  {app.name[0]}
                </div>
                <span className="text-zinc-200 text-xs flex-1 truncate">{app.name}</span>
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
        fetcher<DailyAnalytics>(`${API_BASE}/analytics/daily?userId=${userId}`)
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
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? round0((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [daily]);

  const categoryChart = useMemo(() => {
    if (!daily?.productivityBreakdown) return [];
    const { productiveCount, distractingCount, neutralCount } = daily.productivityBreakdown;
    const total = productiveCount + distractingCount + neutralCount;
    if (total === 0) return [];
    return [
      { name: "Productive", value: round0((productiveCount / total) * 100), color: "#a855f7" },
      { name: "Distracting", value: round0((distractingCount / total) * 100), color: "#7c3aed" },
      { name: "Neutral", value: round0((neutralCount / total) * 100), color: "#52525b" },
    ];
  }, [daily]);

  const growthChart = useMemo(() => {
    if (!dashboard?.growth) return [];
    return dashboard.growth.map((g) => ({
      date: g.date.slice(5),
      focus: round0(g.focus),
      entropy: round0(g.entropy),
    }));
  }, [dashboard]);

  const intentChart = useMemo(() => {
    if (!dashboard?.intents) return [];
    return dashboard.intents.map((i) => ({
      intent: i.intent,
      percentage: round0(i.percentage),
      avgFocus: round0(i.avgFocus),
    }));
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
    <div className="min-h-screen bg-black text-zinc-100">
      {/* ═══ HEADER ═══ */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-purple-500" />
                Analytics
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">Samaritan Intelligence Dashboard</p>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>

          <div className="mt-5 flex gap-1 bg-zinc-950 p-1 rounded-lg w-fit border border-zinc-800">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <div className="space-y-6">
                {dashboard.assistant.suggestion && (
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-start gap-3">
                    <BrainCircuit className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-purple-300 text-sm">Samaritan Assistant</p>
                      <p className="text-purple-400/80 text-sm mt-0.5">{dashboard.assistant.suggestion}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Productivity Score"
                    value={`${round0(dashboard.assistant.productivityScore)}%`}
                    subtitle="Weighted by focus impact"
                    icon={Target}
                    color="emerald"
                    trend={
                      dashboard.comparison.change > 0
                        ? "up"
                        : dashboard.comparison.change < 0
                        ? "down"
                        : "stable"
                    }
                    trendValue={`${dashboard.comparison.change > 0 ? "+" : ""}${round0(
                      dashboard.comparison.change
                    )} vs yesterday`}
                  />
                  <StatCard
                    title="Focus Score"
                    value={`${round0(dashboard.assistant.focusScore)}%`}
                    subtitle="Cognitive load weighted"
                    icon={Focus}
                    color="purple"
                  />
                  <StatCard
                    title="Deep Work Streak"
                    value={`${dashboard.streak.currentDeepWorkStreak} days`}
                    subtitle={`Best: ${dashboard.streak.longestDeepWorkStreak} days`}
                    icon={Flame}
                    color="amber"
                  />
                  <StatCard
                    title="Burnout Risk"
                    value={dashboard.burnout.burnoutRisk}
                    subtitle={dashboard.burnout.recommendation}
                    icon={AlertTriangle}
                    color={
                      dashboard.burnout.burnoutRisk === "high"
                        ? "rose"
                        : dashboard.burnout.burnoutRisk === "moderate"
                        ? "amber"
                        : "emerald"
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-purple-500/10 rounded-lg">
                      <MousePointerClick className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Context Switches</p>
                      <p className="text-lg font-semibold text-zinc-100">{daily?.totalSwitches ?? 0}</p>
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-zinc-800 rounded-lg">
                      <Clock className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Active Time</p>
                      <p className="text-lg font-semibold text-zinc-100">
                        {daily ? formatShortDuration(daily.totalActiveSeconds) : "—"}
                      </p>
                      <ValidationBadge result={validateDuration(daily?.totalActiveSeconds ?? 0, "Active")} />
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-rose-500/10 rounded-lg">
                      <Timer className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Idle Time</p>
                      <p className="text-lg font-semibold text-zinc-100">
                        {daily ? formatShortDuration(daily.totalIdleSeconds) : "—"}
                      </p>
                      <ValidationBadge result={validateDuration(daily?.totalIdleSeconds ?? 0, "Idle")} />
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <SectionTitle icon={TrendingUp} title="Weekly Growth Trend" />
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={growthChart}>
                        <defs>
                          <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="date" stroke={chartAxisColor} fontSize={12} />
                        <YAxis domain={[0, 100]} stroke={chartAxisColor} fontSize={12} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={{ color: "#71717a" }} />
                        <Area
                          type="monotone"
                          dataKey="focus"
                          name="Focus Score"
                          stroke="#a855f7"
                          fill="url(#colorFocus)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="entropy"
                          name="Entropy"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6">
                    <SectionTitle icon={BrainCircuit} title="Intent Distribution" />
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={intentChart} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis type="number" stroke={chartAxisColor} fontSize={12} />
                        <YAxis
                          dataKey="intent"
                          type="category"
                          stroke={chartAxisColor}
                          fontSize={12}
                          width={80}
                        />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={{ color: "#71717a" }} />
                        <Bar dataKey="percentage" name="Time %" fill="#a855f7" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="avgFocus" name="Avg Focus" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <SectionTitle icon={BarChart3} title="App Usage Today" />
                    <div className="space-y-3">
                      {appUsageChart.map((app) => (
                        <div key={app.name} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                            {app.name[0]}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-zinc-300">{app.name}</span>
                              <span className="text-xs text-zinc-500">
                                {app.count} activities ({app.percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-2">
                              <div
                                className="bg-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${app.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {appUsageChart.length === 0 && <EmptyState message="No app usage data" />}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <SectionTitle icon={PieChart} title="Productivity Breakdown" />
                    {categoryChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={categoryChart}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {categoryChart.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend wrapperStyle={{ color: "#71717a" }} />
                        </PieChart>
                      </ResponsiveContainer>
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
              <div className="space-y-6">
                {dailySummary && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <Card className="p-6">
                  <SectionTitle icon={Activity} title="Hourly Focus Trend (IST)" />
                  <ResponsiveContainer width="100%" height={300}>
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
              <div className="space-y-6">
                <Card className="p-6">
                  <SectionTitle icon={Thermometer} title="Activity Heatmap (IST Hours)" />
                  <p className="text-sm text-zinc-500 mb-4">
                    Raw productivity score by hour. Colors normalized to actual min/max range. Hover cells for detail.
                  </p>
                  <HeatmapGrid data={heatmap} />
                </Card>

                {/* ── Recent Hourly Breakdown — exact timeline logs grouped by IST hour ── */}
                <Card className="p-6">
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
