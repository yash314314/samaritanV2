"use client";

import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface PerformanceData {
  highPerformanceProbability?: number;
  peakFocusScore?: number;
  peakHour?: number | null;
  driftScore?: number;
  entropyTrend?: number;
  deepWorkRatio?: number;
}

function getPerformanceLevel(prob: number) {
  if (prob >= 80) return {
    label: "Elite",
    color: "text-emerald-400",
    barColor: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    description: "Your workflow strongly supports sustained deep focus. Conditions are optimal.",
  };
  if (prob >= 60) return {
    label: "High",
    color: "text-purple-400",
    barColor: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    description: "Good conditions for deep work. Minor optimizations possible.",
  };
  if (prob >= 40) return {
    label: "Moderate",
    color: "text-amber-400",
    barColor: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    description: "Focus potential exists but is disrupted by switching or fatigue.",
  };
  return {
    label: "Low",
    color: "text-rose-400",
    barColor: "bg-rose-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    description: "Frequent fragmentation or fatigue reduces deep focus probability.",
  };
}

export default function PerformanceProbabilityCard({ data }: { data: PerformanceData | null }) {
  if (!data) return null;

  const prob = Math.round((data.highPerformanceProbability ?? 0) * 100);
  const level = getPerformanceLevel(prob);

  // Secondary metrics
  const peakScore = data.peakFocusScore ?? 0;
  const peakHour = data.peakHour ?? null;
  const drift = data.driftScore ?? 0;
  const entropy = data.entropyTrend ?? 0;
  const deepWork = data.deepWorkRatio ?? 0;

  // Composite trend indicator
  const trend = useMemo(() => {
    const factors = [prob > 60 ? 1 : -1, drift < 40 ? 1 : -1, entropy < 50 ? 1 : -1, deepWork > 30 ? 1 : -1];
    const score = factors.reduce((a, b) => a + b, 0);
    if (score >= 3) return { icon: <TrendingUp className="w-4 h-4" />, label: "Improving", color: "text-emerald-400" };
    if (score <= -2) return { icon: <TrendingDown className="w-4 h-4" />, label: "Declining", color: "text-rose-400" };
    return { icon: <Minus className="w-4 h-4" />, label: "Stable", color: "text-zinc-500" };
  }, [prob, drift, entropy, deepWork]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-500" />
            Performance Probability
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Deep work success likelihood</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${level.bgColor} ${level.color} ${level.borderColor} border`}>
          {level.label}
        </span>
      </div>

      {/* Main Score */}
      <div className="flex items-end gap-3 mb-2">
        <span className={`text-5xl font-bold ${level.color}`}>{prob}%</span>
        <div className={`flex items-center gap-1 mb-1.5 ${trend.color}`}>
          {trend.icon}
          <span className="text-xs">{trend.label}</span>
        </div>
      </div>

      {/* Probability Bar */}
      <div className="mb-4">
        <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full ${level.barColor} rounded-full transition-all`} style={{ width: `${prob}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-mono">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-500 leading-relaxed mb-4">{level.description}</p>

      {/* Supporting Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Peak Score</p>
          <p className="text-lg font-bold text-purple-400 font-mono">{peakScore.toFixed(0)}%</p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Peak Hour</p>
          <p className="text-lg font-bold text-zinc-300 font-mono">
            {peakHour !== null ? `${peakHour.toString().padStart(2, "0")}:00` : "—"}
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Drift Impact</p>
          <p className={`text-lg font-bold font-mono ${drift > 50 ? "text-rose-400" : "text-emerald-400"}`}>
            {drift > 50 ? "−" : "+"}{Math.abs(50 - drift).toFixed(0)}%
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Deep Work Base</p>
          <p className="text-lg font-bold text-purple-400 font-mono">{deepWork.toFixed(0)}%</p>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Contributing Factors</p>
        
        <FactorRow label="Low drift" value={drift < 40} activeColor="text-emerald-400" />
        <FactorRow label="Stable entropy" value={entropy < 50} activeColor="text-emerald-400" />
        <FactorRow label="Deep work history" value={deepWork > 30} activeColor="text-emerald-400" />
        <FactorRow label="Peak hour proximity" value={peakHour !== null && Math.abs(new Date().getHours() - peakHour) <= 2} activeColor="text-emerald-400" />
      </div>

      {/* Recommendation */}
      {prob < 60 && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <div className="flex items-start gap-2">
            <Activity className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400/80 leading-relaxed">
              {prob < 40 
                ? "Reduce context switching and protect longer uninterrupted blocks to increase probability."
                : "Conditions are improving. Maintain current block scheduling and monitor drift."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FactorRow({ label, value, activeColor }: { label: string; value: boolean; activeColor: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={value ? activeColor : "text-zinc-700"}>
        {value ? "✓ Active" : "✗ Inactive"}
      </span>
    </div>
  );
}