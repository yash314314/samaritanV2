"use client";

import { useMemo } from "react";
import { Brain } from "lucide-react";

interface IntentItem {
  intent: string;
  percentage: number;
  avgFocus?: number;
  count?: number;
}

interface Props {
  data?: IntentItem[] | null;
}

const INTENT_STYLES: Record<string, string> = {
  coding: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  debugging: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25",
  writing: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  design: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  research: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  meeting: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  email: "bg-orange-400/15 text-orange-400 border-orange-400/25",
  chat: "bg-rose-400/15 text-rose-400 border-rose-400/25",
  slack: "bg-rose-400/15 text-rose-400 border-rose-400/25",
  discord: "bg-rose-400/15 text-rose-400 border-rose-400/25",
  social: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  browsing: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
  idle: "bg-zinc-600/15 text-zinc-400 border-zinc-600/25",
  reading: "bg-indigo-400/15 text-indigo-400 border-indigo-400/25",
  thinking: "bg-teal-400/15 text-teal-400 border-teal-400/25",
  music: "bg-violet-400/15 text-violet-400 border-violet-400/25",
  video: "bg-fuchsia-400/15 text-fuchsia-400 border-fuchsia-400/25",
  gaming: "bg-red-400/15 text-red-400 border-red-400/25",
  default: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

function getStyle(intent: string) {
  const key = intent.toLowerCase();
  for (const [k, v] of Object.entries(INTENT_STYLES)) {
    if (key.includes(k)) return v;
  }
  return INTENT_STYLES.default;
}

export default function IntentHeatmap({ data }: Props) {
  const intents = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return [...data]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 9);
  }, [data]);

  const totalPct = useMemo(() => {
    return intents.reduce((sum, i) => sum + (i.percentage || 0), 0);
  }, [intents]);

  const dominant = intents[0];

  if (!intents.length) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex flex-col">
        <div className="flex items-center gap-1.5 text-zinc-400 mb-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold">Work Intent Heatmap</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
          No intent data available
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 flex flex-col overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 text-zinc-400 min-w-0">
          <Brain className="w-4 h-4 text-purple-500 shrink-0" />
          <span className="text-sm font-semibold text-zinc-200 truncate">Work Intent Heatmap</span>
        </div>
        {dominant && (
          <div className="text-right leading-none shrink-0 ml-2">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Dominant</span>
            <span className="text-xs font-medium text-purple-400 capitalize">{dominant.intent}</span>
          </div>
        )}
      </div>

      {/* 3×3 grid — fills every available pixel */}
      <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-3 gap-1">
        {intents.map((item, idx) => {
          const pct = Math.max(0, Math.min(100, item.percentage || 0));
          const style = getStyle(item.intent);

          return (
            <div
              key={idx}
              className={`relative rounded-md border ${style} flex flex-col items-center justify-center overflow-hidden select-none`}
            >
              <span className="text-base sm:text-lg font-bold leading-none mb-0.5">
                {pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%
              </span>
              <span className="text-[10px] font-medium capitalize text-center leading-tight px-1 line-clamp-2">
                {item.intent}
              </span>

              {/* Bottom micro-bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                <div className="h-full bg-current opacity-60" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tight footer */}
      <div className="mt-1.5 pt-1 border-t border-zinc-800 shrink-0 flex items-center justify-between text-[10px] text-zinc-500">
        <span>{intents.length} of {data?.length || 0} intents</span>
        <span className="text-zinc-400">{totalPct.toFixed(1)}% total</span>
      </div>
    </div>
  );
}