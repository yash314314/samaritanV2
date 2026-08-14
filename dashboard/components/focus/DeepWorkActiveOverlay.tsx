"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Coffee,
  Eye,
  Gauge,
  Lock,
  MessageSquare,
  Pause,
  Play,
  SkipForward,
  StopCircle,
  Target,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { focusApi } from "@/lib/api";
import { type AmbientSound, useAmbientAudio } from "@/lib/useAmbientAudio";
import type { InterventionAlert, LiveDeepWorkState } from "@/lib/useWs";

interface SessionData {
  id: string;
  goal: string | null;
  plannedMinutes: number;
  startedAt: string;
  enforcement: string;
  focusScore: number;
  productivityScore: number;
  violationCount: number;
  productiveMs: number;
  distractionMs: number;
  idleMs: number;
  interruptionMs: number;
  timerMode?: string;
  focusMinutes?: number;
  shortBreakMinutes?: number;
  longBreakMinutes?: number;
  currentPhase?: string;
  currentRound?: number;
  totalRounds?: number;
  phaseStartedAt?: string | null;
  phaseEndsAt?: string | null;
  phaseRemainingSeconds?: number;
  elapsedSeconds?: number;
  paused?: boolean;
  pausedAt?: string | null;
  ambientSound?: AmbientSound;
  ambientVolume?: number;
  allowedApps?: string[];
  allowedDomains?: string[];
  blockedApps?: string[];
  blockedDomains?: string[];
}

interface Props {
  session: SessionData;
  liveState?: LiveDeepWorkState;
  interventions?: InterventionAlert[];
  onDismissIntervention?: (id: string) => void;
  onComplete: (id: string) => void;
  onAbandon: (id: string) => void;
}

const enforcementStyles: Record<string, { icon: typeof Eye; style: string }> = {
  observe: { icon: Eye, style: "border-zinc-700 bg-zinc-900 text-zinc-400" },
  warn: { icon: MessageSquare, style: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  require_reason: { icon: AlertTriangle, style: "border-orange-500/30 bg-orange-500/10 text-orange-300" },
  block: { icon: Lock, style: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
};

const soundOptions: AmbientSound[] = ["none", "white", "pink", "brown", "rain"];

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function phaseLabel(phase: string) {
  if (phase === "short_break") return "Short break";
  if (phase === "long_break") return "Long break";
  return "Focus";
}

export default function DeepWorkActiveOverlay({
  session,
  liveState,
  interventions = [],
  onDismissIntervention,
  onComplete,
  onAbandon,
}: Props) {
  const [fallback, setFallback] = useState<SessionData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [timerBusy, setTimerBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"complete" | "abandon" | null>(null);
  const [sound, setSound] = useState<AmbientSound>(session.ambientSound ?? "none");

  const live = liveState?.active && liveState.sessionId === session.id ? {
    ...session,
    ...liveState,
    id: session.id,
    goal: liveState.goal ?? session.goal,
    startedAt: liveState.startedAt ?? session.startedAt,
  } : null;
  const current = live ?? fallback ?? session;
  const phase = current.currentPhase ?? "focus";
  const isBreak = phase !== "focus";
  const paused = Boolean(current.paused ?? current.pausedAt);
  const round = current.currentRound ?? 1;
  const rounds = current.totalRounds ?? 1;
  const phaseDuration = (phase === "focus"
    ? current.focusMinutes ?? current.plannedMinutes
    : phase === "long_break" ? current.longBreakMinutes ?? 15 : current.shortBreakMinutes ?? 5) * 60;
  const remainingSeconds = paused
    ? Math.max(0, current.phaseRemainingSeconds ?? phaseDuration)
    : current.phaseEndsAt
      ? Math.max(0, Math.ceil((new Date(current.phaseEndsAt).getTime() - now) / 1000))
      : Math.max(0, current.phaseRemainingSeconds ?? phaseDuration);
  const phaseProgress = Math.min(100, Math.max(0, ((phaseDuration - remainingSeconds) / Math.max(1, phaseDuration)) * 100));
  const elapsedSeconds = current.elapsedSeconds ?? Math.max(0, Math.floor((now - new Date(current.startedAt).getTime()) / 1000));
  const trackedMs = (current.productiveMs || 0) + (current.distractionMs || 0) + (current.idleMs || 0);
  const efficiency = trackedMs > 0 ? Math.round(((current.productiveMs || 0) / trackedMs) * 100) : 0;
  const activeViolation = interventions.find((item) => item.deepWorkId === session.id);
  const enforcement = enforcementStyles[current.enforcement] ?? enforcementStyles.observe;
  const EnforcementIcon = enforcement.icon;
  const audio = useAmbientAudio(sound, current.ambientVolume ?? 0.3, true);

  const restrictions = useMemo(() => [
    ...(current.allowedApps ?? []).map((value) => ({ label: "Allowed app", value, positive: true })),
    ...(current.allowedDomains ?? []).map((value) => ({ label: "Allowed domain", value, positive: true })),
    ...(current.blockedApps ?? []).map((value) => ({ label: "Blocked app", value, positive: false })),
    ...(current.blockedDomains ?? []).map((value) => ({ label: "Blocked domain", value, positive: false })),
  ].slice(0, 8), [current.allowedApps, current.allowedDomains, current.blockedApps, current.blockedDomains]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const response = await focusApi.getActiveStatus();
        if (response.data?.active && response.data.session?.id === session.id) setFallback(response.data.session);
      } catch (error) {
        console.warn("Deep Work fallback refresh failed", error);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [session.id]);

  async function runTimerAction(action: "pause" | "resume" | "skip") {
    setTimerBusy(true);
    try {
      const response = action === "pause"
        ? await focusApi.pause(session.id)
        : action === "resume" ? await focusApi.resume(session.id) : await focusApi.skipBreak(session.id);
      setFallback(response.data);
    } catch (error) {
      console.error(`Could not ${action} Deep Work timer`, error);
    } finally {
      setTimerBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex min-h-0 flex-col overflow-hidden bg-black text-zinc-100">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(63,63,70,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(63,63,70,.16)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className={`absolute inset-x-0 top-0 h-0.5 ${isBreak ? "bg-cyan-400" : "bg-purple-400"}`} style={{ transform: `scaleX(${phaseProgress / 100})`, transformOrigin: "left", transition: "transform 250ms linear" }} />

      <header className="relative flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-900 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${isBreak ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" : enforcement.style}`}>
            {isBreak ? <Coffee size={17} /> : <EnforcementIcon size={17} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : isBreak ? "bg-cyan-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`} /><span className="text-[10px] font-semibold uppercase text-zinc-400">{paused ? "Timer paused" : phaseLabel(phase)}</span>{current.timerMode === "pomodoro" && <span className="text-[10px] text-zinc-600">Round {round}/{rounds}</span>}</div>
            <h1 className="truncate text-sm font-medium">{current.goal || "Deep work session"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden rounded-md border px-2 py-1 text-[10px] uppercase sm:block ${isBreak ? "border-cyan-500/20 text-cyan-300" : enforcement.style}`}>{isBreak ? "Enforcement suspended" : current.enforcement.replace("_", " ")}</span>
          <button type="button" aria-label="Abandon session" onClick={() => setConfirmAction("abandon")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-rose-300"><X size={15} /></button>
        </div>
      </header>

      {activeViolation && !isBreak && <div className="relative flex shrink-0 items-center gap-3 border-b border-rose-500/20 bg-rose-500/10 px-5 py-2.5 text-xs text-rose-200"><AlertTriangle size={15} className="animate-pulse" /><span className="min-w-0 flex-1 truncate">{activeViolation.appName} violated this session: {activeViolation.action.replace("_", " ")}</span><button type="button" aria-label="Dismiss violation" onClick={() => onDismissIntervention?.(activeViolation.id)}><X size={14} /></button></div>}

      <main className="relative grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[480px] flex-col items-center justify-center border-b border-zinc-900 px-5 py-6 lg:border-b-0 lg:border-r">
          <div className={`mb-2 flex items-center gap-2 text-xs ${isBreak ? "text-cyan-300" : "text-purple-300"}`}>{current.timerMode === "pomodoro" ? <TimerReset size={14} /> : <Target size={14} />}{phaseLabel(phase)} {paused && "paused"}</div>
          <div className={`tabular-nums text-7xl font-semibold sm:text-8xl ${isBreak ? "text-cyan-100" : paused ? "text-amber-200" : "text-zinc-100"}`} style={{ letterSpacing: 0 }}>{formatClock(remainingSeconds)}</div>
          <div className="mt-5 h-2 w-full max-w-xl overflow-hidden rounded-full bg-zinc-900"><div className={`h-full origin-left transition-transform duration-300 ${isBreak ? "bg-cyan-400" : "bg-purple-500"}`} style={{ transform: `scaleX(${phaseProgress / 100})` }} /></div>
          <div className="mt-2 flex w-full max-w-xl justify-between text-[10px] text-zinc-600"><span>{formatClock(phaseDuration - remainingSeconds)}</span><span>{Math.round(phaseProgress)}%</span><span>{formatClock(phaseDuration)}</span></div>

          {current.timerMode === "pomodoro" && <div className="mt-6 flex items-center gap-2" aria-label={`Pomodoro round ${round} of ${rounds}`}>{Array.from({ length: rounds }, (_, index) => <span key={index} className={`h-2 rounded-full transition-all ${index + 1 < round ? "w-5 bg-emerald-400" : index + 1 === round ? `w-8 ${isBreak ? "bg-cyan-400" : "bg-purple-400"}` : "w-5 bg-zinc-800"}`} />)}</div>}

          <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric icon={<Brain size={15} />} label="Focus" value={current.focusScore?.toFixed(1) || "0.0"} tone="text-purple-300" />
            <Metric icon={<Gauge size={15} />} label="Productivity" value={current.productivityScore?.toFixed(1) || "0.0"} tone="text-emerald-300" />
            <Metric icon={<Target size={15} />} label="Efficiency" value={`${efficiency}%`} tone="text-cyan-300" />
            <Metric icon={<AlertTriangle size={15} />} label="Violations" value={String(current.violationCount || 0)} tone={current.violationCount ? "text-rose-300" : "text-zinc-400"} />
          </div>
        </section>

        <aside className="min-h-0 p-5">
          <section className="border-b border-zinc-900 pb-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-medium uppercase text-zinc-500">Ambient sound</h2><button type="button" onClick={audio.toggle} disabled={sound === "none"} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 disabled:opacity-30">{audio.playing ? <Volume2 size={15} /> : <VolumeX size={15} />}</button></div>
            <div className="grid grid-cols-5 gap-1">{soundOptions.map((option) => <button key={option} type="button" onClick={() => { setSound(option); audio.setSound(option); }} className={`rounded border px-1 py-1.5 text-[9px] capitalize ${sound === option ? "border-purple-500/40 bg-purple-500/10 text-purple-300" : "border-zinc-800 text-zinc-600 hover:text-zinc-300"}`}>{option}</button>)}</div>
            {sound !== "none" && <div className="mt-3 flex items-center gap-2"><VolumeX size={13} className="text-zinc-700" /><input aria-label="Ambient volume" type="range" min={0} max={1} step={0.05} value={audio.volume} onChange={(event) => audio.setVolume(Number(event.target.value))} className="min-w-0 flex-1 accent-purple-500" /><Volume2 size={13} className="text-zinc-500" /></div>}
            {audio.needsGesture && <button type="button" onClick={() => void audio.start()} className="mt-2 w-full rounded-md border border-purple-500/30 py-1.5 text-[10px] text-purple-300">Start sound</button>}
          </section>

          <section className="border-b border-zinc-900 py-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-medium uppercase text-zinc-500">Time allocation</h2><Activity size={14} className="text-zinc-700" /></div><TimeRow label="Productive" value={current.productiveMs || 0} total={trackedMs} color="bg-emerald-400" /><TimeRow label="Distracted" value={current.distractionMs || 0} total={trackedMs} color="bg-rose-400" /><TimeRow label="Idle" value={current.idleMs || 0} total={trackedMs} color="bg-zinc-500" /></section>

          <section className="py-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-medium uppercase text-zinc-500">Protocol</h2><span className="text-[10px] text-zinc-700">{restrictions.length} shown</span></div>{restrictions.length ? <div className="space-y-2">{restrictions.map((item) => <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3 text-xs"><span className="text-zinc-600">{item.label}</span><span className={`max-w-36 truncate ${item.positive ? "text-emerald-300" : "text-rose-300"}`}>{item.value}</span></div>)}</div> : <p className="text-xs leading-5 text-zinc-600">Classification weights determine whether activity follows this protocol.</p>}</section>
        </aside>
      </main>

      <footer className="relative flex min-h-16 shrink-0 items-center justify-center gap-2 border-t border-zinc-900 px-4 py-3">
        <button type="button" disabled={timerBusy} onClick={() => void runTimerAction(paused ? "resume" : "pause")} className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:border-purple-500/30 disabled:opacity-40" title={paused ? "Resume timer" : "Pause timer"}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        {isBreak && <button type="button" disabled={timerBusy} onClick={() => void runTimerAction("skip")} className="flex h-10 items-center gap-2 rounded-lg border border-cyan-500/30 px-3 text-xs text-cyan-300 disabled:opacity-40"><SkipForward size={15} /> Skip break</button>}
        <button type="button" onClick={() => setConfirmAction("complete")} className="flex h-10 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-medium text-emerald-300"><CheckCircle2 size={15} /> Complete</button>
        <button type="button" onClick={() => setConfirmAction("abandon")} className="flex h-10 items-center gap-2 rounded-lg border border-rose-500/20 px-4 text-xs text-rose-300"><StopCircle size={15} /> Abandon</button>
        <span className="hidden text-[10px] text-zinc-700 sm:block">{formatClock(elapsedSeconds)} elapsed</span>
      </footer>

      {confirmAction && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><div className="samaritan-card w-full max-w-sm p-5" role="dialog" aria-modal="true"><h2 className="text-base font-semibold">{confirmAction === "complete" ? "Complete this session?" : "Abandon this session?"}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{confirmAction === "complete" ? "The current phase and all tracked progress will be saved in the final report." : "Partial focus, violations, completed rounds, and enforcement attempts will still be reported."}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmAction(null)} className="h-9 px-3 text-sm text-zinc-500">Cancel</button><button type="button" onClick={() => { const action = confirmAction; setConfirmAction(null); if (action === "complete") onComplete(session.id); else onAbandon(session.id); }} className={`h-9 rounded-lg px-3 text-sm font-medium ${confirmAction === "complete" ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"}`}>Confirm</button></div></div></div>}
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <div className="border-l border-zinc-800 px-3 first:border-l-0"><div className={`flex items-center gap-1.5 ${tone}`}>{icon}<span className="text-lg font-semibold tabular-nums">{value}</span></div><div className="mt-1 text-[9px] uppercase text-zinc-600">{label}</div></div>;
}

function TimeRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return <div className="mb-3 last:mb-0"><div className="mb-1 flex justify-between text-[10px]"><span className="text-zinc-500">{label}</span><span className="text-zinc-600">{(value / 60_000).toFixed(1)}m</span></div><div className="h-1.5 overflow-hidden rounded-full bg-zinc-900"><div className={`h-full origin-left ${color} transition-transform duration-500`} style={{ transform: `scaleX(${percent / 100})` }} /></div></div>;
}
