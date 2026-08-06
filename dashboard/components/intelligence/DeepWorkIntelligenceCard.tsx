"use client";

import { useMemo } from "react";
import { 
  Target, 
  Flame, 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Activity,
  Zap
} from "lucide-react";

interface TrendDay {
  date: string;
  completed: number;
  abandoned: number;
  focus: number;
  productivity: number;
  plannedMinutes: number;
  actualMinutes: number;
}

interface DeepWorkData {
  sessionCount: number;
  completedCount: number;
  abandonedCount: number;
  completionRate: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  adherenceRate: number;
  avgFocusScore: number;
  avgProductivityScore: number;
  totalProductiveMinutes: number;
  totalDistractionMinutes: number;
  enforcementEffectiveness: number;
  totalViolations: number;
  avgViolations: number;
  deepWorkStreak: number;
  bestDeepWorkHour: number | null;
  bestDeepWorkScore: number;
  trend: TrendDay[];
  lastSession: {
    id: string;
    goal: string | null;
    plannedMinutes: number;
    status: string;
    focusScore: number;
    violationCount: number;
    startedAt: string;
    endedAt: string | null;
    enforcement: string;
  } | null;
  activeSession: {
    id: string;
    goal: string | null;
    plannedMinutes: number;
    elapsedMinutes: number;
    remainingMinutes: number;
    enforcement: string;
    focusScore: number;
    violationCount: number;
    productiveMs: number;
    distractionMs: number;
  } | null;
}

interface Props {
  data?: DeepWorkData | null;
}

export default function DeepWorkIntelligenceCard({ data }: Props) {
  if (!data) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-zinc-400 mb-3">
          <Target className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold">Deep Work Intelligence</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
          No deep work data
        </div>
      </div>
    );
  }

  const progress = data.activeSession
    ? (data.activeSession.elapsedMinutes / data.activeSession.plannedMinutes) * 100
    : 0;

  const trendSpark = useMemo(() => {
    if (!data.trend?.length) return [];
    return data.trend.map(d => d.focus);
  }, [data.trend]);

  return (
    <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2 text-zinc-400">
          <Target className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-zinc-200">Deep Work Intelligence</h3>
        </div>
        {data.activeSession ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <Activity className="w-3 h-3" />
            LIVE
          </span>
        ) : data.deepWorkStreak > 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
            <Flame className="w-3 h-3" />
            {data.deepWorkStreak} day streak
          </span>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        {/* Active Session Banner */}
        {data.activeSession && (
          <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-2.5 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-300 truncate max-w-[70%]">
                {data.activeSession.goal || "Deep Work Session"}
              </span>
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {data.activeSession.elapsedMinutes}m / {data.activeSession.plannedMinutes}m
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden mb-1.5">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-500" />
                Focus: {data.activeSession.focusScore.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-zinc-400" />
                {data.activeSession.enforcement}
              </span>
              {data.activeSession.violationCount > 0 && (
                <span className="flex items-center gap-1 text-rose-400">
                  <AlertTriangle className="w-3 h-3" />
                  {data.activeSession.violationCount}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="rounded-md bg-zinc-800/30 border border-zinc-800 p-2">
            <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Completion
            </div>
            <div className="text-sm font-bold text-zinc-200">{data.completionRate.toFixed(0)}%</div>
            <div className="text-[9px] text-zinc-600">{data.completedCount}/{data.sessionCount} sessions</div>
          </div>
          <div className="rounded-md bg-zinc-800/30 border border-zinc-800 p-2">
            <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-500" />
              Effectiveness
            </div>
            <div className="text-sm font-bold text-zinc-200">{data.enforcementEffectiveness.toFixed(0)}%</div>
            <div className="text-[9px] text-zinc-600">{data.totalProductiveMinutes}m productive</div>
          </div>
          <div className="rounded-md bg-zinc-800/30 border border-zinc-800 p-2">
            <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
              <Target className="w-3 h-3 text-purple-500" />
              Avg Focus
            </div>
            <div className="text-sm font-bold text-zinc-200">{data.avgFocusScore.toFixed(1)}</div>
            <div className="text-[9px] text-zinc-600">{data.avgViolations.toFixed(1)} violations avg</div>
          </div>
          <div className="rounded-md bg-zinc-800/30 border border-zinc-800 p-2">
            <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              Adherence
            </div>
            <div className="text-sm font-bold text-zinc-200">{data.adherenceRate.toFixed(0)}%</div>
            <div className="text-[9px] text-zinc-600">{data.totalActualMinutes.toFixed(0)}m of {data.totalPlannedMinutes}m</div>
          </div>
        </div>

        {/* 7-Day Micro Trend */}
        {trendSpark.length > 0 && (
          <div className="shrink-0">
            <div className="text-[10px] text-zinc-500 mb-1 flex items-center justify-between">
              <span>7-day focus trend</span>
              <span className="text-zinc-600">{data.trend[data.trend.length - 1]?.date.slice(5)}</span>
            </div>
            <div className="flex items-end gap-1 h-10">
              {data.trend.map((day, i) => {
                const h = Math.max(4, (day.focus / 100) * 32);
                const hasData = day.completed > 0 || day.abandoned > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={`w-full rounded-sm ${hasData ? 'bg-purple-500/60' : 'bg-zinc-800'}`}
                      style={{ height: `${hasData ? h : 4}px` }}
                    />
                    <span className="text-[8px] text-zinc-600">
                      {day.date.split('-')[2]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last Session */}
        {data.lastSession && !data.activeSession && (
          <div className="shrink-0 rounded-md bg-zinc-800/30 border border-zinc-800 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-500">Last session</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                data.lastSession.status === 'completed' 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                {data.lastSession.status}
              </span>
            </div>
            <div className="text-xs text-zinc-300 truncate mb-0.5">
              {data.lastSession.goal || "Untitled session"}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span>{data.lastSession.plannedMinutes}m planned</span>
              <span>Focus: {data.lastSession.focusScore}</span>
              {data.lastSession.violationCount > 0 && (
                <span className="text-rose-400 flex items-center gap-0.5">
                  <XCircle className="w-3 h-3" />
                  {data.lastSession.violationCount}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}