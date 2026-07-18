"use client";

import { TrendingDown, TrendingUp, Minus, Activity, BrainCircuit } from "lucide-react";

interface CognitiveStabilityData {
  driftScore: number;
  entropyTrend: number;
  cognitiveStability: number;
  fragmentationScore: number;
  switchingRate: number;
  deepWorkRatio: number;
}

function getStabilityState(drift: number, entropy: number) {
  const combined = (drift + entropy) / 2;
  if (combined > 60) return {
    label: "Unstable",
    color: "text-rose-400",
    barColor: "bg-rose-500",
    description: "Significant focus decline and fragmentation detected. Recovery break recommended.",
    action: "Take a 15-min break before next deep work block."
  };
  if (combined > 35) return {
    label: "Moderate Drift",
    color: "text-amber-400",
    barColor: "bg-amber-500",
    description: "Some cognitive drift present. Attention requires stabilization.",
    action: "Consider a 5-min breathing exercise or walk."
  };
  return {
    label: "Stable",
    color: "text-emerald-400",
    barColor: "bg-emerald-500",
    description: "Focus remains consistent across sessions. Good condition for deep work.",
    action: "Conditions favorable. Start a deep work session."
  };
}

export default function CognitiveStabilityCard({ data }: { data: CognitiveStabilityData | null }) {
  if (!data) return null;

  const drift = data.driftScore ?? 0;
  const entropy = data.entropyTrend ?? 0;
  const stability = data.cognitiveStability ?? (100 - drift);
  const fragmentation = data.fragmentationScore ?? 0;
  const switching = data.switchingRate ?? 0;
  const deepWork = data.deepWorkRatio ?? 0;

  const state = getStabilityState(drift, entropy);
  const trend = drift > 50 ? "down" : drift < 30 ? "up" : "stable";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-purple-500" />
            Cognitive Stability
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Focus + entropy composite</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 ${state.color}`}>
          {state.label}
        </span>
      </div>

      {/* Main Score */}
      <div className="flex items-end gap-3 mb-4">
        <span className={`text-5xl font-bold ${state.color}`}>{stability.toFixed(0)}</span>
        <div className="flex items-center gap-1 mb-1.5">
          {trend === "down" ? (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          ) : trend === "up" ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <Minus className="w-4 h-4 text-zinc-500" />
          )}
          <span className={`text-xs ${trend === "down" ? "text-rose-400" : trend === "up" ? "text-emerald-400" : "text-zinc-500"}`}>
            {trend === "down" ? "Declining" : trend === "up" ? "Improving" : "Stable"}
          </span>
        </div>
      </div>

      {/* Stability Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Stability Index</span>
          <span>{stability.toFixed(0)}/100</span>
        </div>
        <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full ${state.barColor} rounded-full transition-all`} style={{ width: `${Math.min(stability, 100)}%` }} />
        </div>
      </div>

      {/* Sub-metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Drift</p>
          <p className="text-lg font-bold text-zinc-300 font-mono">{drift.toFixed(1)}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Entropy</p>
          <p className="text-lg font-bold text-zinc-300 font-mono">{entropy.toFixed(1)}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Fragmentation</p>
          <p className="text-lg font-bold text-zinc-300 font-mono">{fragmentation.toFixed(0)}%</p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Deep Work</p>
          <p className="text-lg font-bold text-purple-400 font-mono">{deepWork.toFixed(0)}%</p>
        </div>
      </div>

      {/* Description + Action */}
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <p className="text-xs text-zinc-500 leading-relaxed">{state.description}</p>
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
          <Activity className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
          <span className="text-xs text-purple-300">{state.action}</span>
        </div>
      </div>
    </div>
  );
}