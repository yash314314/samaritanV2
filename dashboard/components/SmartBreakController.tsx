"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Coffee,
  Loader2,
  Pause,
  Play,
  Settings2,
  Square,
  X,
} from "lucide-react";

import { breaksApi } from "@/lib/api";
import { useWsMessage } from "@/lib/ws";

type SmartBreakItem = {
  id: string;
  status: "suggested" | "snoozed" | "active" | "completed" | "skipped" | "expired";
  suggestedAt: string;
  dueAt: string;
  snoozedUntil: string | null;
  startedAt: string | null;
  endedAt: string | null;
  continuousWorkMs: number;
  recommendedMinutes: number;
  reason: string;
};

type SmartBreakSettings = {
  enabled: boolean;
  workThresholdMinutes: number;
  breakDurationMinutes: number;
  snoozeMinutes: number;
  resetIdleMinutes: number;
  workHoursOnly: boolean;
};

type SmartBreakState = {
  break: SmartBreakItem | null;
  settings: SmartBreakSettings;
  streak: {
    workMs: number;
    streakStartedAt: string | null;
    lastActivityAt: string | null;
    thresholdMs: number;
    progressPercent: number;
  };
};

const FALLBACK_SETTINGS: SmartBreakSettings = {
  enabled: true,
  workThresholdMinutes: 90,
  breakDurationMinutes: 10,
  snoozeMinutes: 15,
  resetIdleMinutes: 5,
  workHoursOnly: true,
};

function minuteLabel(milliseconds: number) {
  return Math.max(0, Math.round(milliseconds / 60_000));
}

function clockLabel(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export default function SmartBreakController() {
  const [state, setState] = useState<SmartBreakState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const endRequestedRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await breaksApi.next() as SmartBreakState;
      setState(next);
      if (next.break?.status === "suggested" || next.break?.status === "active") setPanelOpen(true);
    } catch (nextError) {
      console.error("Smart break refresh failed", nextError);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  useEffect(() => {
    if (state?.break?.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [state?.break?.status]);

  const acceptEvent = useCallback((payload: { break: SmartBreakItem }) => {
    setState((previous) => previous
      ? { ...previous, break: payload.break }
      : { break: payload.break, settings: FALLBACK_SETTINGS, streak: { workMs: 0, streakStartedAt: null, lastActivityAt: null, thresholdMs: 90 * 60_000, progressPercent: 0 } });
  }, []);

  useWsMessage<{ break: SmartBreakItem }>("break:suggested", (payload) => {
    acceptEvent(payload);
    setPanelOpen(true);
  });
  useWsMessage<{ break: SmartBreakItem }>("break:started", (payload) => {
    acceptEvent(payload);
    setPanelOpen(true);
  });
  useWsMessage<{ break: SmartBreakItem }>("break:snoozed", acceptEvent);
  useWsMessage<{ break: SmartBreakItem }>("break:skipped", () => {
    setState((previous) => previous ? { ...previous, break: null } : previous);
    setPanelOpen(false);
  });
  useWsMessage<{ break: SmartBreakItem }>("break:completed", () => {
    endRequestedRef.current = null;
    setState((previous) => previous ? { ...previous, break: null, streak: { ...previous.streak, workMs: 0, progressPercent: 0 } } : previous);
    setPanelOpen(false);
  });
  useWsMessage<{ settings: SmartBreakSettings }>("break:settings", (payload) => {
    setState((previous) => previous ? { ...previous, settings: payload.settings } : previous);
  });

  const activeBreak = state?.break?.status === "active" ? state.break : null;
  const remainingSeconds = activeBreak?.startedAt
    ? Math.max(0, Math.ceil((new Date(activeBreak.startedAt).getTime() + activeBreak.recommendedMinutes * 60_000 - now) / 1_000))
    : 0;

  const run = useCallback(async (name: string, action: () => Promise<unknown>) => {
    setBusyAction(name);
    setError("");
    try {
      await action();
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Break action failed");
    } finally {
      setBusyAction(null);
    }
  }, [refresh]);

  useEffect(() => {
    if (!activeBreak || remainingSeconds > 0 || endRequestedRef.current === activeBreak.id) return;
    endRequestedRef.current = activeBreak.id;
    run("end", () => breaksApi.end(activeBreak.id));
  }, [activeBreak, remainingSeconds, run]);

  if (activeBreak) {
    const totalSeconds = Math.max(1, activeBreak.recommendedMinutes * 60);
    const completedPercent = Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100));
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[#070707]/95 p-5 backdrop-blur-md">
        <div className="relative flex w-full max-w-xl flex-col items-center text-center">
          <div className="absolute inset-x-12 top-24 h-px bg-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.35)]" />
          <div className="smart-break-breathe relative mb-8 flex h-48 w-48 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/[0.06] shadow-[0_0_60px_rgba(168,85,247,0.12)]">
            <div className="absolute inset-3 rounded-full border border-purple-400/10" />
            <Coffee className="h-12 w-12 text-purple-300" strokeWidth={1.4} />
          </div>
          <div className="mb-2 text-xs font-semibold uppercase text-purple-300">Recovery in progress</div>
          <div className="font-mono text-6xl font-semibold text-zinc-50">{clockLabel(remainingSeconds)}</div>
          <p className="mt-3 max-w-sm text-sm text-zinc-400">Step away from the screen. This time is being logged as a recovery break.</p>
          <div className="mt-7 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-zinc-900">
            <div className="h-full rounded-full bg-purple-500 transition-[width] duration-1000 ease-linear" style={{ width: `${completedPercent}%` }} />
          </div>
          <button
            type="button"
            onClick={() => run("end", () => breaksApi.end(activeBreak.id))}
            disabled={busyAction === "end"}
            className="mt-8 inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-medium text-zinc-300 transition hover:border-purple-500/40 hover:text-white disabled:opacity-50"
          >
            {busyAction === "end" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            End break
          </button>
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        </div>
      </div>
    );
  }

  const item = state?.break ?? null;
  const settings = state?.settings ?? FALLBACK_SETTINGS;
  const workMinutes = minuteLabel(state?.streak.workMs ?? 0);
  const progressPercent = state?.streak.progressPercent ?? 0;

  if (!panelOpen && item?.status !== "suggested") {
    return (
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        title="Open smart recovery"
        className="fixed bottom-5 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-[#111] text-purple-300 shadow-lg transition hover:border-purple-400 hover:bg-[#18131d]"
      >
        <Coffee className="h-4 w-4" />
        {progressPercent >= 75 && settings.enabled && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[#111] bg-purple-400" />}
      </button>
    );
  }

  return (
    <div className="smart-break-enter fixed bottom-5 right-5 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-zinc-800 border-t-purple-500 bg-[#101010] shadow-2xl shadow-black/50">
      <div className="flex items-start gap-3 p-4">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-300">
          {item?.status === "snoozed" ? <Pause className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
          {item?.status === "suggested" && <span className="absolute inset-0 animate-ping rounded-full border border-purple-400/30" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-100">
              {item?.status === "suggested" ? "Recovery window" : item?.status === "snoozed" ? "Break snoozed" : "Smart recovery"}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" title="Break settings" onClick={() => setSettingsOpen((open) => !open)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200">
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Collapse" onClick={() => setPanelOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {item?.status === "suggested"
              ? item.reason
              : item?.status === "snoozed" && item.snoozedUntil
                ? `Returns at ${new Date(item.snoozedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : `${workMinutes} of ${settings.workThresholdMinutes} active minutes`}
          </p>
        </div>
      </div>

      {!settingsOpen && (
        <div className="border-t border-zinc-900 px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900">
              <div className="h-full rounded-full bg-purple-500 transition-[width] duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="w-9 text-right text-[11px] font-semibold text-purple-300">{progressPercent}%</span>
          </div>
          {item?.status === "suggested" ? (
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <button type="button" onClick={() => run("start", () => breaksApi.start({ breakId: item.id }))} disabled={Boolean(busyAction)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-purple-500 px-3 text-xs font-semibold text-white transition hover:bg-purple-400 disabled:opacity-50">
                {busyAction === "start" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Start {item.recommendedMinutes}m
              </button>
              <button type="button" title={`Snooze ${settings.snoozeMinutes} minutes`} onClick={() => run("snooze", () => breaksApi.snooze(item.id))} disabled={Boolean(busyAction)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:border-purple-500/40 hover:text-purple-300 disabled:opacity-50">
                <Pause className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Skip break" onClick={() => run("skip", () => breaksApi.skip(item.id))} disabled={Boolean(busyAction)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-50">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{settings.enabled ? "Monitoring active time" : "Suggestions paused"}</span>
              {item?.status === "snoozed" && <button type="button" onClick={() => run("start", () => breaksApi.start({ breakId: item.id }))} className="inline-flex items-center gap-1.5 text-purple-300 hover:text-purple-200"><Play className="h-3 w-3" /> Start now</button>}
            </div>
          )}
        </div>
      )}

      {settingsOpen && (
        <BreakSettings
          key={JSON.stringify(settings)}
          settings={settings}
          saving={busyAction === "settings"}
          onSave={(next) => run("settings", () => breaksApi.updateSettings(next))}
        />
      )}
      {error && <div className="border-t border-rose-500/20 bg-rose-500/5 px-4 py-2 text-xs text-rose-300">{error}</div>}
    </div>
  );
}

function BreakSettings({ settings, saving, onSave }: { settings: SmartBreakSettings; saving: boolean; onSave: (settings: SmartBreakSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const numberField = (key: "workThresholdMinutes" | "breakDurationMinutes" | "snoozeMinutes" | "resetIdleMinutes", label: string, min: number, max: number) => (
    <label className="flex items-center justify-between gap-3 text-xs text-zinc-400">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} className="h-8 w-20 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-right text-xs text-zinc-200 outline-none focus:border-purple-500/50" />
    </label>
  );

  return (
    <div className="space-y-3 border-t border-zinc-900 p-4">
      <label className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span>Smart breaks</span>
        <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} className="h-4 w-4 accent-purple-500" />
      </label>
      {numberField("workThresholdMinutes", "Work threshold", 15, 240)}
      {numberField("breakDurationMinutes", "Break duration", 1, 60)}
      {numberField("snoozeMinutes", "Snooze", 5, 120)}
      {numberField("resetIdleMinutes", "Idle reset", 2, 30)}
      <label className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span>Work hours only</span>
        <input type="checkbox" checked={draft.workHoursOnly} onChange={(event) => setDraft({ ...draft, workHoursOnly: event.target.checked })} className="h-4 w-4 accent-purple-500" />
      </label>
      <button type="button" disabled={!dirty || saving} onClick={() => onSave(draft)} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-purple-500 text-xs font-semibold text-white transition hover:bg-purple-400 disabled:opacity-40">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Save settings
      </button>
    </div>
  );
}
