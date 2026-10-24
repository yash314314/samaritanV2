"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Clock,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  MessageSquare,
  Timer,
  Target,
  Brain,
  Gauge,
  Activity,
  Flame,
  Coffee,
  Layers3,
} from "lucide-react";
import { focusApi } from "../../lib/api";
import { Decode } from "../sam/Decode";
import SamLoading from "../sam/SamLoading";
import { playSamaritanDialogSequence, playSamaritanDismiss } from "../../lib/samaritanAudio";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ─── Types (matching backend response) ───
interface TimeSeriesPoint {
  second: number;
  timestamp: string;
  focusScore?: number;
  productivityScore?: number;
  distraction: boolean;
  idle: boolean;
  appName?: string | null;
  category?: string | null;
}

interface Intervention {
  id: string;
  appName: string;
  windowTitle?: string;
  domain?: string | null;
  action: string;
  reason?: string | null;
  detectedAt: string;
  durationMs?: number;
  resolution?: string | null;
  resolvedAt?: string | null;
}

interface DeepWorkPhase {
  id: string;
  type: "focus" | "short_break" | "long_break";
  round: number;
  status: string;
  plannedSeconds: number;
  actualSeconds?: number | null;
}

interface EnforcementEvent {
  id: string;
  appName: string;
  outcome: string;
  method?: string | null;
  error?: string | null;
  createdAt: string;
}

interface SessionMetrics {
  totalTrackedMinutes?: number;
  productiveMinutes?: number;
  distractionMinutes?: number;
  idleMinutes?: number;
  focusEfficiency?: number;
  distractionRatio?: number;
  idleRatio?: number;
  finalFocusScore?: number;
  finalProductivityScore?: number;
  violationCount?: number;
  interruptionMs?: number;
  avgRecoveryMinutes?: number;
  focusedMinutes?: number;
  breakMinutes?: number;
  blockedCount?: number;
  blockFailureCount?: number;
  warnedCount?: number;
  reasonRequiredCount?: number;
  overrideCount?: number;
}

interface SessionInfo {
  id: string;
  goal?: string | null;
  plannedMinutes?: number;
  actualMinutes?: number;
  completionRate?: number;
  startedAt: string;
  endedAt?: string | null;
  status: string;
  enforcement?: string;
  timerMode?: string;
  totalRounds?: number;
  completedRounds?: number;
  ambientSound?: string;
  project?: { id: string; name: string; color?: string | null } | null;
}

interface ResultApiResponse {
  session?: SessionInfo;
  metrics?: SessionMetrics;
  timeSeries?: TimeSeriesPoint[];
  interventions?: Intervention[];
  phases?: DeepWorkPhase[];
  enforcementEvents?: EnforcementEvent[];
}

interface Props {
  sessionId: string;
  onClose: () => void;
  onStartAnother: () => void;
}

// ─── Helpers ───
function clampScore(v: number | undefined): number {
  if (v === undefined || v === null || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0s";
  if (minutes < 1) {
    const sec = Math.round(minutes * 60);
    return `${sec}s`;
  }
  return `${minutes % 1 === 0 ? minutes : minutes.toFixed(1)}m`;
}

// ─── Component ───
export default function DeepWorkResultPanel({ sessionId, onClose, onStartAnother }: Props) {
  const [result, setResult] = useState<ResultApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedViolation, setExpandedViolation] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | "all">("all");
  const [curvePreset, setCurvePreset] = useState<"divergent" | "smooth" | "stepped" | "linear">("divergent");
  const [showFocus, setShowFocus] = useState(true);
  const [showProductivity, setShowProductivity] = useState(true);
  const [showDistraction, setShowDistraction] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const load = async () => {
      try {
        const res = await focusApi.getResult(sessionId);
        if (isMountedRef.current) {
          setResult(res.data as ResultApiResponse);
        }
      } catch (e) {
        console.error("Failed to load result", e);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };
    load();
    return () => { isMountedRef.current = false; };
  }, [sessionId]);

  useEffect(() => {
    if (!loading && result) {
      playSamaritanDialogSequence(1.0);
    }
  }, [loading, result]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <SamLoading compact label="Computing session results" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="samaritan-card p-6 text-zinc-500">Session not found</div>
      </div>
    );
  }

  // ─── Data from backend (accurate, directly from session accumulators) ───
  const session = result.session ?? ({} as SessionInfo);
  const metrics = result.metrics ?? {};
  const interventions = result.interventions ?? [];
  const phases = result.phases ?? [];
  const enforcementEvents = result.enforcementEvents ?? [];
  const timeSeries = result.timeSeries ?? [];

  const plannedMin = session.plannedMinutes || 0;
  const actualMin = session.actualMinutes || 0;
  const completionRate = session.completionRate ?? (plannedMin > 0 ? Math.round((actualMin / plannedMin) * 100) : 0);

  // Time allocation (from backend — accurate session accumulators)
  let productiveMin = metrics.productiveMinutes ?? 0;
  let distractionMin = metrics.distractionMinutes ?? 0;
  const idleMin = metrics.idleMinutes ?? 0;
  let totalTrackedMin = metrics.totalTrackedMinutes ?? (productiveMin + distractionMin + idleMin);

  // Fallback: if backend accumulator was 0, calculate from session focus duration and interruptions
  if (totalTrackedMin === 0 && (actualMin > 0 || (metrics.focusedMinutes ?? 0) > 0)) {
    const sessionTime = actualMin > 0 ? actualMin : (metrics.focusedMinutes ?? 0);
    const interruptionMinutes = metrics.interruptionMs ? metrics.interruptionMs / 60000 : 0;
    distractionMin = Math.min(sessionTime, Number(interruptionMinutes.toFixed(1)));
    productiveMin = Math.max(0, Number((sessionTime - distractionMin).toFixed(1)));
    totalTrackedMin = Number((productiveMin + distractionMin).toFixed(1));
  }

  // Efficiency & ratios (from backend)
  const focusEfficiency = metrics.focusEfficiency ?? (totalTrackedMin > 0 ? Math.round((productiveMin / totalTrackedMin) * 100) : 0);
  const distractionRatio = metrics.distractionRatio ?? (totalTrackedMin > 0 ? Math.round((distractionMin / totalTrackedMin) * 100) : 0);

  // Final scores (from backend — proportional model)
  const finalFocusScore = metrics.finalFocusScore ?? 0;
  const finalProductivityScore = metrics.finalProductivityScore ?? 0;

  // Violations
  const violationCount = metrics.violationCount ?? 0;
  const avgRecoveryMinutes = metrics.avgRecoveryMinutes ?? 0;
  const focusedMinutes = metrics.focusedMinutes ?? 0;
  const breakMinutes = metrics.breakMinutes ?? 0;
  const blockedCount = metrics.blockedCount ?? 0;
  const blockFailureCount = metrics.blockFailureCount ?? 0;

  // ─── Chart data: per-second atomic timeline ───
  const rawChartData = timeSeries.map((m) => ({
    second: m.second,
    focus: clampScore(m.focusScore),
    productivity: clampScore(m.productivityScore),
    appName: m.appName || "—",
    category: m.category || "—",
    distraction: m.distraction,
    distractionPulse: m.distraction ? 100 : 0,
    idle: m.idle,
  }));

  // Different curve types per metric:
  // - Focus: Monotone cubic spline (continuous cognitive flow)
  // - Productivity: Crisp linear vector (tactical tool output)
  // - Distraction: Step-after pulse (digital protocol disruption square-wave)
  const focusCurve: "monotone" | "natural" | "stepAfter" | "linear" =
    curvePreset === "divergent" ? "monotone" : curvePreset === "smooth" ? "natural" : curvePreset === "stepped" ? "stepAfter" : "linear";
  const prodCurve: "monotone" | "natural" | "stepAfter" | "linear" =
    curvePreset === "divergent" ? "linear" : curvePreset === "smooth" ? "natural" : curvePreset === "stepped" ? "stepAfter" : "linear";
  const distractCurve: "monotone" | "natural" | "stepAfter" | "linear" =
    curvePreset === "divergent" ? "stepAfter" : curvePreset === "smooth" ? "natural" : curvePreset === "stepped" ? "stepAfter" : "linear";

  // Minute indices for time-based filtering
  const maxSecond = rawChartData.length > 0 ? rawChartData[rawChartData.length - 1].second : 0;
  const totalMinutes = Math.max(1, Math.ceil((maxSecond + 1) / 60));
  const minuteIndices = Array.from({ length: totalMinutes }, (_, i) => i);

  // Filter per-second data by selected minute
  const filteredData = selectedMinute === "all"
    ? rawChartData
    : rawChartData.filter((d) => Math.floor(d.second / 60) === selectedMinute);

  // Downsample only when viewing all points across very long sessions
  const MAX_CHART_POINTS = 300;
  let chartData = filteredData;
  if (selectedMinute === "all" && filteredData.length > MAX_CHART_POINTS) {
    const step = Math.ceil(filteredData.length / MAX_CHART_POINTS);
    chartData = filteredData.filter((_, i) => i % step === 0 || i === filteredData.length - 1);
  }

  // Summary statistics for the active filtered window
  const activeWindowSeconds = filteredData.length;
  const avgFocusInWindow = activeWindowSeconds > 0
    ? Math.round(filteredData.reduce((acc, d) => acc + d.focus, 0) / activeWindowSeconds)
    : 0;
  const avgProdInWindow = activeWindowSeconds > 0
    ? Math.round(filteredData.reduce((acc, d) => acc + d.productivity, 0) / activeWindowSeconds)
    : 0;
  const distractionSecondsInWindow = filteredData.filter((d) => d.distraction).length;
  const distractionPercentInWindow = activeWindowSeconds > 0
    ? Math.round((distractionSecondsInWindow / activeWindowSeconds) * 100)
    : 0;
  const activeAppsInWindow = Array.from(new Set(filteredData.map((d) => d.appName).filter((a) => a && a !== "—")));

  // Format seconds as MM:SS for display
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Show chart if we have data
  const hasChartData = chartData.length > 0;

  // ─── Status (Samaritan Red & White) ───
  const statusColor = session.status === "completed"
    ? "text-white bg-white/10 border-white/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  const statusIcon = session.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="samaritan-card sam-dialog-aperture relative my-8 w-full max-w-4xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Single Phosphor Laser Scanline Sweep */}
        <div className="sam-scanline-beam" aria-hidden="true" />

        {/* Surveillance Directive Banner */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2 font-mono text-[10px] tracking-wider select-none">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xs animate-pulse leading-none" aria-hidden="true">
              ▼
            </span>
            <span className="text-zinc-500 uppercase">{"/// SYS.DIRECTIVE //"}</span>
            <span className="font-bold uppercase text-white">DEEP_WORK.METRICS_EVAL</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
            <span className="font-mono">[{session.status === "completed" ? "SESSION_COMPLETED" : "SESSION_TERMINATED"}]</span>
          </div>
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${statusColor}`}>{statusIcon}</div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                <Decode value="Session Results" trigger="mount" />
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{session.goal || "Deep work session"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors" aria-label="Close dialog"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-6 p-6">
          {/* Summary Cards — strictly Red and White palette */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultCard icon={<Clock className="h-4 w-4 text-zinc-400" />} label="Duration" value={formatDuration(actualMin)} sub={`of ${formatDuration(plannedMin)} planned`} color="text-white" bg="bg-zinc-950" border="border-zinc-800" />
            <ResultCard icon={<Brain className="h-4 w-4 text-red-500" />} label="Focus Score" value={finalFocusScore.toFixed(1)} sub="/ 100" color="text-red-500" bg="bg-red-500/5" border="border-red-500/20" />
            <ResultCard icon={<Gauge className="h-4 w-4 text-zinc-300" />} label="Productivity" value={finalProductivityScore.toFixed(1)} sub="/ 100" color="text-zinc-100" bg="bg-zinc-950" border="border-zinc-800" />
            <ResultCard icon={<Target className="h-4 w-4 text-red-400" />} label="Efficiency" value={`${focusEfficiency}%`} sub="productive / total" color="text-red-400" bg="bg-red-950/20" border="border-red-900/30" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-400"><Layers3 className="h-4 w-4 text-white" />Session structure</h3>
                <span className="text-[10px] text-zinc-500">{session.timerMode === "pomodoro" ? `${session.completedRounds ?? 0}/${session.totalRounds ?? 0} rounds` : "Countdown"}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="block text-[10px] uppercase text-zinc-500">Focused</span><strong className="tabular-nums text-white">{focusedMinutes.toFixed(1)}m</strong></div>
                <div><span className="block text-[10px] uppercase text-zinc-500">Recovery breaks</span><strong className="tabular-nums text-zinc-400">{breakMinutes.toFixed(1)}m</strong></div>
              </div>
              {phases.length > 0 && <div className="mt-4 flex h-2 gap-1 overflow-hidden rounded-full bg-zinc-900" aria-label="Session phase timeline">{phases.map((phase) => <span key={phase.id} title={`${phase.type.replace("_", " ")} - round ${phase.round}`} className={`min-w-1 flex-1 rounded-full ${phase.type === "focus" ? "bg-white" : "bg-zinc-700"} ${phase.status === "completed" ? "opacity-100" : "opacity-40"}`} />)}</div>}
              <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white" />Focus</span><span className="flex items-center gap-1"><Coffee className="h-3 w-3 text-zinc-400" />Break</span>{session.project && <span className="ml-auto truncate text-zinc-400">{session.project.name}</span>}</div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-400"><Shield className="h-4 w-4 text-zinc-300" />Enforcement outcome</h3>
                <span className="text-[10px] uppercase text-zinc-500">{session.enforcement?.replace("_", " ") || "observe"}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="block text-[10px] uppercase text-zinc-500">Stopped</span><strong className="tabular-nums text-white">{blockedCount}</strong></div>
                <div><span className="block text-[10px] uppercase text-zinc-500">Failed</span><strong className={`tabular-nums ${blockFailureCount ? "text-red-400" : "text-zinc-500"}`}>{blockFailureCount}</strong></div>
                <div><span className="block text-[10px] uppercase text-zinc-500">Overrides</span><strong className="tabular-nums text-red-300">{metrics.overrideCount ?? 0}</strong></div>
              </div>
              <p className="mt-4 truncate text-[10px] text-zinc-500">{enforcementEvents.length ? `${enforcementEvents.length} desktop enforcement attempt${enforcementEvents.length === 1 ? "" : "s"} recorded` : interventions.length ? `${interventions.length} intervention${interventions.length === 1 ? "" : "s"} recorded` : "No protocol violations detected"}</p>
            </section>
          </div>

          {/* Adherence & Violations */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Adherence</span>
                <span className={`text-sm font-bold ${completionRate >= 80 ? "text-white" : completionRate >= 50 ? "text-zinc-300" : "text-red-400"}`}>{completionRate}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full transition-all ${completionRate >= 80 ? "bg-white" : completionRate >= 50 ? "bg-zinc-400" : "bg-red-500"}`} style={{ width: `${Math.min(100, completionRate)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
                <span>Started: {new Date(session.startedAt).toLocaleTimeString()}</span>
                <span>{session.endedAt ? new Date(session.endedAt).toLocaleTimeString() : "—"}</span>
              </div>
              <div className="mt-2 flex gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1 text-zinc-300"><Activity className="h-3 w-3 text-zinc-400" /> {formatDuration(productiveMin)} productive</span>
                <span className="flex items-center gap-1 text-red-400"><Flame className="h-3 w-3 text-red-500" /> {distractionRatio}% distracted</span>
                {avgRecoveryMinutes > 0 && <span className="flex items-center gap-1 text-zinc-400"><Zap className="h-3 w-3 text-zinc-500" /> {avgRecoveryMinutes.toFixed(1)}m avg recovery</span>}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Violations</span>
                <span className={`text-sm font-bold ${violationCount > 0 ? "text-red-500" : "text-white"}`}>{violationCount}</span>
              </div>
              {interventions.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {interventions.map((inv, i) => {
                    const isOpen = expandedViolation === i;
                    return (
                      <div key={inv.id ?? i} className="rounded bg-zinc-900 overflow-hidden border border-zinc-800/50">
                        <button onClick={() => setExpandedViolation(isOpen ? null : i)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                          <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                          <span className="truncate text-left flex-1 font-mono">{inv.appName}</span>
                          <span className="text-zinc-500 shrink-0">{new Date(inv.detectedAt).toLocaleTimeString()}</span>
                          {isOpen ? <ChevronUp className="h-3 w-3 text-zinc-500 shrink-0" /> : <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-2 pt-1 space-y-1 border-t border-zinc-800/50 text-[10px]">
                            <div className="flex items-start gap-1.5 text-zinc-400"><Info className="h-3 w-3 text-zinc-500 shrink-0 mt-0.5" /><span><span className="text-zinc-300 font-medium">Action:</span> {inv.action}</span></div>
                            {inv.windowTitle && <div className="flex items-start gap-1.5 text-zinc-400"><MessageSquare className="h-3 w-3 text-zinc-500 shrink-0 mt-0.5" /><span className="truncate"><span className="text-zinc-300 font-medium">Window:</span> {inv.windowTitle}</span></div>}
                            {inv.domain && <div className="flex items-start gap-1.5 text-zinc-400"><MessageSquare className="h-3 w-3 text-zinc-500 shrink-0 mt-0.5" /><span><span className="text-zinc-300 font-medium">Domain:</span> {inv.domain}</span></div>}
                            {inv.reason && <div className="flex items-start gap-1.5 text-zinc-400"><MessageSquare className="h-3 w-3 text-zinc-500 shrink-0 mt-0.5" /><span><span className="text-zinc-300 font-medium">Reason:</span> {inv.reason}</span></div>}
                            {inv.resolution && <div className="flex items-start gap-1.5 text-zinc-400"><CheckCircle2 className="h-3 w-3 text-zinc-500 shrink-0 mt-0.5" /><span><span className="text-zinc-300 font-medium">Resolution:</span> {inv.resolution.replace("_", " ")}</span></div>}
                            {inv.durationMs !== undefined && <div className="flex items-start gap-1.5 text-zinc-400"><Timer className="h-3 w-3 text-zinc-500 shrink-0 mt-0.5" /><span><span className="text-zinc-300 font-medium">Duration:</span> {Math.round(inv.durationMs / 1000)}s</span></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No violations recorded. Clean session.</p>
              )}
            </div>
          </div>

          {/* Atomic Per-Second Performance Chart with Time-Based Filtering & Multi-Curve Engine */}
          {hasChartData ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-white">
                    Atomic Timeline Performance
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    ({rawChartData.length}s atomic)
                  </span>
                </div>

                {/* Curve Engine Preset Selector */}
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-[11px] font-mono">
                  <span className="px-1.5 text-[10px] uppercase text-zinc-500">Curve Engine:</span>
                  <button
                    type="button"
                    onClick={() => setCurvePreset("divergent")}
                    title="Focus: Smooth Spline, Productivity: Crisp Linear, Distraction: Digital Step"
                    className={`rounded px-2 py-0.5 transition-colors ${
                      curvePreset === "divergent"
                        ? "bg-white text-black font-bold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Divergent
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurvePreset("smooth")}
                    title="All metrics plotted as smooth natural splines"
                    className={`rounded px-2 py-0.5 transition-colors ${
                      curvePreset === "smooth"
                        ? "bg-white text-black font-bold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Smooth
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurvePreset("stepped")}
                    title="All metrics plotted as discrete digital step functions"
                    className={`rounded px-2 py-0.5 transition-colors ${
                      curvePreset === "stepped"
                        ? "bg-white text-black font-bold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Stepped
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurvePreset("linear")}
                    title="All metrics plotted as linear angular vectors"
                    className={`rounded px-2 py-0.5 transition-colors ${
                      curvePreset === "linear"
                        ? "bg-white text-black font-bold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Linear
                  </button>
                </div>
              </div>

              {/* Metric Visibility Toggles with Curve Indicators */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase text-zinc-500">Curves:</span>
                  <button
                    type="button"
                    onClick={() => setShowFocus((v) => !v)}
                    className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                      showFocus
                        ? "border-white/40 bg-white/10 text-white font-medium shadow-sm"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-600 line-through"
                    }`}
                  >
                    <span className="h-1.5 w-3 rounded-full bg-white shadow-sm" />
                    <span>Focus <span className="text-[9px] text-zinc-400 font-normal">({focusCurve})</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowProductivity((v) => !v)}
                    className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                      showProductivity
                        ? "border-zinc-500/40 bg-zinc-500/10 text-zinc-200 font-medium shadow-sm"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-600 line-through"
                    }`}
                  >
                    <span className="h-1.5 w-3 rounded-full bg-zinc-400" />
                    <span>Productivity <span className="text-[9px] text-zinc-400 font-normal">({prodCurve})</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDistraction((v) => !v)}
                    className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                      showDistraction
                        ? "border-red-500/40 bg-red-500/10 text-red-400 font-medium shadow-sm"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-600 line-through"
                    }`}
                  >
                    <span className="h-1.5 w-3 rounded-full bg-red-500" />
                    <span>Distraction Pulse <span className="text-[9px] text-red-400/80 font-normal">({distractCurve})</span></span>
                  </button>
                </div>

                <div className="text-[10px] text-zinc-500">
                  Toggle tags to show/hide curves
                </div>
              </div>

              {/* Time-Based Minute Filtering Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-zinc-800/80 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Window:</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedMinute("all")}
                      className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                        selectedMinute === "all"
                          ? "bg-white text-black font-bold shadow-sm"
                          : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                      }`}
                    >
                      All ({totalMinutes}m)
                    </button>
                    {minuteIndices.map((minIdx) => {
                      const isSelected = selectedMinute === minIdx;
                      const startSec = minIdx * 60;
                      const endSec = Math.min(rawChartData.length, (minIdx + 1) * 60);
                      return (
                        <button
                          key={minIdx}
                          type="button"
                          onClick={() => setSelectedMinute(minIdx)}
                          className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                            isSelected
                              ? "bg-red-500 text-white font-bold shadow-sm"
                              : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          Min {minIdx + 1} ({formatTime(startSec)}-{formatTime(endSec)})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Window Atomic Metrics HUD */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="text-zinc-500">
                    Avg Focus: <span className="font-semibold text-white">{avgFocusInWindow}</span>
                  </span>
                  <span className="text-zinc-500">
                    Avg Prod: <span className="font-semibold text-zinc-300">{avgProdInWindow}</span>
                  </span>
                  <span className="text-zinc-500">
                    Distracted:{" "}
                    <span className={distractionSecondsInWindow > 0 ? "font-semibold text-red-500" : "text-zinc-400"}>
                      {distractionSecondsInWindow}s ({distractionPercentInWindow}%)
                    </span>
                  </span>
                  {activeAppsInWindow.length > 0 && (
                    <span className="hidden sm:inline text-zinc-500">
                      Apps: <span className="text-zinc-300">{activeAppsInWindow.join(", ")}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="distractGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="second"
                      stroke="#71717a"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(v: number) => formatTime(v)}
                      label={{ value: "Time (MM:SS)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#71717a" }}
                    />
                    <YAxis domain={[0, 100]} stroke="#71717a" fontSize={10} tickLine={false} label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 10, fill: "#71717a" }} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload as typeof chartData[0];
                      return (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs shadow-2xl">
                          <p className="text-[10px] font-mono font-semibold text-zinc-400 mb-1">Time {formatTime(Number(label))} (sec {label})</p>
                          <p className="text-[10px] text-zinc-400 mb-2">App: <span className="font-semibold text-white">{data.appName}</span>{data.category !== "—" && <span className="text-zinc-500"> · {data.category}</span>}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-white" /><span className="text-zinc-400">Focus ({focusCurve}):</span><span className="font-bold text-white">{data.focus}</span></div>
                            <div className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /><span className="text-zinc-400">Productivity ({prodCurve}):</span><span className="font-bold text-zinc-300">{data.productivity}</span></div>
                            <div className="flex items-center gap-2 text-[10px] pt-0.5">
                              {data.distraction && <span className="font-semibold text-red-500">⚠ Distraction Event ({distractCurve} pulse active)</span>}
                              {data.idle && !data.distraction && <span className="text-zinc-400">○ Idle State</span>}
                              {!data.distraction && !data.idle && <span className="font-semibold text-white">✓ Deep Focus</span>}
                            </div>
                          </div>
                        </div>
                      );
                    }} />
                    {showDistraction && (
                      <Area
                        type={distractCurve}
                        dataKey="distractionPulse"
                        stroke="#ef4444"
                        fill="url(#distractGrad)"
                        strokeWidth={1.5}
                        strokeDasharray={distractCurve === "stepAfter" ? undefined : "3 3"}
                        dot={false}
                        activeDot={{ r: 4, fill: "#ef4444", stroke: "#000000", strokeWidth: 1 }}
                        name="Distraction Pulse"
                      />
                    )}
                    {showProductivity && (
                      <Area
                        type={prodCurve}
                        dataKey="productivity"
                        stroke="#d4d4d8"
                        fill="url(#prodGrad)"
                        strokeWidth={1.5}
                        strokeDasharray={prodCurve === "linear" ? "4 2" : undefined}
                        dot={false}
                        activeDot={{ r: 4, fill: "#d4d4d8", stroke: "#000000", strokeWidth: 1 }}
                        name="Productivity"
                      />
                    )}
                    {showFocus && (
                      <Area
                        type={focusCurve}
                        dataKey="focus"
                        stroke="#ffffff"
                        fill="url(#focusGrad)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: "#ffffff", stroke: "#000000", strokeWidth: 1 }}
                        name="Focus"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <BarChart3 className="h-6 w-6 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No atomic time data available for this session.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(session.startedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700">Close</button>
              <button onClick={onStartAnother} className="sam-button" data-variant="primary"><RotateCcw className="h-4 w-4" />Start Another</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───
function ResultCard({ icon, label, value, sub, color, bg, border }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; bg: string; border: string }) {
  return (
    <div className={`flex flex-col rounded-xl border ${border} ${bg} p-3`}>
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className={`text-2xl font-bold ${color} tabular-nums`}>
        <Decode value={value} trigger="mount" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-[10px] text-zinc-600">{sub}</div>
    </div>
  );
}
