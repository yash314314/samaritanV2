"use client";

import { useEffect, useMemo, useState } from "react";
import {
  endDeepWorkSession,
  fetchActiveDeepWorkSession,
  startDeepWorkSession
} from "@/lib/api";

const DURATIONS = [25, 50, 60, 90];

const ENFORCEMENT = [
  { label: "Observe", value: "observe" },
  { label: "Warn", value: "warn" },
  { label: "Require Reason", value: "require_reason" },
  { label: "Block", value: "block" }
];

function splitList(value: string) {
  return value
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function formatDuration(ms: number) {
  if (!ms || ms <= 0) return "0m";

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 60) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

interface StrictFocusPanelProps {
  userId: string;
  activeSession?: any | null;
  onSessionChange?: () => void | Promise<void>;
}

export default function StrictFocusPanel({
  userId,
  activeSession: activeSessionProp,
  onSessionChange,
}: StrictFocusPanelProps) {
  const isControlled = activeSessionProp !== undefined;
  const [active, setActive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [now, setNow] = useState(Date.now());

  const [goal, setGoal] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [enforcement, setEnforcement] = useState("require_reason");

  const [allowedApps, setAllowedApps] = useState(
    "cursor, visual studio code, terminal"
  );
  const [allowedDomains, setAllowedDomains] = useState(
    "localhost, github.com, docs"
  );
  const [blockedApps, setBlockedApps] = useState(
    "spotify, discord, valorant"
  );
  const [blockedDomains, setBlockedDomains] = useState(
    "instagram.com, youtube.com, netflix.com"
  );

  const displayedActive = isControlled ? activeSessionProp : active;

  async function refresh() {
    if (isControlled) {
      await onSessionChange?.();
      setLoading(false);
      return;
    }
    const session = await fetchActiveDeepWorkSession(userId);
    setActive(session);
    setLoading(false);
  }

  useEffect(() => {
    if (isControlled) {
      setLoading(false);
      const tick = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(tick);
    }

    refresh();

    const poll = setInterval(refresh, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [userId, isControlled]);

  const elapsedMs = useMemo(() => {
    if (!displayedActive?.startedAt) return 0;
    return now - new Date(displayedActive.startedAt).getTime();
  }, [displayedActive, now]);

  const plannedMs =
    (displayedActive?.plannedMinutes ?? plannedMinutes) * 60 * 1000;

  const progress =
    plannedMs > 0
      ? Math.min(100, Math.max(0, (elapsedMs / plannedMs) * 100))
      : 0;

  async function startSession() {
    setSaving(true);

    await startDeepWorkSession({
      userId,
      goal,
      plannedMinutes,
      enforcement,
      allowedApps: splitList(allowedApps),
      allowedDomains: splitList(allowedDomains),
      blockedApps: splitList(blockedApps),
      blockedDomains: splitList(blockedDomains)
    });

    await refresh();
    setSaving(false);
  }

  async function endSession(status = "completed") {
    if (!displayedActive?.id) return;

    setSaving(true);
    await endDeepWorkSession(displayedActive.id, userId, status);
    await refresh();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-sm text-zinc-500">
        Loading focus protocol...
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">
            Strict Focus
          </h2>

          <div className="text-[11px] text-zinc-500 mt-1">
            {displayedActive ? "Active deep work protocol" : "Deep work protocol"}
          </div>
        </div>

        {displayedActive && (
          <span className="text-xs px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            Active
          </span>
        )}
      </div>

      {displayedActive ? (
        <div className="space-y-5">
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-zinc-400">
                {displayedActive.goal || "Deep work session"}
              </span>

              <span className="text-zinc-500">
                {formatDuration(elapsedMs)} /{" "}
                {formatDuration(plannedMs)}
              </span>
            </div>

            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Focus" value={displayedActive.focusScore?.toFixed(0)} />
            <Stat
              label="Productivity"
              value={displayedActive.productivityScore?.toFixed(0)}
            />
            <Stat label="Violations" value={displayedActive.violationCount ?? 0} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Productive"
              value={formatDuration(displayedActive.productiveMs)}
            />
            <Stat
              label="Distraction"
              value={formatDuration(displayedActive.distractionMs)}
            />
            <Stat label="Idle" value={formatDuration(displayedActive.idleMs)} />
          </div>

          {displayedActive.interventions?.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase text-zinc-500 mb-2">
                Recent Interventions
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto">
                {displayedActive.interventions.map((item: any) => (
                  <div
                    key={item.id}
                    className="text-xs border-b border-zinc-800 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-300 truncate">
                        {item.appName}
                      </span>

                      <span className="text-amber-400 shrink-0">
                        {item.action}
                      </span>
                    </div>

                    <div className="text-zinc-500 truncate mt-1">
                      {item.windowTitle}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => endSession("completed")}
              className="flex-1 rounded-md bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-sm py-2 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Complete
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => endSession("abandoned")}
              className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm py-2 hover:bg-zinc-700 disabled:opacity-50"
            >
              End
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Goal"
            className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-purple-500"
          />

          <div className="flex flex-wrap gap-2">
            {DURATIONS.map(duration => (
              <button
                key={duration}
                type="button"
                onClick={() => setPlannedMinutes(duration)}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  plannedMinutes === duration
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {duration}m
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ENFORCEMENT.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setEnforcement(option.value)}
                className={`px-3 py-2 rounded-md text-xs border ${
                  enforcement === option.value
                    ? "bg-zinc-700 border-zinc-600 text-white"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <TextArea
            label="Allowed Apps"
            value={allowedApps}
            onChange={setAllowedApps}
          />

          <TextArea
            label="Allowed Domains"
            value={allowedDomains}
            onChange={setAllowedDomains}
          />

          <TextArea
            label="Blocked Apps"
            value={blockedApps}
            onChange={setBlockedApps}
          />

          <TextArea
            label="Blocked Domains"
            value={blockedDomains}
            onChange={setBlockedDomains}
          />

          <button
            type="button"
            disabled={saving}
            onClick={startSession}
            className="w-full rounded-md bg-purple-500 text-white text-sm py-2 hover:bg-purple-400 disabled:opacity-50"
          >
            Start Deep Work
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-[11px] text-zinc-500 uppercase">
        {label}
      </div>

      <div className="text-sm font-semibold text-zinc-200 mt-1">
        {value ?? 0}
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase text-zinc-500 mb-1">
        {label}
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-purple-500"
      />
    </label>
  );
}