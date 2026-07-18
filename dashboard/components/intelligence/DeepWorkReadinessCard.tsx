"use client";

import { useState, useEffect } from "react";
import { Zap, Clock, Shield, AlertTriangle, Play, Loader2 } from "lucide-react";
import { focusApi } from "../../lib/api";

interface ReadinessData {
  score: number; // 0-100
  factors: {
    timeOfDay: number; // 0-25 weight
    recentPattern: number; // 0-25
    burnoutRisk: number; // 0-25 (inverted)
    lastSessionQuality: number; // 0-25
  };
  recommendedDuration: number; // minutes
  bestWindow: { start: number; end: number } | null;
  riskFactors: string[];
}

interface DeepWorkReadinessCardProps {
  data: ReadinessData | null;
  onStartSession?: (duration: number) => void;
}

export default function DeepWorkReadinessCard({ data, onStartSession }: DeepWorkReadinessCardProps) {
  const [starting, setStarting] = useState(false);

  if (!data) return null;

  const { score, factors, recommendedDuration, bestWindow, riskFactors } = data;
  
  const getLevel = (s: number) => {
    if (s >= 75) return { label: "Optimal", color: "text-emerald-400", bar: "bg-emerald-500", border: "border-emerald-500/20", bg: "bg-emerald-500/10" };
    if (s >= 50) return { label: "Good", color: "text-purple-400", bar: "bg-purple-500", border: "border-purple-500/20", bg: "bg-purple-500/10" };
    if (s >= 25) return { label: "Fair", color: "text-amber-400", bar: "bg-amber-500", border: "border-amber-500/20", bg: "bg-amber-500/10" };
    return { label: "Poor", color: "text-rose-400", bar: "bg-rose-500", border: "border-rose-500/20", bg: "bg-rose-500/10" };
  };

  const level = getLevel(score);

  const handleStart = async () => {
    if (!onStartSession) return;
    setStarting(true);
    try {
      await onStartSession(recommendedDuration);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={`bg-zinc-900 border ${level.border} rounded-xl p-6 h-full relative overflow-hidden`}>
      {/* Glow effect for high readiness */}
      {score >= 75 && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4 relative">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
            Deep Work Readiness
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time cognitive conditions</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${level.bg} ${level.color} border ${level.border}`}>
          {level.label}
        </span>
      </div>

      {/* Main Score */}
      <div className="flex items-end gap-3 mb-5 relative">
        <span className={`text-6xl font-bold ${level.color}`}>{score}</span>
        <span className="text-sm text-zinc-500 mb-2">/100</span>
      </div>

      {/* Score Bar */}
      <div className="mb-5">
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full ${level.bar} rounded-full transition-all`} style={{ width: `${score}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-mono">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-2 mb-5">
        <FactorBar label="Time of Day" value={factors.timeOfDay} icon={<Clock className="w-3 h-3" />} />
        <FactorBar label="Recent Pattern" value={factors.recentPattern} icon={<Zap className="w-3 h-3" />} />
        <FactorBar label="Burnout Buffer" value={factors.burnoutRisk} icon={<Shield className="w-3 h-3" />} />
        <FactorBar label="Last Session" value={factors.lastSessionQuality} icon={<Clock className="w-3 h-3" />} />
      </div>

      {/* Recommended Session */}
      {recommendedDuration > 0 && (
        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Recommended</p>
              <p className="text-lg font-bold text-zinc-200">{recommendedDuration} min</p>
            </div>
            {bestWindow && (
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Best Window</p>
                <p className="text-sm font-mono text-zinc-400">
                  {bestWindow.start.toString().padStart(2, "0")}:00 – {bestWindow.end.toString().padStart(2, "0")}:00
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {riskFactors.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {riskFactors.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{risk}</span>
            </div>
          ))}
        </div>
      )}

      {/* Start Button */}
      {score >= 50 && onStartSession && (
        <button
          onClick={handleStart}
          disabled={starting}
          className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            score >= 75
              ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
              : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
          } disabled:opacity-50`}
        >
          {starting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start {recommendedDuration}-Min Deep Work
            </>
          )}
        </button>
      )}

      {score < 50 && (
        <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-xs text-rose-400/80 text-center">
          Conditions not optimal for deep work. Consider a recovery break.
        </div>
      )}
    </div>
  );
}

function FactorBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-purple-500" : value >= 20 ? "bg-amber-500" : "bg-rose-500";
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-4 text-zinc-600">{icon}</div>
      <span className="text-xs text-zinc-500 w-28">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-zinc-600 font-mono w-6 text-right">{value}</span>
    </div>
  );
}