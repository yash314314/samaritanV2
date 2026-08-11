"use client";

import LiveClock from "./LiveClock";
import RecentActivity from "./RecentActivity";
import { useCurrentActivity } from "../lib/useWs";

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

function MetricRow({
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
    <div className="group py-3 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase text-zinc-500">{label}</div>
          <div className="text-[11px] text-zinc-600">{tone.label}</div>
        </div>

        <div className={`tabular-nums text-2xl font-semibold leading-none ${tone.text}`}>
          {score.toFixed(0)}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className={`h-full rounded-full ${tone.bar} transition-all duration-700 ease-out group-hover:brightness-125`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value
}: {
  label: string;
  value: any;
}) {
  return (
    <div className="min-w-0 rounded-md bg-zinc-950/70 px-2.5 py-2">
      <div className="truncate text-[10px] uppercase text-zinc-600">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function deriveRead(daily: any) {
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

  return "Work pattern stable. Maintain structure.";
}

export default function MetricsPanel({
  daily,
  timeline
}: any) {
  const focusScore = formatScore(daily?.averageFocusScore);
  const burnoutScore = formatScore(daily?.averageBurnoutScore);
  const entropyScore = formatScore(daily?.averageEntropyScore);

  const recent = Array.isArray(timeline) ? timeline : [];
  const currentActivity = recent[recent.length - 1];
  const liveActivity = useCurrentActivity();
  const currentAppName = liveActivity?.appName ?? currentActivity?.appName;
  const currentTitle =
    liveActivity?.windowTitle ??
    currentActivity?.items?.at(-1)?.title;
  const hasLiveSignal = Boolean(liveActivity);
  const activitySubtitle = currentTitle ?? "Waiting for signal";

  return (
    <div className="samaritan-card h-full min-h-0 overflow-hidden p-5">
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-normal text-zinc-100">
              Samaritan
            </h2>

            <div className="mt-0.5 text-[11px] text-zinc-500">
              Focus tracker active
            </div>
          </div>

          <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>

        <div className="mt-5 rounded-lg bg-zinc-950/70 p-4 ring-1 ring-white/5 transition-colors duration-300 hover:bg-zinc-950">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase text-zinc-500">
              Current Time
            </p>
            <span className="text-[10px] text-zinc-600">IST</span>
          </div>
          <LiveClock />
        </div>

        <div className="mt-4 border-t border-zinc-900 pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase text-zinc-500">
              Current State
            </p>
            <span className={`text-[10px] ${hasLiveSignal ? "text-emerald-400" : "text-zinc-600"}`}>
              {hasLiveSignal ? "Live" : "Standby"}
            </span>
          </div>

          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.75)] animate-pulse" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-100">
                {currentAppName ?? "No active activity"}
              </div>
              <div className="mt-1 max-h-10 overflow-hidden break-words text-xs leading-relaxed text-zinc-500">
                {activitySubtitle}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-zinc-900 pt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs uppercase text-zinc-400">
              Today
            </p>
            <span className="text-[10px] text-zinc-600">0-100</span>
          </div>

          <div className="divide-y divide-zinc-900">
            <MetricRow label="Focus" value={focusScore} />
            <MetricRow label="Burnout" value={burnoutScore} inverted />
            <MetricRow label="Entropy" value={entropyScore} inverted />
          </div>
        </div>

        <div className="mt-4 border-t border-zinc-900 pt-4">
          <p className="mb-2 text-xs uppercase text-zinc-400">
            Load
          </p>

          <div className="grid grid-cols-2 gap-2">
            <StatPill label="Tracked" value={formatDuration(daily?.totalActiveSeconds)} />
            <StatPill label="Idle" value={formatDuration(daily?.totalIdleSeconds)} />
            <StatPill label="Switches" value={daily?.totalSwitches ?? 0} />
            <StatPill label="Deep" value={daily?.deepWorkSessions ?? 0} />
          </div>
        </div>

        <div className="mt-4 border-t border-zinc-900 pt-4">
          <p className="mb-2 text-xs uppercase text-zinc-400">
            Samaritan Read
          </p>

          <p className="text-xs leading-relaxed text-zinc-300">
            {deriveRead(daily)}
          </p>
        </div>

        <div className="mt-4 min-h-0 flex-1 border-t border-zinc-900 pt-4">
          <p className="mb-2 text-xs uppercase text-zinc-400">
            Recent Activity
          </p>

          <div className="max-h-72 overflow-y-auto pr-1">
            <RecentActivity data={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
