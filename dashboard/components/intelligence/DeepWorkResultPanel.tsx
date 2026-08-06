"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Clock,
  Zap,
  TrendingUp,
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
} from "lucide-react";
import { focusApi } from "../../lib/api";
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
}

interface ResultApiResponse {
  session?: SessionInfo;
  metrics?: SessionMetrics;
  timeSeries?: TimeSeriesPoint[];
  interventions?: Intervention[];
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

// ─── Component ───
export default function DeepWorkResultPanel({ sessionId, onClose, onStartAnother }: Props) {
  const [result, setResult] = useState<ResultApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedViolation, setExpandedViolation] = useState<number | null>(null);
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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="text-zinc-500 flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-purple-500" />
          Loading session results...
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500">Session not found</div>
      </div>
    );
  }

  // ─── Data from backend (accurate, directly from session accumulators) ───
  const session = result.session ?? ({} as SessionInfo);
  const metrics = result.metrics ?? {};
  const interventions = result.interventions ?? [];
  const timeSeries = result.timeSeries ?? [];

  const plannedMin = session.plannedMinutes || 0;
  const actualMin = session.actualMinutes || 0;
  const completionRate = session.completionRate ?? (plannedMin > 0 ? Math.round((actualMin / plannedMin) * 100) : 0);

  // Time allocation (from backend — accurate session accumulators)
  const productiveMin = metrics.productiveMinutes ?? 0;
  const distractionMin = metrics.distractionMinutes ?? 0;
  const idleMin = metrics.idleMinutes ?? 0;
  const totalTrackedMin = metrics.totalTrackedMinutes ?? (productiveMin + distractionMin + idleMin);

  // Efficiency & ratios (from backend)
  const focusEfficiency = metrics.focusEfficiency ?? 0;
  const distractionRatio = metrics.distractionRatio ?? 0;

  // Final scores (from backend — proportional model)
  const finalFocusScore = metrics.finalFocusScore ?? 0;
  const finalProductivityScore = metrics.finalProductivityScore ?? 0;

  // Violations
  const violationCount = metrics.violationCount ?? 0;
  const avgRecoveryMinutes = metrics.avgRecoveryMinutes ?? 0;

  // ─── Chart data: per-second interpolation from backend ───
  // Downsample to ~300 points max for chart performance while keeping the curve smooth
  const rawChartData = timeSeries.map((m) => ({
    second: m.second,
    focus: clampScore(m.focusScore),
    productivity: clampScore(m.productivityScore),
    appName: m.appName || "—",
    category: m.category || "—",
    distraction: m.distraction,
    idle: m.idle,
  }));

  // Downsample: if more than 300 points, take every Nth point
  const MAX_CHART_POINTS = 300;
  let chartData = rawChartData;
  if (rawChartData.length > MAX_CHART_POINTS) {
    const step = Math.ceil(rawChartData.length / MAX_CHART_POINTS);
    chartData = rawChartData.filter((_, i) => i % step === 0 || i === rawChartData.length - 1);
  }

  // Format seconds as MM:SS for display
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Show chart if we have data
  const hasChartData = chartData.length > 0;

  // ─── Status ───
  const statusColor = session.status === "completed"
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : "text-rose-400 bg-rose-500/10 border-rose-500/20";
  const statusIcon = session.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative my-8 w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${statusColor}`}>{statusIcon}</div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Session Results</h2>
              <p className="text-xs text-zinc-500">{session.goal || "Deep work session"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-6 p-6">
          {/* Summary Cards — using accurate backend metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultCard icon={<Clock className="h-4 w-4" />} label="Duration" value={`${actualMin}m`} sub={`of ${plannedMin}m planned`} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" />
            <ResultCard icon={<Brain className="h-4 w-4" />} label="Focus Score" value={finalFocusScore.toFixed(1)} sub="/ 100" color="text-purple-400" bg="bg-purple-500/10" border="border-purple-500/20" />
            <ResultCard icon={<Gauge className="h-4 w-4" />} label="Productivity" value={finalProductivityScore.toFixed(1)} sub="/ 100" color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" />
            <ResultCard icon={<Target className="h-4 w-4" />} label="Efficiency" value={`${focusEfficiency}%`} sub="productive / total" color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" />
          </div>

          {/* Adherence & Violations */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Adherence</span>
                <span className={`text-sm font-bold ${completionRate >= 80 ? "text-emerald-400" : completionRate >= 50 ? "text-amber-400" : "text-rose-400"}`}>{completionRate}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full ${completionRate >= 80 ? "bg-emerald-500" : completionRate >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, completionRate)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
                <span>Started: {new Date(session.startedAt).toLocaleTimeString()}</span>
                <span>{session.endedAt ? new Date(session.endedAt).toLocaleTimeString() : "—"}</span>
              </div>
              <div className="mt-2 flex gap-3 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-blue-400" /> {productiveMin}m productive</span>
                <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-rose-400" /> {distractionRatio}% distracted</span>
                {avgRecoveryMinutes > 0 && <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" /> {avgRecoveryMinutes.toFixed(1)}m avg recovery</span>}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Violations</span>
                <span className={`text-sm font-bold ${violationCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>{violationCount}</span>
              </div>
              {interventions.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {interventions.map((inv, i) => {
                    const isOpen = expandedViolation === i;
                    return (
                      <div key={inv.id ?? i} className="rounded bg-zinc-900 overflow-hidden">
                        <button onClick={() => setExpandedViolation(isOpen ? null : i)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[10px] text-zinc-400 hover:bg-zinc-800/50 transition-colors">
                          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                          <span className="truncate text-left flex-1">{inv.appName}</span>
                          <span className="text-zinc-600 shrink-0">{new Date(inv.detectedAt).toLocaleTimeString()}</span>
                          {isOpen ? <ChevronUp className="h-3 w-3 text-zinc-600 shrink-0" /> : <ChevronDown className="h-3 w-3 text-zinc-600 shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-2 pt-1 space-y-1 border-t border-zinc-800/50">
                            <div className="flex items-start gap-1.5 text-[10px] text-zinc-500"><Info className="h-3 w-3 text-zinc-600 shrink-0 mt-0.5" /><span><span className="text-zinc-400 font-medium">Action:</span> {inv.action}</span></div>
                            {inv.windowTitle && <div className="flex items-start gap-1.5 text-[10px] text-zinc-500"><MessageSquare className="h-3 w-3 text-zinc-600 shrink-0 mt-0.5" /><span className="truncate"><span className="text-zinc-400 font-medium">Window:</span> {inv.windowTitle}</span></div>}
                            {inv.domain && <div className="flex items-start gap-1.5 text-[10px] text-zinc-500"><MessageSquare className="h-3 w-3 text-zinc-600 shrink-0 mt-0.5" /><span><span className="text-zinc-400 font-medium">Domain:</span> {inv.domain}</span></div>}
                            {inv.reason && <div className="flex items-start gap-1.5 text-[10px] text-zinc-500"><MessageSquare className="h-3 w-3 text-zinc-600 shrink-0 mt-0.5" /><span><span className="text-zinc-400 font-medium">Reason:</span> {inv.reason}</span></div>}
                            {inv.durationMs !== undefined && <div className="flex items-start gap-1.5 text-[10px] text-zinc-500"><Timer className="h-3 w-3 text-zinc-600 shrink-0 mt-0.5" /><span><span className="text-zinc-400 font-medium">Duration:</span> {Math.round(inv.durationMs / 1000)}s</span></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No violations recorded. Clean session.</p>
              )}
            </div>
          </div>

          {/* Time Allocation — accurate bar from backend minutes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Time Allocation <span className="text-[10px] font-normal text-zinc-600">({totalTrackedMin}m tracked)</span>
              </h3>
            </div>
            <div className="flex h-5 overflow-hidden rounded-full bg-zinc-800">
              {totalTrackedMin > 0 ? (
                <>
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 transition-all" style={{ width: `${(productiveMin / totalTrackedMin) * 100}%`, minWidth: productiveMin > 0 ? "4px" : "0px" }} title={`Productive: ${productiveMin}m`} />
                  <div className="bg-gradient-to-r from-rose-500 to-rose-400 transition-all" style={{ width: `${(distractionMin / totalTrackedMin) * 100}%`, minWidth: distractionMin > 0 ? "4px" : "0px" }} title={`Distraction: ${distractionMin}m`} />
                  <div className="bg-gradient-to-r from-zinc-500 to-zinc-400 transition-all" style={{ width: `${(idleMin / totalTrackedMin) * 100}%`, minWidth: idleMin > 0 ? "4px" : "0px" }} title={`Idle: ${idleMin}m`} />
                </>
              ) : (
                <div className="w-full h-full bg-zinc-800" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" /><span className="font-medium">Productive</span><span className="text-zinc-600">{productiveMin}m · {totalTrackedMin > 0 ? Math.round((productiveMin / totalTrackedMin) * 100) : 0}%</span></span>
              <span className="flex items-center gap-1.5 text-zinc-400"><span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20" /><span className="font-medium">Distraction</span><span className="text-zinc-600">{distractionMin}m · {totalTrackedMin > 0 ? Math.round((distractionMin / totalTrackedMin) * 100) : 0}%</span></span>
              <span className="flex items-center gap-1.5 text-zinc-400"><span className="h-2.5 w-2.5 rounded-full bg-zinc-500 ring-2 ring-zinc-500/20" /><span className="font-medium">Idle</span><span className="text-zinc-600">{idleMin}m · {totalTrackedMin > 0 ? Math.round((idleMin / totalTrackedMin) * 100) : 0}%</span></span>
            </div>
          </div>

          {/* Minute-by-Minute Chart — proportional scores from backend */}
          {hasChartData ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  Minute-by-Minute Performance
                </h3>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-zinc-500"><span className="h-1.5 w-3 rounded-full bg-purple-500" /> Focus</span>
                  <span className="flex items-center gap-1 text-zinc-500"><span className="h-1.5 w-3 rounded-full bg-emerald-500" /> Productivity</span>
                  {chartData.some(d => d.distraction) && <span className="flex items-center gap-1 text-rose-500"><span className="h-1.5 w-3 rounded-full bg-rose-500" /> Distraction</span>}
                </div>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
                      <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="second"
                      stroke="#52525b"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(v: number) => formatTime(v)}
                      label={{ value: "Time (MM:SS)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#52525b" }}
                    />
                    <YAxis domain={[0, 100]} stroke="#52525b" fontSize={10} tickLine={false} label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 10, fill: "#52525b" }} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload as typeof chartData[0];
                      return (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
                          <p className="text-[10px] font-semibold text-zinc-400 mb-1">Time {formatTime(Number(label))}</p>
                          <p className="text-[10px] text-zinc-500 mb-2">App: <span className="text-zinc-300">{data.appName}</span>{data.category !== "—" && <span className="text-zinc-600"> · {data.category}</span>}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-purple-500" /><span className="text-zinc-400">Focus:</span><span className="font-bold text-purple-400">{data.focus}</span></div>
                            <div className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-zinc-400">Productivity:</span><span className="font-bold text-emerald-400">{data.productivity}</span></div>
                            <div className="flex items-center gap-2 text-[10px]">
                              {data.distraction && <span className="text-rose-400">⚠ Distraction</span>}
                              {data.idle && !data.distraction && <span className="text-zinc-500">○ Idle</span>}
                              {!data.distraction && !data.idle && <span className="text-emerald-500">✓ Focused</span>}
                            </div>
                          </div>
                        </div>
                      );
                    }} />
                    <Area type="monotone" dataKey="focus" stroke="#a855f7" fill="url(#focusGrad)" strokeWidth={2} dot={{ r: 2, fill: "#a855f7" }} activeDot={{ r: 5 }} name="Focus" />
                    <Area type="monotone" dataKey="productivity" stroke="#10b981" fill="url(#prodGrad)" strokeWidth={2} dot={{ r: 2, fill: "#10b981" }} activeDot={{ r: 5 }} name="Productivity" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <BarChart3 className="h-6 w-6 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No minute-level data available for this session.</p>
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
              <button onClick={onStartAnother} className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-white hover:bg-purple-400"><RotateCcw className="h-4 w-4" />Start Another</button>
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
      <div className={`text-2xl font-bold ${color} tabular-nums`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-[10px] text-zinc-600">{sub}</div>
    </div>
  );
}