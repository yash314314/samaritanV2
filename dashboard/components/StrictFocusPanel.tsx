"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  endDeepWorkSession,
  fetchActiveDeepWorkSession,
} from "@/lib/api";
import { Brain, Gauge, Target, Flame, Clock, Activity, AlertTriangle, CheckCircle2, StopCircle } from "lucide-react";

interface DeepWorkSession {
  id?: string;
  startedAt?: string | Date;
  plannedMinutes?: number;
  goal?: string;
  focusScore?: number;
  productivityScore?: number;
  violationCount?: number;
  productiveMs?: number;
  distractionMs?: number;
  idleMs?: number;
  interventions?: Array<{
    id: string;
    appName: string;
    action: string;
    windowTitle: string;
  }>;
}

function formatDuration(ms: number) {
  if (!ms || ms <= 0) return "0m";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

interface StrictFocusPanelProps {
  userId: string;
  activeSession?: DeepWorkSession | null;
  onSessionChange?: () => void | Promise<void>;
}

export default function StrictFocusPanel({
  userId,
  activeSession: activeSessionProp,
  onSessionChange,
}: StrictFocusPanelProps) {
  const isControlled = activeSessionProp !== undefined;
  const [active, setActive] = useState<DeepWorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const displayedActive = isControlled ? activeSessionProp : active;

  async function refresh() {
    if (isControlled) {
      await onSessionChange?.();
      setLoading(false);
      return;
    }
    const session = await fetchActiveDeepWorkSession(userId);
    setActive(session);
    setLoading(false);
  }

  useEffect(() => {
    if (isControlled) {
      const tick = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(tick);
    }

    // Initial fetch
    fetchActiveDeepWorkSession(userId).then(session => {
      setActive(session);
      setLoading(false);
    });

    const poll = setInterval(() => {
      fetchActiveDeepWorkSession(userId).then(session => {
        setActive(session);
      });
    }, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [userId, isControlled]);

  const elapsedMs = useMemo(() => {
    if (!displayedActive?.startedAt) return 0;
    return now - new Date(displayedActive.startedAt).getTime();
  }, [displayedActive, now]);

  const plannedMs =
    (displayedActive?.plannedMinutes ?? 60) * 60 * 1000;

  const progress =
    plannedMs > 0
      ? Math.min(100, Math.max(0, (elapsedMs / plannedMs) * 100))
      : 0;

  const isOverdue = elapsedMs > plannedMs;

  async function endSession(status = "completed") {
    if (!displayedActive?.id) return;
    setSaving(true);
    await endDeepWorkSession(displayedActive.id, userId, status);
    await refresh();
    setSaving(false);
  }

  // Derived metrics
  const productiveMin = Math.round((displayedActive?.productiveMs || 0) / 60000);
  const distractionMin = Math.round((displayedActive?.distractionMs || 0) / 60000);
  const idleMin = Math.round((displayedActive?.idleMs || 0) / 60000);
  const totalTrackedMin = productiveMin + distractionMin + idleMin;
  const focusEfficiency = totalTrackedMin > 0
    ? Math.round((productiveMin / totalTrackedMin) * 100)
    : 0;

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-sm text-zinc-500">
        Loading focus protocol...
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">
            Strict Focus
          </h2>
          <div className="text-[11px] text-zinc-500 mt-1">
            {displayedActive ? "Active deep work protocol" : "Deep work protocol"}
          </div>
        </div>

        {displayedActive && (
          <span className="text-xs px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Active
          </span>
        )}
      </div>

      {displayedActive ? (
        <div className="space-y-5">
          {/* Goal & Timer */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-zinc-400">
                {displayedActive.goal || "Deep work session"}
              </span>
              <span className={`font-mono ${isOverdue ? "text-rose-400" : "text-zinc-500"}`}>
                {formatDuration(elapsedMs)} / {formatDuration(plannedMs)}
              </span>
            </div>

            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isOverdue ? "bg-rose-500" : progress > 85 ? "bg-emerald-500" : "bg-purple-500"
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>

          {/* Live Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Brain className="h-3.5 w-3.5" />} label="Focus" value={displayedActive.focusScore?.toFixed(0)} color="text-purple-400" />
            <Stat icon={<Gauge className="h-3.5 w-3.5" />} label="Productivity" value={displayedActive.productivityScore?.toFixed(0)} color="text-emerald-400" />
            <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Violations" value={displayedActive.violationCount ?? 0} color={(displayedActive.violationCount ?? 0) > 0 ? "text-rose-400" : "text-zinc-400"} />
          </div>

          {/* Time Breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Productive" value={formatDuration(displayedActive.productiveMs ?? 0)} color="text-blue-400" />
            <Stat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Distraction" value={formatDuration(displayedActive.distractionMs ?? 0)} color="text-rose-400" />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Idle" value={formatDuration(displayedActive.idleMs ?? 0)} color="text-zinc-400" />
          </div>

          {/* Efficiency */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase text-zinc-500">Focus Efficiency</span>
              <span className={`text-sm font-bold ${focusEfficiency > 70 ? "text-emerald-400" : focusEfficiency > 40 ? "text-amber-400" : "text-rose-400"}`}>
                {focusEfficiency}%
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  focusEfficiency > 70 ? "bg-emerald-500" : focusEfficiency > 40 ? "bg-amber-500" : "bg-rose-500"
                }`}
                style={{ width: `${focusEfficiency}%` }}
              />
            </div>
          </div>

          {/* Interventions */}
          {(displayedActive.interventions ?? []).length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase text-zinc-500 mb-2">
                Recent Interventions
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {(displayedActive.interventions ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="text-xs border-b border-zinc-800 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-300 truncate">
                        {item.appName}
                      </span>
                      <span className="text-amber-400 shrink-0">
                        {item.action}
                      </span>
                    </div>
                    <div className="text-zinc-500 truncate mt-1">
                      {item.windowTitle}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => endSession("completed")}
              className="flex-1 rounded-md bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-sm py-2 hover:bg-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => endSession("abandoned")}
              className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm py-2 hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <StopCircle className="h-3.5 w-3.5" />
              End
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
              <Clock className="h-6 w-6 text-zinc-500" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-1">No active deep work session</p>
          <p className="text-xs text-zinc-600">
            Start a session from the Focus Protocol page
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value?: React.ReactNode | string | number; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className={`flex items-center gap-1.5 text-[11px] uppercase ${color}`}>
        {icon}
        {label}
      </div>
      <div className={`text-sm font-semibold mt-1 ${color}`}>
        {value ?? 0}
      </div>
    </div>
  );
}