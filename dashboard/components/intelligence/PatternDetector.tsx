"use client";
import { Lightbulb, TrendingUp, TrendingDown, ArrowRight, Clock, Monitor } from "lucide-react";

interface Pattern {
  type: "positive" | "negative" | "neutral";
  metric: string;
  condition: string;
  impact: number; // % difference
  confidence: number; // 0-100
  recommendation: string;
}

interface PatternDetectorProps {
  data: {
    patterns: Pattern[];
    topPerformer: { intent: string; avgFocus: number; hours: number } | null;
    worstPerformer: { intent: string; avgFocus: number; hours: number } | null;
    timeOfDayWinner: { hour: number; avgFocus: number } | null;
  } | null;
}

export default function PatternDetector({ data }: PatternDetectorProps) {
  const { patterns = [], topPerformer = null, worstPerformer = null, timeOfDayWinner = null } = data ?? {};

  const sortedPatterns = [...patterns].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 4);

  if (!data || !data.patterns?.length) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Pattern Intelligence
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Data-driven correlations</p>
        </div>
      </div>

      {/* Top/Worst Performers */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {topPerformer && (
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider">Best Intent</p>
            <p className="text-sm font-bold text-emerald-400 capitalize mt-1">{topPerformer.intent.replace("_", " ")}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{topPerformer.avgFocus.toFixed(0)}% avg focus • {topPerformer.hours}h</p>
          </div>
        )}
        {worstPerformer && (
          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
            <p className="text-[10px] text-rose-500/70 uppercase tracking-wider">Needs Work</p>
            <p className="text-sm font-bold text-rose-400 capitalize mt-1">{worstPerformer.intent.replace("_", " ")}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{worstPerformer.avgFocus.toFixed(0)}% avg focus • {worstPerformer.hours}h</p>
          </div>
        )}
      </div>

      {/* Best Time */}
      {timeOfDayWinner?.hour != null && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 mb-5">
          <Clock className="w-4 h-4 text-purple-400" />
          <div>
            <p className="text-xs text-zinc-300">Peak performance window</p>
            <p className="text-sm font-bold text-purple-400">
  {String(timeOfDayWinner.hour).padStart(2, "0")}:00 —{" "}
  {timeOfDayWinner.avgFocus.toFixed(0)}% focus
</p>
          </div>
        </div>
      )}

      {/* Pattern List */}
      <div className="space-y-3">
        {sortedPatterns.map((pattern, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className={`mt-0.5 ${pattern.type === "positive" ? "text-emerald-400" : pattern.type === "negative" ? "text-rose-400" : "text-zinc-500"}`}>
              {pattern.type === "positive" ? <TrendingUp className="w-4 h-4" /> : 
               pattern.type === "negative" ? <TrendingDown className="w-4 h-4" /> : 
               <Monitor className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-zinc-300">{pattern.metric}</span>
                <ArrowRight className="w-3 h-3 text-zinc-600" />
                <span className="text-xs text-zinc-500">{pattern.condition}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${pattern.impact > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {pattern.impact > 0 ? "+" : ""}{pattern.impact}%
                </span>
                <span className="text-[10px] text-zinc-600">confidence {pattern.confidence}%</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{pattern.recommendation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}