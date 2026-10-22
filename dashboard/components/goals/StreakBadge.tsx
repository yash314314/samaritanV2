"use client";

import { useState } from "react";
import { Flame, Trophy, Target, Award, Sparkles, CheckCircle2 } from "lucide-react";
import { goalsApi } from "@/lib/api";

interface GoalData {
  id: string;
  title: string;
  type: string;
  target: number;
  period: string;
  active: boolean;
}

interface StreakBadgeProps {
  currentFocusMinutes?: number;
  dailyGoalMinutes?: number;
  className?: string;
}

export default function StreakBadge({
  currentFocusMinutes = 210,
  dailyGoalMinutes = 240,
  className = "",
}: StreakBadgeProps) {
  const [streakDays, setStreakDays] = useState<number>(5);
  const [bestStreak, setBestStreak] = useState<number>(12);
  const progressPct = Math.min(100, Math.round((currentFocusMinutes / Math.max(1, dailyGoalMinutes)) * 100));

  const formatHours = (mins: number) => {
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-md font-sans text-zinc-100 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500">
            <Flame className="w-5 h-5 fill-red-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-zinc-100">{streakDays}-Day Focus Streak</h4>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/60 border border-red-800 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">Personal Best: {bestStreak} consecutive days</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-mono font-bold text-zinc-100">
            {formatHours(currentFocusMinutes)} / {formatHours(dailyGoalMinutes)}
          </div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Daily Target</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 mb-3">
        <div
          className="h-full bg-red-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Milestone Badges */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
          <Trophy className="w-3.5 h-3.5 text-zinc-400" />
          <span>Tier: Focus Artisan</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
          <span>{progressPct >= 100 ? "Goal Met Today!" : `${100 - progressPct}% to goal`}</span>
        </div>
      </div>
    </div>
  );
}
