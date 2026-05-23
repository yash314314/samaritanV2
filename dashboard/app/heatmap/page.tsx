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
  Eye,
  EyeOff,
  X,
  ExternalLink,
  Monitor,
  Globe,
  FileText,
  Timer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchHeatmap, fetchTimeline } from "../../lib/api";
import HeatmapInsights from "../../components/HeatmapInsights";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface HeatmapBucket {
  score: number;
  productivity: number;
  focus: number;
  duration: number;
  idleRatio: number;
  colorValue: number;
  colorMode: string;
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

type ViewMode = "score" | "productivity" | "duration" | "focus" | "idle";
type TimeScale = "today" | "week" | "month" | "custom";

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function toISODateIST(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function getISTHour(iso: string): number {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours();
}

function getISTDateKey(iso: string): string {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

function startOfWeekIST(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getDay();
  ist.setUTCDate(ist.getUTCDate() - day);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000);
}

function startOfMonthIST(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(1);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000);
}

function endOfMonthIST(): Date {
  const start = startOfMonthIST();
  const nextMonth = new Date(start);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  nextMonth.setUTCHours(23, 59, 59, 999);
  return nextMonth;
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setUTCDate(n.getUTCDate() + days);
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
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDateFull(iso: string): string {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function round2(n: number): number {
  return Number((isFinite(n) ? n : 0).toFixed(2));
}

// ═══════════════════════════════════════════════════════════
//  HEATMAP COLOUR CONFIG
// ═══════════════════════════════════════════════════════════

const colorScales: Record<ViewMode, string[]> = {
  score: [
    "bg-zinc-950", "bg-purple-950/40", "bg-purple-950", "bg-purple-900/80",
    "bg-purple-900", "bg-purple-800/80", "bg-purple-800", "bg-purple-700",
    "bg-purple-600", "bg-purple-500", "bg-purple-400",
  ],
  productivity: [
    "bg-zinc-950", "bg-emerald-950/40", "bg-emerald-950", "bg-emerald-900/80",
    "bg-emerald-900", "bg-emerald-800/80", "bg-emerald-800", "bg-emerald-700",
    "bg-emerald-600", "bg-emerald-500", "bg-emerald-400",
  ],
  duration: [
    "bg-zinc-950", "bg-blue-950/40", "bg-blue-950", "bg-blue-900/80",
    "bg-blue-900", "bg-blue-800/80", "bg-blue-800", "bg-blue-700",
    "bg-blue-600", "bg-blue-500", "bg-blue-400",
  ],
  focus: [
    "bg-zinc-950", "bg-cyan-950/40", "bg-cyan-950", "bg-cyan-900/80",
    "bg-cyan-900", "bg-cyan-800/80", "bg-cyan-800", "bg-cyan-700",
    "bg-cyan-600", "bg-cyan-500", "bg-cyan-400",
  ],
  idle: [
    "bg-zinc-950", "bg-rose-950/40", "bg-rose-950", "bg-rose-900/80",
    "bg-rose-900", "bg-rose-800/80", "bg-rose-800", "bg-rose-700",
    "bg-rose-600", "bg-rose-500", "bg-rose-400",
  ],
};

function getMetricValue(bucket: HeatmapBucket, mode: ViewMode): number {
  switch (mode) {
    case "score": return bucket.score;
    case "productivity": return bucket.productivity;
    case "duration": return bucket.duration;
    case "focus": return bucket.focus * 100;
    case "idle": return bucket.idleRatio * 100;
  }
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
          <div key={h} className="flex-1 text-center text-xs text-zinc-700 py-1">{h}</div>
        ))}
      </div>
      {Array.from({ length: 7 }).map((_, d) => (
        <div key={d} className="flex items-center py-0.5">
          <div className="w-16 flex-shrink-0 pr-2">
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-10" />
          </div>
          {hours.map((h) => (
            <div key={h} className="flex-1 px-0.5"><SkeletonCell /></div>
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
    </div>
  </Card>
);

const AppIcon = ({
  src,
  appName,
  size = 24,
  className = "",
}: {
  src: string | null;
  appName: string;
  size?: number;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`rounded bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {appName.charAt(0).toUpperCase()}
      </div>
    );
  }
  const isBase64 = src.startsWith("data:");
  const isAbsolute = src.startsWith("http") || src.startsWith("/");
  return (
    <img
      src={isAbsolute || isBase64 ? src : `/icons/apps/${src}`}
      alt={appName}
      className={`rounded object-contain shrink-0 bg-zinc-900/50 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
};

// ═══════════════════════════════════════════════════════════
//  HEATMAP GRID — inline, respects viewMode
// ═══════════════════════════════════════════════════════════

const HeatmapTooltipCard = ({
  date,
  hour,
  bucket,
  viewMode,
}: {
  date: string;
  hour: number;
  bucket: HeatmapBucket;
  viewMode: ViewMode;
}) => {
  const rawMetric = getMetricValue(bucket, viewMode);
  
  // Format metric for display based on type
  const metricDisplay = useMemo(() => {
    switch (viewMode) {
      case "duration":
        return formatHMS(rawMetric / 1000); // ms → seconds
      case "focus":
      case "idle":
      case "productivity":
        return `${round2(rawMetric)}%`;
      case "score":
      default:
        return round2(rawMetric);
    }
  }, [rawMetric, viewMode]);

  const metricLabel = viewMode === "duration" ? "Duration" : 
                      viewMode === "focus" ? "Focus" :
                      viewMode === "idle" ? "Idle" :
                      viewMode === "productivity" ? "Productivity" : "Score";

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
          <p className="text-zinc-500 text-xs">{bucket.trackedMinutes}m tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-900/60 rounded-lg p-2 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{metricLabel}</p>
          <p className="text-sm font-bold text-purple-400 font-mono">{metricDisplay}</p>
        </div>
        <div className="bg-zinc-900/60 rounded-lg p-2 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Productivity</p>
          <p className="text-sm font-bold text-emerald-400 font-mono">{round2(bucket.productivity)}%</p>
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

const HeatmapGrid = ({
  data,
  viewMode,
  showEmpty,
  onCellClick,
}: {
  data: HeatmapResponse;
  viewMode: ViewMode;
  showEmpty: boolean;
  onCellClick: (date: string, hour: number, bucket: HeatmapBucket) => void;
}) => {
  const dates = useMemo(() => Object.keys(data).sort(), [data]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let hasData = false;
    dates.forEach((date) => {
      hours.forEach((h) => {
        const bucket = data[date]?.[h];
        if (bucket && (showEmpty || bucket.duration > 0)) {
          hasData = true;
          const val = getMetricValue(bucket, viewMode);
          if (isFinite(val)) {
            min = Math.min(min, val);
            max = Math.max(max, val);
          }
        }
      });
    });
    if (!hasData) return { minVal: 0, maxVal: 1 };
    if (min === max) return { minVal: 0, maxVal: Math.max(max, 1) };
    return { minVal: min, maxVal: max };
  }, [data, dates, hours, viewMode, showEmpty]);

  const getColor = (bucket: HeatmapBucket | undefined) => {
    if (!bucket) return "bg-zinc-950";
    const val = getMetricValue(bucket, viewMode);
    if (!isFinite(val)) return "bg-zinc-950";
    if (bucket.duration === 0 && !showEmpty) return "bg-zinc-950";

    const normalized = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0;
    const scale = colorScales[viewMode];

    if (normalized === 0) return scale[0];
    if (normalized < 0.1) return scale[1];
    if (normalized < 0.2) return scale[2];
    if (normalized < 0.3) return scale[3];
    if (normalized < 0.4) return scale[4];
    if (normalized < 0.5) return scale[5];
    if (normalized < 0.6) return scale[6];
    if (normalized < 0.7) return scale[7];
    if (normalized < 0.8) return scale[8];
    if (normalized < 0.9) return scale[9];
    return scale[10];
  };

  const [hovered, setHovered] = useState<{ date: string; hour: number; bucket: HeatmapBucket } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (date: string, hour: number, bucket: HeatmapBucket | undefined, e: React.MouseEvent) => {
    if (!bucket || bucket.duration === 0) return;
    setHovered({ date, hour, bucket });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hovered) setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => setHovered(null);

  if (dates.length === 0) {
    return <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">No heatmap data available</div>;
  }

  return (
    <div className="relative" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex">
            <div className="w-16 flex-shrink-0" />
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-xs text-zinc-600 py-1">{h}</div>
            ))}
          </div>
          {dates.slice(-7).map((date) => (
            <div key={date} className="flex items-center py-0.5">
              <div className="w-16 flex-shrink-0 text-xs text-zinc-500 pr-2">{date.slice(5)}</div>
              {hours.map((h) => {
                const bucket = data[date]?.[h];
                const isEmpty = !bucket || bucket.duration === 0;
                if (isEmpty && !showEmpty) return <div key={h} className="flex-1 px-0.5" />;
                return (
                  <div key={h} className="flex-1 px-0.5">
                    <div
                      className={`h-6 rounded-sm ${getColor(bucket)} cursor-crosshair transition-all hover:ring-2 hover:ring-white/30 relative`}
                      onMouseEnter={(e) => handleMouseEnter(date, h, bucket, e)}
                      onClick={() => bucket && onCellClick(date, h, bucket)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-3 ml-16">
            <span className="text-xs text-zinc-600">{round2(minVal)}</span>
            {colorScales[viewMode].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-[1px] ${c}`} />
            ))}
            <span className="text-xs text-zinc-600">{round2(maxVal)}</span>
          </div>
        </div>
      </div>

      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 12, transform: "translateY(-100%)" }}
        >
          <HeatmapTooltipCard date={hovered.date} hour={hovered.hour} bucket={hovered.bucket} viewMode={viewMode} />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  SESSION DETAIL MODAL — hooks fixed (always before return)
// ═══════════════════════════════════════════════════════════

const SessionDetailModal = ({
  session,
  open,
  onClose,
}: {
  session: TimelineSession | null;
  open: boolean;
  onClose: () => void;
}) => {
  const [itemsExpanded, setItemsExpanded] = useState(true);

  // FIXED: useMemo must be called before any early return
  const domainStats = useMemo(() => {
    if (!session) return [] as { name: string; count: number; duration: number }[];
    const map = new Map<string, { count: number; duration: number }>();
    session.items?.forEach((item) => {
      const key = item.domain || item.title || "Unknown";
      const existing = map.get(key) || { count: 0, duration: 0 };
      existing.count += 1;
      existing.duration += item.duration;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.duration - a.duration);
  }, [session]);

  if (!open || !session) return null;

  const sessionStart = new Date(session.start);
  const sessionEnd = new Date(session.end);
  const sessionDurationSec = session.duration / 1000;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-start justify-between z-10">
          <div className="flex items-start gap-4">
            <AppIcon src={session.iconUrl} appName={session.appName} size={48} className="rounded-xl" />
            <div>
              <h2 className="text-xl font-bold text-white">{session.appName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase font-semibold tracking-wider">
                  {session.category}
                </span>
                {session.domain && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {session.domain}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                {formatDateFull(session.start)} • {formatTimeIST(session.start)} – {formatTimeIST(session.end)} IST
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Duration</p>
              <p className="text-xl font-bold text-white mt-1 font-mono">{formatHMS(sessionDurationSec)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Tracks</p>
              <p className="text-xl font-bold text-purple-400 mt-1 font-mono">{session.items?.length ?? 0}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Domains</p>
              <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">{domainStats.length}</p>
            </Card>
          </div>

          {session.url && (
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
              <ExternalLink className="w-4 h-4 text-zinc-500 shrink-0" />
              <a href={session.url} target="_blank" rel="noreferrer" className="text-sm text-purple-400 hover:text-purple-300 truncate font-mono">
                {session.url}
              </a>
            </div>
          )}

          {domainStats.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" /> Domain Breakdown
              </h3>
              <div className="space-y-2">
                {domainStats.map((d) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full" style={{ width: `${Math.min(100, (d.duration / session.duration) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-32 truncate text-right">{d.name}</span>
                    <span className="text-xs text-zinc-500 font-mono w-16 text-right">{formatHMS(d.duration / 1000)}</span>
                    <span className="text-[10px] text-zinc-600 w-10 text-right">{d.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <button onClick={() => setItemsExpanded(!itemsExpanded)} className="w-full flex items-center justify-between mb-3 group">
              <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500" /> Activity Log
                <span className="text-[10px] text-zinc-600 font-normal">({session.items?.length ?? 0} tracks)</span>
              </h3>
              {itemsExpanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
              )}
            </button>

            {itemsExpanded && (
              <div className="space-y-2">
                {session.items && session.items.length > 0 ? (
                  session.items.map((item, idx) => {
                    const itemStart = new Date(item.start);
                    const itemEnd = new Date(item.end);
                    const gapBefore = idx === 0
                      ? itemStart.getTime() - sessionStart.getTime()
                      : itemStart.getTime() - new Date(session.items[idx - 1].end).getTime();

                    return (
                      <div key={idx}>
                        {gapBefore > 1000 && (
                          <div className="flex items-center gap-2 py-1 ml-4">
                            <div className="h-px flex-1 bg-zinc-800 border-dashed border-t border-zinc-700" />
                            <span className="text-[10px] text-zinc-600 font-mono">+{formatHMS(gapBefore / 1000)} gap</span>
                          </div>
                        )}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700 transition-colors">
                          {item.iconUrl ? (
                            <AppIcon src={item.iconUrl} appName={item.title} size={28} className="rounded-md" />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                              <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-zinc-200 truncate">{item.title}</span>
                              <span className="text-xs text-zinc-500 font-mono shrink-0">{formatHMS(item.duration / 1000)}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-zinc-600 font-mono">
                                {formatTimeIST(item.start)} – {formatTimeIST(item.end)}
                              </span>
                              {item.domain && (
                                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {item.domain}
                                </span>
                              )}
                            </div>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noreferrer" className="text-[10px] text-purple-500/70 hover:text-purple-400 truncate block mt-0.5 font-mono">
                                {item.url}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-600 italic">No nested activity tracks recorded.</p>
                )}
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/50">
            <p className="text-[10px] text-zinc-600 font-mono break-all">
              <span className="text-zinc-500">Session ID:</span> {session.appName}@{session.start}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const filteredSessions = timelineSessions
    .filter((s) => {
      const sessionDate = getISTDateKey(s.start);
      const sessionHour = getISTHour(s.start);
      return sessionDate === date && sessionHour === hour;
    })
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider">{date}</p>
            <h2 className="text-xl font-bold text-white">
              {hour.toString().padStart(2, "0")}:00 – {(hour + 1).toString().padStart(2, "0")}:00 <span className="text-zinc-500 text-base font-normal">IST</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Duration</p>
              <p className="text-2xl font-bold text-white mt-1">{formatHMS(bucket.duration / 1000)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Raw Score</p>
              <p className="text-2xl font-bold text-purple-400 mt-1 font-mono">{bucket.score.toFixed(2)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Productivity</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{bucket.productivity.toFixed(0)}%</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Focus</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{(bucket.focus * 100).toFixed(0)}%</p>
            </Card>
          </div>

          {bucket.categoryBreakdown?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-500" /> Category Breakdown
              </h3>
              <div className="space-y-2">
                {bucket.categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${cat.percentage}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-20 text-right">{cat.name}</span>
                    <span className="text-xs text-zinc-500 font-mono w-12 text-right">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bucket.topApps?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" /> App Usage
              </h3>
              <div className="space-y-2">
                {bucket.topApps.map((app) => (
                  <div key={app.name} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
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

          {filteredSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-500" /> Session Log ({filteredSessions.length})
              </h3>
              <div className="space-y-3">
                {filteredSessions.map((session, idx) => (
                  <div key={idx} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AppIcon src={session.iconUrl} appName={session.appName} size={20} />
                        <span className="text-sm font-medium text-zinc-200">{session.appName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                          {session.category}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">{formatHMS(session.duration / 1000)}</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-mono mb-2">
                      {formatTimeIST(session.start)} – {formatTimeIST(session.end)}
                    </p>
                    {session.items?.length > 0 && (
                      <div className="space-y-1 pl-2 border-l-2 border-zinc-800">
                        {session.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 py-0.5">
                            {item.iconUrl && (
                              <AppIcon src={item.iconUrl} appName={item.title} size={14} className="opacity-60" />
                            )}
                            <span className="text-xs text-zinc-500 truncate flex-1">{item.title}</span>
                            <span className="text-[10px] text-zinc-600 font-mono">{formatHMS(item.duration / 1000)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
  const [timeScale, setTimeScale] = useState<TimeScale>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string>(toISODateIST(new Date()));
  const [customTo, setCustomTo] = useState<string>(toISODateIST(new Date()));

  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("score");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showEmptyCells, setShowEmptyCells] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTarget, setDrawerTarget] = useState<{
    date: string;
    hour: number;
    bucket: HeatmapBucket;
  } | null>(null);

  const [expandedHours, setExpandedHours] = useState<Set<string>>(new Set());

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TimelineSession | null>(null);

  const { from, to, displayLabel } = useMemo(() => {
    const now = new Date();
    switch (timeScale) {
      case "today": {
        const today = toISODateIST(now);
        return { from: today, to: today, displayLabel: today };
      }
      case "week": {
        const base = startOfWeekIST();
        const start = addDays(base, weekOffset * 7);
        const end = addDays(start, 6);
        return {
          from: toISODateIST(start),
          to: toISODateIST(end),
          displayLabel: `${toISODateIST(start)} → ${toISODateIST(end)}`,
        };
      }
      case "month": {
        const start = startOfMonthIST();
        const end = endOfMonthIST();
        return {
          from: toISODateIST(start),
          to: toISODateIST(end),
          displayLabel: toISODateIST(start).slice(0, 7),
        };
      }
      case "custom": {
        return {
          from: customFrom,
          to: customTo,
          displayLabel: `${customFrom} → ${customTo}`,
        };
      }
    }
  }, [timeScale, weekOffset, customFrom, customTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hData, tData] = await Promise.all([
        fetchHeatmap(USER_ID, from, to, viewMode, categoryFilter),
        fetchTimeline(USER_ID, from, to),
      ]);
      setHeatmap(hData ?? null);
      setTimeline(Array.isArray(tData) ? tData : []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load heatmap data");
      console.error("Heatmap fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [from, to, viewMode, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goPrev = () => { if (timeScale === "week") setWeekOffset((o) => o - 1); };
  const goNext = () => { if (timeScale === "week") setWeekOffset((o) => o + 1); };
  const goToday = () => { setWeekOffset(0); setTimeScale("today"); };

  const toggleHour = (date: string, hour: number) => {
    const key = `${date}|${hour}`;
    setExpandedHours((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [timeScale]);

  const handleExport = () => {
    if (!heatmap) return;
    const rows: any[] = [];
    Object.entries(heatmap).forEach(([date, day]) => {
      Object.entries(day).forEach(([hour, bucket]) => {
        rows.push({ date, hour: Number(hour), ...bucket });
      });
    });
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `samaritan-heatmap-${from}-to-${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDrawer = (date: string, hour: number, bucket: HeatmapBucket) => {
    setDrawerTarget({ date, hour, bucket });
    setDrawerOpen(true);
  };

  const openSessionModal = (session: TimelineSession) => {
    setSelectedSession(session);
    setSessionModalOpen(true);
  };

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

  const groupedTimeline = useMemo(() => {
    const byDate = new Map<string, Map<number, TimelineSession[]>>();
    for (const session of timeline) {
      const dateKey = getISTDateKey(session.start);
      const hour = getISTHour(session.start);
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const byHour = byDate.get(dateKey)!;
      if (!byHour.has(hour)) byHour.set(hour, []);
      byHour.get(hour)!.push(session);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, hoursMap]) => ({
        date,
        hours: Array.from(hoursMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([hour, sessions]) => {
            const sorted = [...sessions].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
            return {
              hour,
              sessions: sorted,
              totalMs: sorted.reduce((sum, s) => sum + s.duration, 0),
            };
          }),
      }));
  }, [timeline]);

  const viewModeConfig = {
    score: { label: "Raw Score", color: "purple", desc: "Normalized productivity score" },
    productivity: { label: "Productivity", color: "emerald", desc: "Productivity percentage" },
    duration: { label: "Duration", color: "blue", desc: "Tracked hours per cell" },
    focus: { label: "Focus", color: "cyan", desc: "Average focus impact" },
    idle: { label: "Idle", color: "rose", desc: "Idle time ratio" },
  };

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
              <p className="mt-0.5 text-sm text-zinc-500">Deep-dive into your hourly cognitive patterns</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                {([
                  { key: "today", label: "Today" },
                  { key: "week", label: "Week" },
                  { key: "month", label: "Month" },
                  { key: "custom", label: "Custom" },
                ] as { key: TimeScale; label: string }[]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setTimeScale(t.key); setWeekOffset(0); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      timeScale === t.key ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {timeScale === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 px-2 py-1.5 outline-none focus:border-purple-500" />
                  <span className="text-zinc-600 text-xs">→</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 px-2 py-1.5 outline-none focus:border-purple-500" />
                </div>
              )}

              {timeScale === "week" && (
                <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800">
                  <button onClick={goPrev} className="p-2 hover:bg-zinc-800 text-zinc-400 rounded-l-lg transition-colors" title="Previous week (Ctrl + ←)">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-3 py-2 text-xs font-medium text-zinc-300 font-mono border-x border-zinc-800 flex items-center gap-2">
                    <CalendarIcon className="w-3 h-3 text-zinc-500" />
                    {displayLabel}
                  </div>
                  <button onClick={goNext} className="p-2 hover:bg-zinc-800 text-zinc-400 rounded-r-lg transition-colors" title="Next week (Ctrl + →)">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button onClick={goToday} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                Today
              </button>
              <button onClick={handleExport} disabled={!heatmap || loading} className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30" title="Export JSON">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Color by</span>
              <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                {(Object.entries(viewModeConfig) as [ViewMode, typeof viewModeConfig.score][]).map(([key, config]) => (
                  <button key={key} onClick={() => setViewMode(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      viewMode === key ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title={config.desc}>
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-zinc-500" />
                <select value={categoryFilter ?? ""} onChange={(e) => setCategoryFilter(e.target.value || null)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 px-2.5 py-1.5 outline-none focus:border-purple-500">
                  <option value="">All Categories</option>
                  {availableCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
            )}

            <button onClick={() => setShowEmptyCells(!showEmptyCells)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showEmptyCells ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              }`}>
              {showEmptyCells ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Empty cells
            </button>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 ml-auto">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing…
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

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-zinc-500" />
                Activity Grid
              </h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {viewModeConfig[viewMode].desc} • {displayLabel}
                {categoryFilter && ` • Filtered: ${categoryFilter}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">Low</span>
              <div className="flex gap-1">
                {colorScales[viewMode].map((c, i) => (
                  <div key={i} className={`w-3 h-3 rounded-[1px] ${c}`} />
                ))}
              </div>
              <span className="text-xs text-zinc-600">High</span>
            </div>
          </div>

          {loading && !heatmap ? (
            <div className="overflow-x-auto"><HeatmapSkeleton /></div>
          ) : heatmap ? (
            <HeatmapGrid data={heatmap} viewMode={viewMode} showEmpty={showEmptyCells} onCellClick={openDrawer} />
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">No heatmap data for selected range.</div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            {heatmap && !loading ? <HeatmapInsights data={heatmap} /> : <InsightsSkeleton />}
          </div>
          <div className="lg:col-span-2">
            <Card className="p-6 h-full">
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-500" />
                Hourly Timeline
              </h3>
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-20 bg-zinc-800 rounded-xl" />))}
                </div>
              ) : groupedTimeline.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
                  {groupedTimeline.map(({ date, hours }) => (
                    <div key={date} className="space-y-3">
                      <div className="flex items-center gap-2 sticky top-0 bg-zinc-900/95 py-1 z-10">
                        <div className="h-px flex-1 bg-zinc-800" />
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">{date}</span>
                        <div className="h-px flex-1 bg-zinc-800" />
                      </div>

                      <div className="space-y-3">
                        {hours.map(({ hour, sessions, totalMs }) => {
                          const hourKey = `${date}|${hour}`;
                          const isExpanded = expandedHours.has(hourKey);
                          const visibleSessions = isExpanded ? sessions : sessions.slice(0, 5);

                          return (
                            <div key={hour} className="border border-zinc-800 rounded-xl overflow-hidden">
                              <div
                                className="bg-zinc-900/60 px-4 py-2.5 flex items-center justify-between border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/60 transition-colors select-none"
                                onClick={() => toggleHour(date, hour)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-zinc-300">
                                    {hour.toString().padStart(2, "0")}:00
                                  </span>
                                  {sessions.length > 5 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                                      {isExpanded ? "Collapse" : `+${sessions.length - 5}`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                                    <Timer className="w-3 h-3" />
                                    {formatHMS(totalMs / 1000)}
                                  </span>
                                  <span className="text-xs text-zinc-600">{sessions.length} sessions</span>
                                </div>
                              </div>

                              <div className="divide-y divide-zinc-800/50">
                                {visibleSessions.map((s, i) => (
                                  <div
                                    key={i}
                                    className="px-4 py-2.5 hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                                    onClick={() => openSessionModal(s)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <AppIcon src={s.iconUrl} appName={s.appName} size={24} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-300 font-medium truncate group-hover:text-purple-300 transition-colors">{s.appName}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                                              {s.category}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-zinc-500 font-mono">{formatHMS(s.duration / 1000)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                          <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTimeIST(s.start)} – {formatTimeIST(s.end)}
                                          </span>
                                          <span className="text-[10px] text-zinc-600">{s.items?.length ?? 0} tracks</span>
                                        </div>
                                        {s.items?.[0] && !isExpanded && (
                                          <p className="text-[10px] text-zinc-600 truncate mt-0.5 flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {s.items[0].title}
                                            {s.items.length > 1 && (
                                              <span className="text-zinc-700">+{s.items.length - 1} more</span>
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {isExpanded && s.items && s.items.length > 0 && (
                                      <div className="mt-2 ml-9 space-y-1">
                                        {s.items.map((item, idx) => (
                                          <div key={idx} className="flex items-center gap-2 py-0.5 border-l-2 border-zinc-800 pl-2">
                                            {item.iconUrl && (
                                              <AppIcon src={item.iconUrl} appName={item.title} size={14} className="opacity-60" />
                                            )}
                                            <span className="text-[11px] text-zinc-400 truncate flex-1">{item.title}</span>
                                            <span className="text-[10px] text-zinc-600 font-mono">{formatHMS(item.duration / 1000)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {!isExpanded && sessions.length > 5 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleHour(date, hour); }}
                                    className="w-full px-4 py-2 text-center text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                    +{sessions.length - 5} more sessions — click to expand
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">No timeline data available for this range.</div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <HourDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        date={drawerTarget?.date ?? ""}
        hour={drawerTarget?.hour ?? 0}
        bucket={drawerTarget?.bucket ?? null}
        timelineSessions={timeline}
      />

      <SessionDetailModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        session={selectedSession}
      />
    </div>
  );
}