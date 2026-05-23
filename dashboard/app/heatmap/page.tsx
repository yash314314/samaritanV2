"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Download,
  BarChart3,
  Layers,
  Clock,
  Zap,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Activity,
} from "lucide-react";
import { fetchHeatmap, fetchTimeline } from "../../lib/api";
import HeatmapGrid from "../../components/HeatmapGrid";
import HeatmapInsights from "../../components/HeatmapInsights";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

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

interface TimelineItem {
  title: string;
  iconUrl: string | null;
  domain: string | null;
  url: string | null;
  start: string;
  end: string;
  duration: number;
}

interface TimelineSession {
  appName: string;
  iconUrl: string | null;
  domain: string | null;
  url: string | null;
  start: string;
  end: string;
  duration: number;
  category: string;
  items: TimelineItem[];
}

type ViewMode = "score" | "productivity" | "duration";
type DatePreset = "today" | "week" | "month";

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function toIST(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

function toISODate(d: Date): string {
  return toIST(d).toISOString().split("T")[0];
}

function startOfWeek(d: Date): Date {
  const ist = toIST(d);
  const day = ist.getDay();
  ist.setDate(ist.getDate() - day);
  ist.setHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function formatHMS(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m.toString().padStart(2, "0")}m`);
  parts.push(`${s.toString().padStart(2, "0")}s`);
  return parts.join(" ");
}

function formatTimeIST(iso: string): string {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// ═══════════════════════════════════════════════════════════
//  UI PRIMITIVES
// ═══════════════════════════════════════════════════════════

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-zinc-900 rounded-xl border border-zinc-800 shadow-sm ${className}`}>{children}</div>
);

const SkeletonCell = () => <div className="h-6 rounded-sm bg-zinc-800 animate-pulse" />;

const HeatmapSkeleton = () => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="min-w-[600px] space-y-1">
      <div className="flex">
        <div className="w-16 flex-shrink-0" />
        {hours.map((h) => (
          <div key={h} className="flex-1 text-center text-xs text-zinc-700 py-1">
            {h}
          </div>
        ))}
      </div>
      {Array.from({ length: 7 }).map((_, d) => (
        <div key={d} className="flex items-center py-0.5">
          <div className="w-16 flex-shrink-0 pr-2">
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-10" />
          </div>
          {hours.map((h) => (
            <div key={h} className="flex-1 px-0.5">
              <SkeletonCell />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const InsightsSkeleton = () => (
  <Card className="p-6 h-full">
    <div className="animate-pulse space-y-4">
      <div className="h-5 bg-zinc-800 rounded w-2/3" />
      <div className="h-4 bg-zinc-800 rounded w-full" />
      <div className="h-4 bg-zinc-800 rounded w-5/6" />
      <div className="h-4 bg-zinc-800 rounded w-3/4" />
      <div className="h-4 bg-zinc-800 rounded w-full" />
      <div className="h-4 bg-zinc-800 rounded w-1/2" />
    </div>
  </Card>
);

const TimelineSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="bg-zinc-900/60 px-4 py-2.5 border-b border-zinc-800">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-16" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-8 bg-zinc-800 rounded animate-pulse w-full" />
          <div className="h-8 bg-zinc-800 rounded animate-pulse w-5/6" />
        </div>
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════
//  HOUR DETAIL DRAWER
// ═══════════════════════════════════════════════════════════

const HourDetailDrawer = ({
  open,
  onClose,
  date,
  hour,
  bucket,
  timelineSessions,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  hour: number;
  bucket: HeatmapBucket | null;
  timelineSessions: TimelineSession[];
}) => {
  if (!open || !bucket) return null;

  const hourTotalMs = bucket.duration;
  const filteredSessions = timelineSessions.filter((s) => {
    const d = toIST(new Date(s.start));
    return d.getHours() === hour;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider">{date}</p>
            <h2 className="text-xl font-bold text-white">
              {hour}:00 – {hour + 1}:00 <span className="text-zinc-500 text-base font-normal">IST</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Duration</p>
              <p className="text-2xl font-bold text-white mt-1">{formatHMS(hourTotalMs / 1000)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Raw Score</p>
              <p className="text-2xl font-bold text-purple-400 mt-1 font-mono">
                {bucket.score.toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Productivity</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {bucket.productivity.toFixed(0)}%
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Idle</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{bucket.idleMinutes}m</p>
            </Card>
          </div>

          {/* Categories */}
          {bucket.categoryBreakdown && bucket.categoryBreakdown.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-500" />
                Category Breakdown
              </h3>
              <div className="space-y-2">
                {bucket.categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-20 text-right">{cat.name}</span>
                    <span className="text-xs text-zinc-500 font-mono w-12 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apps */}
          {bucket.topApps && bucket.topApps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                App Usage
              </h3>
              <div className="space-y-2">
                {bucket.topApps.map((app) => (
                  <div
                    key={app.name}
                    className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                        {app.name[0]}
                      </div>
                      <span className="text-sm text-zinc-300">{app.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-200">{app.minutes}m</p>
                      <p className="text-xs text-zinc-500">{app.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {filteredSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-500" />
                Session Log ({filteredSessions.length})
              </h3>
              <div className="space-y-3">
                {filteredSessions.map((session, idx) => (
                  <div key={idx} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {session.iconUrl ? (
                          <img
                            src={session.iconUrl}
                            alt=""
                            className="w-5 h-5 rounded object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                            {session.appName[0]}
                          </div>
                        )}
                        <span className="text-sm font-medium text-zinc-200">{session.appName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                          {session.category}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">
                        {formatHMS(session.duration / 1000)}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-mono mb-2">
                      {formatTimeIST(session.start)} – {formatTimeIST(session.end)}
                    </p>
                    {session.items && session.items.length > 0 && (
                      <div className="space-y-1 pl-2 border-l-2 border-zinc-800">
                        {session.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 py-0.5">
                            {item.iconUrl && (
                              <img
                                src={item.iconUrl}
                                alt=""
                                className="w-3 h-3 rounded object-contain opacity-60"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            <span className="text-xs text-zinc-500 truncate flex-1">
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
                ))}
              </div>
            </div>
          )}

          {filteredSessions.length === 0 && (
            <div className="text-center py-8 text-zinc-600 text-sm">
              No timeline sessions recorded for this hour.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function HeatmapPage() {
  // ── Date navigation ──
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [preset, setPreset] = useState<DatePreset>("week");

  // ── Data ──
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── View controls ──
  const [viewMode, setViewMode] = useState<ViewMode>("score");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // ── Drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTarget, setDrawerTarget] = useState<{
    date: string;
    hour: number;
    bucket: HeatmapBucket;
  } | null>(null);

  // ── Derived dates ──
  const weekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);
  const dateRangeLabel = useMemo(() => {
    const s = toISODate(currentWeekStart);
    const e = toISODate(weekEnd);
    return `${s} → ${e}`;
  }, [currentWeekStart, weekEnd]);

  // ── Fetch ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = toISODate(currentWeekStart);
      const to = toISODate(weekEnd);

      const [hData, tData] = await Promise.all([
        fetchHeatmap(USER_ID, from),
        fetchTimeline(USER_ID, from),
      ]);

      setHeatmap(hData ?? null);
      setTimeline(Array.isArray(tData) ? tData : []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load heatmap data");
      console.error("Heatmap fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart, weekEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Navigation ──
  const goPrevWeek = () => setCurrentWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setCurrentWeekStart((d) => addDays(d, 7));
  const goToday = () => setCurrentWeekStart(startOfWeek(new Date()));

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goPrevWeek();
      }
      if (e.key === "ArrowRight" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goNextWeek();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Export ──
  const handleExport = () => {
    if (!heatmap) return;
    const rows: any[] = [];
    Object.entries(heatmap).forEach(([date, day]) => {
      Object.entries(day).forEach(([hour, bucket]) => {
        rows.push({
          date,
          hour: Number(hour),
          score: bucket.score,
          productivity: bucket.productivity,
          durationMs: bucket.duration,
          trackedMinutes: bucket.trackedMinutes,
          idleMinutes: bucket.idleMinutes,
          dominantApp: bucket.dominantApp,
          dominantCategory: bucket.dominantCategory,
          dominantIntent: bucket.dominantIntent,
        });
      });
    });
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `samaritan-heatmap-${toISODate(currentWeekStart)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Drawer trigger ──
  const openDrawer = (date: string, hour: number, bucket: HeatmapBucket) => {
    setDrawerTarget({ date, hour, bucket });
    setDrawerOpen(true);
  };

  // ── Category options from data ──
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    if (!heatmap) return [];
    Object.values(heatmap).forEach((day) => {
      Object.values(day).forEach((bucket) => {
        bucket.categoryBreakdown?.forEach((c) => set.add(c.name));
      });
    });
    return Array.from(set).sort();
  }, [heatmap]);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* ═══ HEADER ═══ */}
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Zap className="w-6 h-6 text-purple-500" />
                Temporal Heatmap
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Deep-dive into your hourly cognitive patterns
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Presets */}
              <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                {(["today", "week", "month"] as DatePreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPreset(p);
                      if (p === "today" || p === "week") setCurrentWeekStart(startOfWeek(new Date()));
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      preset === p
                        ? "bg-zinc-800 text-zinc-100 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
                  </button>
                ))}
              </div>

              {/* Week nav */}
              <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800">
                <button
                  onClick={goPrevWeek}
                  className="p-2 hover:bg-zinc-800 text-zinc-400 rounded-l-lg transition-colors"
                  title="Previous week (Ctrl + ←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-2 text-xs font-medium text-zinc-300 font-mono border-x border-zinc-800 flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3 text-zinc-500" />
                  {dateRangeLabel}
                </div>
                <button
                  onClick={goNextWeek}
                  className="p-2 hover:bg-zinc-800 text-zinc-400 rounded-r-lg transition-colors"
                  title="Next week (Ctrl + →)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={goToday}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Today
              </button>

              <button
                onClick={handleExport}
                disabled={!heatmap || loading}
                className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
            {/* View mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Color by</span>
              <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                {([
                  { key: "score", label: "Raw Score" },
                  { key: "productivity", label: "Productivity" },
                  { key: "duration", label: "Duration" },
                ] as { key: ViewMode; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setViewMode(m.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      viewMode === m.key
                        ? "bg-zinc-800 text-purple-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-zinc-500" />
                <select
                  value={categoryFilter ?? ""}
                  onChange={(e) => setCategoryFilter(e.target.value || null)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 px-2.5 py-1.5 outline-none focus:border-purple-500"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 ml-auto">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing with Samaritan agent…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Heatmap */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-zinc-500" />
                Activity Grid
              </h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {viewMode === "score" && "Normalized raw productivity score per hour"}
                {viewMode === "productivity" && "Productivity percentage per hour"}
                {viewMode === "duration" && "Total tracked duration per hour"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">Low</span>
              <div className="flex gap-1">
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
              </div>
              <span className="text-xs text-zinc-600">High</span>
            </div>
          </div>

          {loading && !heatmap ? (
            <div className="overflow-x-auto">
              <HeatmapSkeleton />
            </div>
          ) : heatmap ? (
            <HeatmapGrid
              data={heatmap}
              viewMode={viewMode}
              categoryFilter={categoryFilter}
              onCellClick={openDrawer}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
              No heatmap data for selected range.
            </div>
          )}
        </Card>

        {/* Insights + Timeline split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Insights — NULL-GUARDED */}
          <div className="lg:col-span-1">
            {heatmap && !loading ? (
              <HeatmapInsights data={heatmap} />
            ) : (
              <InsightsSkeleton />
            )}
          </div>

          {/* Timeline */}
          <div className="lg:col-span-2">
            <Card className="p-6 h-full">
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-500" />
                Hourly Timeline
              </h3>

              {loading ? (
                <TimelineSkeleton />
              ) : timeline.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {Array.from(
                    timeline
                      .reduce((map, s) => {
                        const h = toIST(new Date(s.start)).getHours();
                        if (!map.has(h)) map.set(h, []);
                        map.get(h)!.push(s);
                        return map;
                      }, new Map<number, TimelineSession[]>())
                      .entries()
                  )
                    .sort((a, b) => b[0] - a[0])
                    .map(([hour, sessions]) => {
                      const totalMs = sessions.reduce((sum, s) => sum + s.duration, 0);
                      return (
                        <div key={hour} className="border border-zinc-800 rounded-xl overflow-hidden">
                          <div className="bg-zinc-900/60 px-4 py-2.5 flex items-center justify-between border-b border-zinc-800">
                            <span className="text-sm font-bold text-zinc-300">
                              {hour.toString().padStart(2, "0")}:00
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">
                              {formatHMS(totalMs / 1000)} • {sessions.length} sessions
                            </span>
                          </div>
                          <div className="divide-y divide-zinc-800/50">
                            {sessions.slice(0, 4).map((s, i) => (
                              <div
                                key={i}
                                className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors"
                              >
                                {s.iconUrl ? (
                                  <img
                                    src={s.iconUrl}
                                    alt=""
                                    className="w-6 h-6 rounded object-contain shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold shrink-0">
                                    {s.appName[0]}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-300 font-medium truncate">
                                      {s.appName}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      {formatHMS(s.duration / 1000)}
                                    </span>
                                  </div>
                                  {s.items && s.items[0] && (
                                    <p className="text-[10px] text-zinc-600 truncate mt-0.5">
                                      {s.items[0].title}
                                      {s.items.length > 1 && ` +${s.items.length - 1} more`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {sessions.length > 4 && (
                              <div className="px-4 py-2 text-center text-xs text-zinc-600">
                                +{sessions.length - 4} more sessions
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
                  No timeline data available for this range.
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      <HourDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        date={drawerTarget?.date ?? ""}
        hour={drawerTarget?.hour ?? 0}
        bucket={drawerTarget?.bucket ?? null}
        timelineSessions={timeline}
      />
    </div>
  );
}