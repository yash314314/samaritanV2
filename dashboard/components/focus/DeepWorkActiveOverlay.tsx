"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Pause,
  Play,
  StopCircle,
  TrendingUp,
  Minus,
  Flame,
  Lock,
  Eye,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Minus as MinusIcon,
  Timer,
  Target,
  Brain,
  Gauge,
} from "lucide-react";
import { focusApi } from "../../lib/api";
import type { InterventionAlert, LiveDeepWorkState } from "../../lib/useWs";

interface Intervention {
  id: string;
  appName: string;
  action: string;
  createdAt?: string;
  detectedAt?: string;
}

interface SessionData {
  id: string;
  goal: string | null;
  plannedMinutes: number;
  startedAt: string;
  enforcement: string;
  focusScore: number;
  productivityScore: number;
  violationCount: number;
  productiveMs: number;
  distractionMs: number;
  idleMs: number;
  interruptionMs: number;
  allowedApps?: string[];
  allowedDomains?: string[];
  blockedApps?: string[];
  blockedDomains?: string[];
  recentInterventions?: Intervention[];
}

interface Props {
  session: SessionData;
  liveState?: LiveDeepWorkState;
  interventions?: InterventionAlert[];
  onDismissIntervention?: (id: string) => void;
  onComplete: (id: string) => void;
  onAbandon: (id: string) => void;
}

const ENFORCEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  observe: Eye,
  warn: MessageSquare,
  require_reason: AlertTriangle,
  block: Lock,
};

const ENFORCEMENT_COLORS: Record<string, string> = {
  observe: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  warn: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  require_reason: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  block: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function DeepWorkActiveOverlay({
  session,
  liveState,
  interventions = [],
  onDismissIntervention,
  onComplete,
  onAbandon
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [polledSession, setPolledSession] = useState<SessionData | null>(null);
  const [showConfirm, setShowConfirm] = useState<"complete" | "abandon" | null>(null);
  const [recentViolation, setRecentViolation] = useState<Intervention | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);

  const startTimeRef = useRef(new Date(session.startedAt).getTime());
  const plannedSec = session.plannedMinutes * 60;
  const violationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pause tracking refs
  const pausedMsRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    startTimeRef.current = new Date(session.startedAt).getTime();
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
    };
  }, []);

  // Local timer with proper pause support
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedMsRef.current) / 1000);
      setElapsedSec(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Poll as a fallback; WebSocket updates drive the normal live path.
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await focusApi.getActiveStatus();
        if (!isMountedRef.current) return;
        if (res.data?.active && res.data.session) {
          const fresh = res.data.session as SessionData;
          setPolledSession(prev => {
            // Detect new violation
            if (fresh.violationCount > (prev?.violationCount || 0)) {
              const newIntervention = fresh.recentInterventions?.[0];
              if (newIntervention) {
                setRecentViolation(newIntervention);
                if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
                violationTimeoutRef.current = setTimeout(() => {
                  if (isMountedRef.current) setRecentViolation(null);
                }, 5000);
              }
            }
            return fresh;
          });
        }
      } catch (e) {
        // session ended externally — silently fail
      }
    }, 15000);
    return () => clearInterval(poll);
  }, []);

  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resuming
      if (pauseStartRef.current) {
        pausedMsRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      setIsPaused(false);
    } else {
      // Pausing
      pauseStartRef.current = Date.now();
      setIsPaused(true);
    }
  }, [isPaused]);

  const liveSession =
    liveState?.active && liveState.sessionId === session.id
      ? {
          ...session,
          id: liveState.sessionId || session.id,
          goal: liveState.goal ?? session.goal,
          startedAt: liveState.startedAt ?? session.startedAt,
          plannedMinutes: liveState.plannedMinutes || session.plannedMinutes,
          enforcement: liveState.enforcement || session.enforcement,
          focusScore: liveState.focusScore,
          productivityScore: liveState.productivityScore,
          violationCount: liveState.violationCount,
          productiveMs: liveState.productiveMs,
          distractionMs: liveState.distractionMs,
          idleMs: liveState.idleMs,
          interruptionMs: liveState.interruptionMs,
        }
      : null;

  const currentSession = liveSession ?? polledSession ?? session;
  const latestWsViolation = interventions.find((alert) => alert.deepWorkId === session.id);
  const visibleViolation = recentViolation ?? (latestWsViolation ? {
    id: latestWsViolation.id,
    appName: latestWsViolation.appName,
    action: latestWsViolation.action,
    detectedAt: latestWsViolation.detectedAt,
  } : null);

  const remainingSec = Math.max(0, plannedSec - elapsedSec);
  const progress = Math.min(100, (elapsedSec / plannedSec) * 100);
  const isOverdue = elapsedSec > plannedSec;
  const isFinalStretch = !isOverdue && remainingSec < 300; // < 5 min

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatDuration = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  };

  // Live metrics from polling
  const productiveMin = Math.round((currentSession.productiveMs || 0) / 60000);
  const distractionMin = Math.round((currentSession.distractionMs || 0) / 60000);
  const idleMin = Math.round((currentSession.idleMs || 0) / 60000);
  const totalTrackedMin = productiveMin + distractionMin + idleMin;

  // Focus efficiency: productive time / total tracked time
  const focusEfficiency = totalTrackedMin > 0
    ? Math.round((productiveMin / totalTrackedMin) * 100)
    : 0;

  // Distraction rate: violations per hour
  const elapsedHours = elapsedSec / 3600;
  const distractionRate = elapsedHours > 0
    ? (currentSession.violationCount / elapsedHours).toFixed(1)
    : "0.0";

  const enforcementColor = ENFORCEMENT_COLORS[currentSession.enforcement] || ENFORCEMENT_COLORS.observe;
  const EnforcementIcon = ENFORCEMENT_ICONS[currentSession.enforcement] || Eye;
  const signalLogs = liveState?.sessionId === session.id ? liveState.minuteLogs.slice(-24) : [];
  const protocolRules = [
    ...(currentSession.allowedApps ?? []).map((name) => ({ type: "Allowed app", name, tone: "text-emerald-400" })),
    ...(currentSession.allowedDomains ?? []).map((name) => ({ type: "Allowed domain", name, tone: "text-emerald-400" })),
    ...(currentSession.blockedApps ?? []).map((name) => ({ type: "Blocked app", name, tone: "text-rose-400" })),
    ...(currentSession.blockedDomains ?? []).map((name) => ({ type: "Blocked domain", name, tone: "text-rose-400" })),
  ].slice(0, 8);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(63,63,70,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(63,63,70,0.18)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className={`absolute left-0 top-0 h-0.5 w-full ${isOverdue ? "bg-rose-500/60" : "bg-emerald-400/50"} animate-pulse`} />
        <div
          className={`absolute inset-x-0 h-28 ${isOverdue ? "bg-rose-500/10" : "bg-emerald-500/10"} transition-all duration-1000`}
          style={{ top: `${Math.min(88, Math.max(0, progress))}%` }}
        />
      </div>

      {/* Violation Toast */}
      {visibleViolation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 shadow-lg backdrop-blur-sm">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <p className="text-sm font-medium text-rose-300">
                Violation detected: {visibleViolation.appName}
              </p>
              <p className="text-xs text-rose-400/70">
                Action: {visibleViolation.action}
              </p>
            </div>
            <button
              onClick={() => {
                if (visibleViolation?.id) onDismissIntervention?.(visibleViolation.id);
                setRecentViolation(null);
              }}
              className="ml-2 text-rose-400/50 hover:text-rose-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="relative flex items-center justify-between border-b border-zinc-800/50 px-6 py-3 backdrop-blur-sm bg-black/30">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${enforcementColor}`}>
            <EnforcementIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Deep Work Active</span>
              {isFinalStretch && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20 animate-pulse">
                  Final Stretch
                </span>
              )}
              {isOverdue && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20 animate-pulse">
                  Overtime
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 truncate max-w-[300px]">{currentSession.goal || "Untitled session"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMetrics((value) => !value)}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
          >
            {showMetrics ? "Hide telemetry" : "Show telemetry"}
          </button>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider ${enforcementColor}`}>
            {currentSession.enforcement}
          </span>
          <button
            onClick={() => setShowConfirm("abandon")}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 overflow-y-auto">
        {/* Timer */}
        <div className="mb-4 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className={`text-[7rem] font-bold leading-none tracking-tighter tabular-nums sm:text-[9rem] transition-colors duration-500 ${
            isOverdue ? "text-rose-500" : isFinalStretch ? "text-amber-400" : "text-zinc-100"
          }`}>
            {formatTime(isOverdue ? elapsedSec - plannedSec : remainingSec)}
          </div>
          <p className={`mt-2 text-sm font-medium transition-colors duration-300 ${isOverdue ? "text-rose-400" : "text-zinc-500"}`}>
            {isOverdue
              ? `${formatTime(elapsedSec - plannedSec)} over planned time`
              : isFinalStretch
                ? "Less than 5 minutes remaining"
                : "remaining"
            }
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 w-full max-w-lg animate-in fade-in duration-700">
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800/50">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                isOverdue ? "bg-rose-500" : progress > 85 ? "bg-emerald-500" : progress > 60 ? "bg-purple-500" : progress > 30 ? "bg-blue-500" : "bg-zinc-600"
              }`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-zinc-600 font-mono">
            <span>0:00</span>
            <span className="text-zinc-500">{Math.floor(progress)}%</span>
            <span>{session.plannedMinutes}:00</span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        {showMetrics && (
        <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <MetricTile
            icon={<Brain className="h-4 w-4" />}
            label="Focus Score"
            value={currentSession.focusScore?.toFixed(1) ?? "0.0"}
            trend={currentSession.focusScore > 70 ? "up" : currentSession.focusScore < 40 ? "down" : "neutral"}
            color="text-purple-400"
            bg="bg-purple-500/10"
            border="border-purple-500/20"
          />
          <MetricTile
            icon={<Gauge className="h-4 w-4" />}
            label="Productivity"
            value={currentSession.productivityScore?.toFixed(1) ?? "0.0"}
            trend={currentSession.productivityScore > 70 ? "up" : currentSession.productivityScore < 40 ? "down" : "neutral"}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            border="border-emerald-500/20"
          />
          <MetricTile
            icon={<Target className="h-4 w-4" />}
            label="Efficiency"
            value={`${focusEfficiency}%`}
            trend={focusEfficiency > 70 ? "up" : focusEfficiency < 40 ? "down" : "neutral"}
            color="text-blue-400"
            bg="bg-blue-500/10"
            border="border-blue-500/20"
          />
          <MetricTile
            icon={currentSession.violationCount > 0 ? <Flame className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            label="Distractions/hr"
            value={distractionRate}
            trend={currentSession.violationCount > 0 ? "down" : "neutral"}
            color={currentSession.violationCount > 0 ? "text-rose-400" : "text-zinc-500"}
            bg={currentSession.violationCount > 0 ? "bg-rose-500/10" : "bg-zinc-500/10"}
            border={currentSession.violationCount > 0 ? "border-rose-500/20" : "border-zinc-500/20"}
          />
        </div>
        )}

        {/* Time Breakdown Bars */}
        <div className="samaritan-card w-full max-w-2xl px-5 py-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Time Allocation</span>
            <span className="text-[10px] text-zinc-600">{totalTrackedMin}m tracked</span>
          </div>

          <div className="space-y-3">
            <TimeBar
              label="Productive"
              value={productiveMin}
              total={totalTrackedMin || 1}
              color="bg-gradient-to-r from-blue-500 to-blue-400"
              textColor="text-blue-400"
            />
            <TimeBar
              label="Distraction"
              value={distractionMin}
              total={totalTrackedMin || 1}
              color="bg-gradient-to-r from-rose-500 to-rose-400"
              textColor="text-rose-400"
            />
            <TimeBar
              label="Idle"
              value={idleMin}
              total={totalTrackedMin || 1}
              color="bg-gradient-to-r from-zinc-500 to-zinc-400"
              textColor="text-zinc-400"
            />
          </div>

          {currentSession.interruptionMs > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-[10px] text-amber-400/70">
              <AlertTriangle className="h-3 w-3" />
              Total interruption time: {formatDuration(currentSession.interruptionMs)}
            </div>
          )}
        </div>

        <div className="mt-3 grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
          <div className="samaritan-card px-5 py-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Minute Signal</span>
              <Activity className="h-4 w-4 text-zinc-600" />
            </div>
            <SignalRail logs={signalLogs} />
          </div>

          <div className="samaritan-card px-5 py-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Protocol Rules</span>
              <span className="text-[10px] text-zinc-600">{protocolRules.length || 0} active</span>
            </div>
            {protocolRules.length > 0 ? (
              <div className="space-y-1.5">
                {protocolRules.map((rule) => (
                  <div key={`${rule.type}-${rule.name}`} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500">{rule.type}</span>
                    <span className={`${rule.tone} max-w-40 truncate font-medium`}>{rule.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs leading-relaxed text-zinc-500">
                No explicit allow or block rules. Category and intent classification are enforcing this session.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="relative border-t border-zinc-800/50 px-6 py-4 backdrop-blur-sm bg-black/30">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
          <button
            onClick={togglePause}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:scale-105 active:scale-95 transition-all duration-200"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setShowConfirm("complete")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <CheckCircle2 className="h-4 w-4" />
            Complete Session
          </button>

          <button
            onClick={() => setShowConfirm("abandon")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-6 py-3 text-sm font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <StopCircle className="h-4 w-4" />
            Abandon
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="samaritan-card w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              {showConfirm === "complete" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-rose-400" />
              )}
            </div>
            <h3 className="mb-1 text-lg font-bold text-zinc-100">
              {showConfirm === "complete" ? "Complete Session?" : "Abandon Session?"}
            </h3>
            <p className="mb-6 text-sm text-zinc-500">
              {showConfirm === "complete"
                ? `You have worked ${formatTime(elapsedSec)} of ${session.plannedMinutes} minutes. This will save your progress.`
                : "This session will be marked as abandoned. Your partial progress will still be logged."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(null);
                  if (showConfirm === "complete") onComplete(session.id);
                  else onAbandon(session.id);
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  showConfirm === "complete"
                    ? "bg-emerald-500 text-white hover:bg-emerald-400"
                    : "bg-rose-500 text-white hover:bg-rose-400"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  trend,
  color,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  color: string;
  bg: string;
  border: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : MinusIcon;
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-zinc-500";

  return (
    <div className={`flex flex-col items-center gap-2 rounded-xl border ${border} ${bg} p-3 transition-all duration-300 hover:scale-105`}>
      <div className={`${color}`}>{icon}</div>
      <div className="flex items-center gap-1">
        <div className={`text-xl font-bold ${color} tabular-nums`}>{value}</div>
        <TrendIcon className={`h-3 w-3 ${trendColor}`} />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function TimeBar({
  label,
  value,
  total,
  color,
  textColor,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  textColor: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-[10px] font-medium text-zinc-500">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-10 text-right text-[10px] font-bold ${textColor} tabular-nums`}>{pct}%</span>
    </div>
  );
}

function SignalRail({
  logs,
}: {
  logs: LiveDeepWorkState["minuteLogs"];
}) {
  const cells = logs.length > 0 ? logs : Array.from({ length: 12 }, (_, index) => ({
    minute: index,
    focusScore: 0,
    productivityScore: 0,
    distraction: false,
    idle: true,
    appName: null,
  }));

  return (
    <div className="flex h-12 items-end gap-1">
      {cells.map((log, index) => {
        const height = Math.max(12, Math.round((log.focusScore || 0) * 0.42));
        const color = log.distraction
          ? "bg-rose-400"
          : log.idle
            ? "bg-zinc-600"
            : "bg-emerald-400";
        return (
          <div
            key={`${log.minute}-${index}`}
            title={log.appName || (log.idle ? "Idle" : "Focus")}
            className={`flex-1 rounded-sm ${color} transition-all duration-700`}
            style={{ height: `${height}px`, opacity: logs.length > 0 ? 1 : 0.35 }}
          />
        );
      })}
    </div>
  );
}
