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
      <div className="sam-ui fixed inset-0 z-[90] flex items-center justify-center bg-void p-5" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <h2 id="recovery-title" className="font-display text-[22px] uppercase tracking-[0.06em] text-signal">
            Recovery in progress
          </h2>
          <div className="mt-3 h-px w-56 bg-signal" aria-hidden />
          <span className="sam-triangle sam-pulse mt-2" aria-hidden />

          <div className="sam-numeral mt-10 text-[64px] leading-none" aria-live="off">{clockLabel(remainingSeconds)}</div>
          <p className="mt-4 max-w-sm text-[13px] text-trace">Step away from the screen. This time is logged as a recovery break.</p>

          <div className="sam-bar mt-8 w-full max-w-sm" role="progressbar" aria-label="Break progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completedPercent}>
            <span style={{ width: `${completedPercent}%` }} />
          </div>

          <button
            type="button"
            onClick={() => run("end", () => breaksApi.end(activeBreak.id))}
            disabled={busyAction === "end"}
            className="sam-button mt-10"
          >
            {busyAction === "end" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" strokeWidth={1.5} />}
            End break
          </button>
          {error && <p className="mt-4 border-l border-alert pl-3 text-left text-[12px] text-alert" role="alert">{error}</p>}
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
        title="Open recovery breaks"
        aria-label="Open recovery breaks"
        className="fixed bottom-5 right-5 z-50 flex h-9 w-9 items-center justify-center border border-grid bg-void text-key transition-colors hover:border-signal hover:text-signal"
      >
        <Coffee className="h-4 w-4" strokeWidth={1.5} />
        {progressPercent >= 75 && settings.enabled && <span className="sam-triangle absolute -right-1 -top-1 h-2 w-2.5" aria-hidden />}
      </button>
    );
  }

  return (
    <div className="sam-ui smart-break-enter fixed bottom-5 right-5 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden border border-grid bg-void">
      <div className="flex items-start gap-3 p-4">
        <span className={`sam-triangle mt-1 h-2 w-2.5 shrink-0 ${item?.status === "suggested" ? "sam-pulse" : "opacity-50"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="sam-key text-signal">
              {item?.status === "suggested" ? "Recovery window" : item?.status === "snoozed" ? "Break snoozed" : "Smart recovery"}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" title="Break settings" aria-label="Break settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)} className="flex h-7 w-7 items-center justify-center text-key transition-colors hover:text-signal">
                <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <button type="button" title="Collapse" aria-label="Collapse" onClick={() => setPanelOpen(false)} className="flex h-7 w-7 items-center justify-center text-key transition-colors hover:text-signal">
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-key">
            {item?.status === "suggested"
              ? item.reason
              : item?.status === "snoozed" && item.snoozedUntil
                ? `Returns at ${new Date(item.snoozedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : `${workMinutes} of ${settings.workThresholdMinutes} active minutes`}
          </p>
        </div>
      </div>

      {!settingsOpen && (
        <div className="border-t border-grid px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="sam-bar flex-1" role="progressbar" aria-label="Active time toward the next break" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="sam-value w-10 text-right text-[12px]">{progressPercent}%</span>
          </div>
          {item?.status === "suggested" ? (
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <button type="button" onClick={() => run("start", () => breaksApi.start({ breakId: item.id }))} disabled={Boolean(busyAction)} className="sam-button" data-variant="primary">
                {busyAction === "start" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" strokeWidth={1.5} />}
                Start {item.recommendedMinutes}m
              </button>
              <button type="button" title={`Snooze ${settings.snoozeMinutes} minutes`} onClick={() => run("snooze", () => breaksApi.snooze(item.id))} disabled={Boolean(busyAction)} aria-label={`Snooze ${settings.snoozeMinutes} minutes`} className="sam-button w-9 px-0">
                <Pause className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <button type="button" title="Skip break" onClick={() => run("skip", () => breaksApi.skip(item.id))} disabled={Boolean(busyAction)} aria-label="Skip break" className="sam-button w-9 px-0" data-variant="danger">
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[12px] text-key">
              <span>{settings.enabled ? "Monitoring active time" : "Suggestions paused"}</span>
              {item?.status === "snoozed" && <button type="button" onClick={() => run("start", () => breaksApi.start({ breakId: item.id }))} className="inline-flex items-center gap-1.5 text-signal transition-colors hover:text-accent"><Play className="h-3 w-3" strokeWidth={1.5} /> Start now</button>}
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
      {error && <div className="border-t border-alert px-4 py-2 text-[12px] text-alert" role="alert">{error}</div>}
    </div>
  );
}

function BreakSettings({ settings, saving, onSave }: { settings: SmartBreakSettings; saving: boolean; onSave: (settings: SmartBreakSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const numberField = (key: "workThresholdMinutes" | "breakDurationMinutes" | "snoozeMinutes" | "resetIdleMinutes", label: string, min: number, max: number) => (
    <label className="flex items-center justify-between gap-3 text-[12px] text-trace">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} className="sam-input h-8 w-20 text-right" />
    </label>
  );

  return (
    <div className="space-y-3 border-t border-grid p-4">
      <label className="flex items-center justify-between gap-3 text-[12px] text-trace">
        <span>Smart breaks</span>
        <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} className="h-4 w-4 accent-[var(--sam-accent)]" />
      </label>
      {numberField("workThresholdMinutes", "Work threshold (min)", 15, 240)}
      {numberField("breakDurationMinutes", "Break duration (min)", 1, 60)}
      {numberField("snoozeMinutes", "Snooze (min)", 5, 120)}
      {numberField("resetIdleMinutes", "Idle reset (min)", 2, 30)}
      <label className="flex items-center justify-between gap-3 text-[12px] text-trace">
        <span>Work hours only</span>
        <input type="checkbox" checked={draft.workHoursOnly} onChange={(event) => setDraft({ ...draft, workHoursOnly: event.target.checked })} className="h-4 w-4 accent-[var(--sam-accent)]" />
      </label>
      <button type="button" disabled={!dirty || saving} onClick={() => onSave(draft)} className="sam-button w-full" data-variant="primary">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
        Save settings
      </button>
    </div>
  );
}
