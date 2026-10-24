"use client";

import { useState } from "react";
import { Clock, Coffee, ArrowRight, Target, AlertTriangle } from "lucide-react";

interface Props {
  plannedMinutes: number;
  actualMinutes: number;
  goal: string;
  onExtend: (extraMinutes: number) => void;
  onBreak: () => void;
}

export default function DeepWorkExtensionPrompt({ plannedMinutes, actualMinutes, goal, onExtend, onBreak }: Props) {
  const [customMin, setCustomMin] = useState("");
  const shortfall = Math.max(0, plannedMinutes - actualMinutes);
  const fulfilled = actualMinutes >= plannedMinutes * 0.8;

  if (fulfilled) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="samaritan-card w-full max-w-md p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>

        <h3 className="mb-1 text-lg font-bold text-zinc-100">Objective Unfulfilled</h3>
        <p className="mb-1 text-sm text-zinc-400">
          You planned <span className="text-zinc-200 font-semibold">{plannedMinutes}m</span> for:
        </p>
        <p className="mb-4 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 border border-zinc-800">
          <Target className="inline h-3.5 w-3.5 mr-1 text-red-500" />
          {goal || "Deep work session"}
        </p>
        <p className="mb-6 text-sm text-zinc-500">
          Only <span className="text-red-400 font-bold">{actualMinutes}m</span> completed.
          <span className="block mt-1 text-xs text-zinc-600">{shortfall} minutes short of target.</span>
        </p>

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Extend by</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[15, 30, 45].map(min => (
              <button
                key={min}
                onClick={() => onExtend(min)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:border-red-500/50 hover:bg-zinc-700 transition-all"
              >
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                {min}m
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={customMin}
              onChange={e => setCustomMin(e.target.value)}
              placeholder="Custom"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-red-500/50"
            />
            <button
              onClick={() => customMin && onExtend(Number(customMin))}
              disabled={!customMin}
              className="sam-button" data-variant="primary"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={onBreak}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-3 text-sm font-medium text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-all"
        >
          <Coffee className="h-4 w-4" />
          Take a Break & Wind Up
        </button>
      </div>
    </div>
  );
}
