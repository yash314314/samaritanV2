"use client";

import LiveClock from "./LiveClock";
import RecentActivity from "./RecentActivity";
import PeakWindow from "./PeakWindow";

function formatScore(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatPercent(value: any) {
  const n = formatScore(value);

  if (n <= 1) return `${Math.round(n * 100)}%`;
  return `${Math.round(n)}%`;
}

function formatDuration(secondsOrMs: any) {
  const value = Number(secondsOrMs ?? 0);

  if (!Number.isFinite(value) || value <= 0) return "0m";

  const ms = value > 100000 ? value : value * 1000;
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 60) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

function scoreTone(value: number, inverted = false) {
  const good = inverted ? value <= 35 : value >= 70;
  const warn = inverted
    ? value > 35 && value <= 65
    : value >= 45 && value < 70;

  if (good) {
    return {
      text: "text-emerald-400",
      bar: "bg-emerald-400",
      label: inverted ? "Sustainable" : "Strong"
    };
  }

  if (warn) {
    return {
      text: "text-amber-400",
      bar: "bg-amber-400",
      label: inverted ? "Elevated" : "Moderate"
    };
  }

  return {
    text: "text-red-400",
    bar: "bg-red-400",
    label: inverted ? "High" : "Low"
  };
}

function ScoreCard({
  label,
  value,
  inverted = false
}: {
  label: string;
  value: any;
  inverted?: boolean;
}) {
  const score = Math.max(0, Math.min(100, formatScore(value)));
  const tone = scoreTone(score, inverted);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase text-zinc-500">
            {label}
          </div>

          <div className={`text-xl font-semibold ${tone.text}`}>
            {score.toFixed(0)}
          </div>
        </div>

        <div className="text-[11px] text-zinc-500">
          {tone.label}
        </div>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full ${tone.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StatLine({
  label,
  value
}: {
  label: string;
  value: any;
}) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-medium truncate">
        {value}
      </span>
    </div>
  );
}

function deriveRead(daily: any, intelligence: any) {
  const focus = formatScore(daily?.averageFocusScore);
  const burnout = formatScore(daily?.averageBurnoutScore);
  const entropy = formatScore(daily?.averageEntropyScore);

  if (burnout >= 70) {
    return "High strain pattern detected. Reduce session length and protect recovery.";
  }

  if (entropy >= 70) {
    return "Fragmented activity pattern. Batch similar work and reduce switching.";
  }

  if (focus >= 75 && burnout < 45) {
    return "High-performance structure detected. Preserve this work rhythm.";
  }

  if (focus < 40) {
    return "Low focus signal. Start with one constrained work block.";
  }

  return intelligence?.suggestion ?? "Work pattern stable. Maintain structure.";
}

export default function MetricsPanel({
  daily,
  timeline,
  intelligence
}: any) {
  const focusScore = formatScore(daily?.averageFocusScore);
  const burnoutScore = formatScore(daily?.averageBurnoutScore);
  const entropyScore = formatScore(daily?.averageEntropyScore);

  const recent = Array.isArray(timeline) ? timeline : [];
  const currentActivity = recent[recent.length - 1];

  return (
    <div className="bg-[#141414] p-5 rounded-xl border border-[#262626] h-full flex flex-col gap-5 min-h-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Samaritan
          </h2>

          <div className="text-[11px] text-zinc-500">
            Intelligence layer active
          </div>
        </div>

        <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </span>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-[11px] text-zinc-500 uppercase mb-1">
          Current Time
        </p>
        <LiveClock />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-[11px] text-zinc-500 uppercase mb-2">
          Current State
        </p>

        <div className="text-sm font-medium text-zinc-200 truncate">
          {currentActivity?.appName ?? "No active activity"}
        </div>

        <div className="text-xs text-zinc-500 truncate mt-1">
          {currentActivity?.items?.at(-1)?.title ?? "Waiting for signal"}
        </div>
      </div>

      <div>
        <p className="text-xs text-zinc-400 uppercase mb-2">
          Today
        </p>

        <div className="grid grid-cols-1 gap-2">
          <ScoreCard label="Focus" value={focusScore} />
          <ScoreCard label="Burnout" value={burnoutScore} inverted />
          <ScoreCard label="Entropy" value={entropyScore} inverted />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
        <p className="text-xs text-zinc-400 uppercase">
          Load
        </p>

        <StatLine
          label="Tracked"
          value={formatDuration(daily?.totalActiveSeconds)}
        />

        <StatLine
          label="Idle"
          value={formatDuration(daily?.totalIdleSeconds)}
        />

        <StatLine
          label="Switches"
          value={daily?.totalSwitches ?? 0}
        />

        <StatLine
          label="Deep sessions"
          value={daily?.deepWorkSessions ?? 0}
        />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-xs text-zinc-400 uppercase mb-2">
          Samaritan Read
        </p>

        <p className="text-xs leading-relaxed text-zinc-300">
          {deriveRead(daily, intelligence)}
        </p>
      </div>

      <PeakWindow data={intelligence} />

      <div className="min-h-0 flex-1">
        <p className="text-xs text-zinc-400 uppercase mb-2">
          Recent Activity
        </p>

        <div className="max-h-72 overflow-y-auto pr-1">
          <RecentActivity data={timeline} />
        </div>
      </div>
    </div>
  );
}