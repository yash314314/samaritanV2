"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/sam/PageHeader";
import { Decode } from "@/components/sam/Decode";
import SamLoading from "@/components/sam/SamLoading";
import {
  Archive,
  CalendarRange,
  Check,
  CircleAlert,
  CircleCheck,
  Flame,
  Gauge,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

import { goalsApi, projectsApi } from "@/lib/api";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { ThemedDatePicker } from "./DatePicker";
// Goal dates are calendar-day keys; build and read them from local date
// parts (toISOString would shift them to the previous day in IST).
import { useWsMessage } from "@/lib/ws";
import { playSamaritanDialogSequence, playSamaritanDismiss } from "@/lib/samaritanAudio";
import { getUserId } from "@/lib/auth";


type Project = { id: string; name: string; color: string };
type Goal = {
  id: string;
  active: boolean;
  title: string;
  description?: string | null;
  type: string;
  unit?: string | null;
  target: number;
  progress: number;
  progressRatio: number;
  rawProgressRatio: number;
  remaining: number;
  period: string;
  priority: string;
  status: "completed" | "on_track" | "at_risk";
  pacePercent: number;
  expectedProgress: number;
  forecast: number;
  streak: number;
  periodStart: string;
  periodEnd: string;
  startDate?: string | null;
  endDate?: string | null;
  projectId?: string | null;
  project?: Project | null;
};
type Summary = { active: number; completed: number; onTrack: number; atRisk: number; averageProgress: number; bestStreak: number };
type Snapshot = { id: string; periodStart: string; periodEnd: string; progress: number; target: number; completed: boolean };

// Target stays a string while editing so the field can be cleared and can hold
// a half-typed decimal such as "1."; it becomes a number on submit.
const emptyForm = { title: "", description: "", type: "focus_minutes", unit: "", target: "60", period: "daily", priority: "medium", startDate: "", endDate: "", projectId: "" };

function unit(goal: Pick<Goal, "unit" | "type">) {
  if (goal.unit) return goal.unit;
  if (goal.type === "hours") return "hours";
  if (goal.type === "sessions") return "sessions";
  return "minutes";
}

function value(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function dateLabel(date: string, period: string) {
  return new Intl.DateTimeFormat(undefined, period === "daily" ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" }).format(new Date(date));
}

const statusStyle = {
  completed: "bg-white/10 text-white border-white/20",
  on_track: "bg-zinc-800 text-zinc-300 border-zinc-700",
  at_risk: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<Summary>({ active: 0, completed: 0, onTrack: 0, atRisk: 0, averageProgress: 0, bestStreak: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [period, setPeriod] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    playSamaritanDialogSequence(1.0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSamaritanDismiss(0.9);
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selected = goals.find((goal) => goal.id === selectedId) || null;

  const load = useCallback(async () => {
    try {
      const selectedPeriod = period === "all" ? undefined : period;
      const [data, allGoals] = await Promise.all([
        goalsApi.dashboard(getUserId(), selectedPeriod) as Promise<{ goals: Goal[]; summary: Summary }>,
        showArchived ? goalsApi.list(getUserId(), selectedPeriod, true) as Promise<Goal[]> : Promise.resolve(null),
      ]);
      const visibleGoals = allGoals || data.goals;
      setGoals(visibleGoals);
      setSummary(data.summary);
      setSelectedId((current) => current && visibleGoals.some((goal) => goal.id === current) ? current : visibleGoals[0]?.id || null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load goals");
    } finally {
      setLoading(false);
    }
  }, [period, showArchived]);

  const loadHistory = useCallback(async (goalId: string) => {
    try {
      const data = await goalsApi.history(goalId, getUserId(), 14) as { history: Snapshot[] };
      setHistory(data.history);
    } catch (caught) {
      console.error(caught);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { projectsApi.list(getUserId()).then((data) => setProjects(data as Project[])).catch(console.error); }, []);
  useEffect(() => {
    if (!selectedId) return setHistory([]);
    void loadHistory(selectedId);
  }, [loadHistory, selectedId]);

  const refresh = useCallback(async () => {
    await load();
    if (selectedId) await loadHistory(selectedId);
  }, [load, loadHistory, selectedId]);

  useWsMessage<{ goals: Goal[] }>("goal:progress", () => void refresh());
  useRealtimeRefresh(refresh, { events: ["goal:changed", "activity:new", "deepwork:ended", "calendar:session.updated", "project:changed"], debounceMs: 600 });

  const maxHistory = Math.max(1, ...history.map((item) => Math.max(item.target, item.progress)));
  const circumference = 2 * Math.PI * 42;
  const progressOffset = selected ? circumference * (1 - Math.min(1, selected.progressRatio)) : circumference;
  const summaryCards = [
    { label: "Active", metric: summary.active, icon: Target },
    { label: "Completed", metric: summary.completed, icon: CircleCheck },
    { label: "On track", metric: summary.onTrack, icon: TrendingUp },
    { label: "At risk", metric: summary.atRisk, icon: CircleAlert },
    { label: "Best streak", metric: summary.bestStreak, icon: Flame },
  ];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id);
    setForm({ title: goal.title, description: goal.description || "", type: goal.type, unit: goal.unit || "", target: String(goal.target), period: goal.period, priority: goal.priority, startDate: goal.startDate?.slice(0, 10) || "", endDate: goal.endDate?.slice(0, 10) || "", projectId: goal.project?.id || goal.projectId || "" });
    setError(null);
    setShowModal(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const target = Number(form.target);
    if (!form.target.trim() || !Number.isFinite(target) || target <= 0) {
      setError("Target must be a number above 0.");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("Custom end must be on or after custom start.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { userId: getUserId(), ...form, target, unit: form.unit || undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined, projectId: form.projectId || undefined };
    try {
      if (editingId) await goalsApi.update(editingId, payload);
      else await goalsApi.create(payload);
      setShowModal(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save goal");
    } finally {
      setBusy(false);
    }
  }

  async function archive(goal: Goal) {
    if (!confirm(`Archive ${goal.title}?`)) return;
    await goalsApi.delete(goal.id);
    await load();
  }

  async function restore(goal: Goal) {
    setBusy(true);
    setError(null);
    try {
      await goalsApi.restore(goal.id, getUserId());
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to restore goal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-page text-zinc-100">
      <div className="dashboard-surface flex h-full flex-col gap-3">
        <PageHeader
          title="Goals"
          description="Live pace and recurring progress toward your daily, weekly and monthly targets."
          actions={
            <>
              <button type="button" aria-label="Refresh goals" title="Refresh" onClick={() => void load()} className="sam-button h-8 w-8 px-0">
                <RefreshCw size={14} strokeWidth={1.5} className={loading ? "animate-spin" : ""} />
              </button>
              <button type="button" onClick={openCreate} className="sam-button" data-variant="primary">
                <Plus size={14} strokeWidth={1.5} /> New goal
              </button>
            </>
          }
        />

        {error && !showModal && <div className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"><CircleAlert size={14} /><span className="min-w-0 flex-1 truncate">{error}</span><button onClick={() => setError(null)}><X size={14} /></button></div>}

        <section className="samaritan-card grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)]">
          <div className="grid shrink-0 grid-cols-2 border-b border-zinc-900 sm:grid-cols-3 md:grid-cols-5">
            {summaryCards.map(({ label, metric, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-2 border-r border-zinc-900 px-3 py-2.5 last:border-r-0"><Icon size={14} className="shrink-0 text-red-500" /><div className="min-w-0"><div className="truncate text-sm font-semibold"><Decode value={metric} /></div><div className="truncate text-[10px] text-zinc-600">{label}</div></div></div>)}
          </div>

          <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-900 px-3">
            <div role="tablist" aria-label="Goal period" className="flex h-full items-end gap-1">{(["all", "daily", "weekly", "monthly"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={period === item} onClick={() => setPeriod(item)} className={`h-11 border-b-2 px-3 text-xs capitalize transition ${period === item ? "border-red-500 text-white font-medium" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{item}</button>)}</div>
            <div className="flex items-center gap-3"><button type="button" aria-pressed={showArchived} onClick={() => setShowArchived((value) => !value)} className={`flex items-center gap-1.5 text-[11px] transition ${showArchived ? "text-red-400" : "text-zinc-600 hover:text-zinc-300"}`}><Archive size={13} />{showArchived ? "Hide archived" : "Show archived"}</button><div className="text-xs text-zinc-600">Average progress {summary.averageProgress}%</div></div>
          </div>

          <div className="grid min-h-0 md:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="dashboard-scroll-panel border-b border-zinc-900 md:border-b-0 md:border-r">
              {loading ? <SamLoading compact label="Loading goals" /> : goals.length === 0 ? <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-600"><Target size={26} /><span className="text-sm">No goals in this period</span></div> : goals.map((goal) => (
                <button key={goal.id} type="button" aria-current={selectedId === goal.id ? "true" : undefined} onClick={() => setSelectedId(goal.id)} className={`w-full border-b border-zinc-900 px-4 py-3 text-left transition ${goal.active ? "" : "opacity-60"} ${selectedId === goal.id ? "bg-red-500/10 border-l-2 border-red-500" : "hover:bg-zinc-950"}`}>
                  <div className="flex items-start gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${goal.status === "completed" ? "bg-white" : goal.status === "at_risk" ? "bg-red-500" : "bg-zinc-400"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-zinc-200">{goal.title}</span><span className="mt-1 block truncate text-[11px] text-zinc-600">{value(goal.progress)} / {value(goal.target)} {unit(goal)}</span></span><span className="text-xs font-mono font-medium text-white">{Math.round(goal.progressRatio * 100)}%</span></div>
                  {!goal.active && <div className="mt-1 ml-5 text-[9px] font-medium uppercase text-zinc-600">Archived</div>}
                  <div className="mt-2 ml-5 h-1 bg-zinc-900"><div className={`sam-fill h-full transition-all duration-700 ${goal.status === "completed" ? "bg-white" : goal.status === "at_risk" ? "bg-red-500" : "bg-zinc-500"}`} style={{ width: `${Math.min(100, goal.progressRatio * 100)}%` }} /></div>
                </button>
              ))}
            </aside>

            <main className="dashboard-scroll-panel">
              {selected ? <div className="grid min-h-full content-start lg:grid-cols-[minmax(0,1fr)_230px]">
                <section className="border-b border-zinc-900 p-5 lg:border-r">
                  <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex items-center gap-2"><span className={`rounded-md border px-2 py-1 text-[10px] capitalize ${statusStyle[selected.status]}`}>{selected.active ? selected.status.replace('_', ' ') : "archived"}</span><span className="text-[10px] uppercase text-zinc-600">{selected.period}</span>{selected.project && <span className="truncate rounded-md border border-zinc-800 px-2 py-1 text-[10px]" style={{ color: selected.project.color }}>{selected.project.name}</span>}</div><h2 className="truncate text-lg font-semibold">{selected.title}</h2>{selected.description && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{selected.description}</p>}</div>{selected.active ? <><button title="Edit goal" onClick={() => openEdit(selected)} className="sam-button h-8 w-8 px-0"><Pencil size={14} /></button><button title="Archive goal" onClick={() => void archive(selected)} className="sam-button h-8 w-8 px-0"><Archive size={14} /></button></> : <button disabled={busy} title="Restore goal" onClick={() => void restore(selected)} className="flex h-8 items-center gap-1.5 rounded-none border border-zinc-700 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"><RotateCcw size={14} /> Restore</button>}</div>
                  <div className="mt-5 flex items-center gap-5"><div className="relative h-28 w-28 shrink-0"><svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--sam-void)" strokeWidth="8" /><circle cx="50" cy="50" r="42" fill="none" stroke={selected.status === "completed" ? "var(--sam-series-3)" : selected.status === "at_risk" ? "var(--sam-warn)" : "var(--sam-series-1)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={progressOffset} className="sam-ring transition-all duration-700" style={{ ["--sam-ring-length" as string]: circumference }} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-semibold"><Decode value={`${Math.round(selected.progressRatio * 100)}%`} /></span><span className="text-[9px] text-zinc-600">complete</span></div></div><div className="min-w-0 flex-1"><div className="text-2xl font-semibold"><Decode value={value(selected.progress)} /> <span className="text-sm font-normal text-zinc-500">/ {value(selected.target)} {unit(selected)}</span></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div><span className="block text-[10px] text-zinc-600">Remaining</span><span className="text-zinc-300">{value(selected.remaining)} {unit(selected)}</span></div><div><span className="block text-[10px] text-zinc-600">Forecast</span><span className="text-zinc-300">{value(selected.forecast)} {unit(selected)}</span></div><div><span className="block text-[10px] text-zinc-600">Expected now</span><span className="text-zinc-300">{value(selected.expectedProgress)}</span></div><div><span className="block text-[10px] text-zinc-600">Current pace</span><span className={selected.pacePercent >= 100 ? "text-white font-mono" : "text-red-400 font-mono"}>{selected.pacePercent}%</span></div></div></div></div>
                </section>

                <aside className="border-b border-zinc-900 p-5"><h3 className="mb-4 text-xs font-medium uppercase text-zinc-500">Current period</h3><div className="space-y-4"><div className="flex items-center gap-3"><CalendarRange size={16} className="text-white" /><div><div className="text-xs text-zinc-300">{dateLabel(selected.periodStart, selected.period)} to {dateLabel(selected.periodEnd, selected.period)}</div><div className="text-[10px] text-zinc-600">{selected.period} window</div></div></div><div className="flex items-center gap-3"><Flame size={16} className="text-red-500" /><div><div className="text-xs text-zinc-300">{selected.streak} period streak</div><div className="text-[10px] text-zinc-600">consecutive completions</div></div></div><div className="flex items-center gap-3"><Gauge size={16} className="text-zinc-400" /><div><div className="text-xs capitalize text-zinc-300">{selected.priority} priority</div><div className="text-[10px] text-zinc-600">tracking automatically</div></div></div></div></aside>

                <section className="p-5 lg:col-span-2"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-medium uppercase text-zinc-500">Period history</h3><span className="text-[10px] text-zinc-600">Target line at 100%</span></div>{history.length ? <><div className="relative flex h-40 items-end gap-2 border-b border-zinc-900"><div className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-zinc-700" style={{ bottom: `${selected.target / maxHistory * 100}%` }} />{history.map((snapshot) => <div key={snapshot.id} className="group relative flex h-full min-w-0 flex-1 items-end"><div className={`sam-rise w-full origin-bottom transition-all duration-700 ${snapshot.completed ? "bg-white" : "bg-red-500/70"}`} style={{ height: `${Math.max(snapshot.progress ? 3 : 1, snapshot.progress / maxHistory * 100)}%` }} /><div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-none border border-zinc-700 bg-black px-2 py-1 text-[10px] text-zinc-200 group-hover:block">{dateLabel(snapshot.periodStart, selected.period)} · {value(snapshot.progress)} / {value(snapshot.target)}</div></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-zinc-700"><span>{dateLabel(history[0].periodStart, selected.period)}</span><span>{dateLabel(history[history.length - 1].periodStart, selected.period)}</span></div></> : <div className="flex h-40 items-center justify-center text-sm text-zinc-600">History begins with the next progress update</div>}</section>
              </div> : <div className="flex h-full items-center justify-center text-sm text-zinc-600">Create or select a goal</div>}
            </main>
          </div>
        </section>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowModal(false);
          }}
        >
          <form
            onSubmit={submit}
            className="samaritan-card sam-dialog-aperture relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden border border-zinc-800 bg-zinc-950"
          >
            <div className="sam-scanline-beam" aria-hidden="true" />

            {/* Surveillance Directive Banner */}
            <div className="flex shrink-0 select-none items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2 font-mono text-[10px] tracking-wider">
              <div className="flex items-center gap-2">
                <span className="text-xs leading-none text-red-500 animate-pulse" aria-hidden="true">
                  ▼
                </span>
                <span className="uppercase text-zinc-500">{"/// SYS.DIRECTIVE //"}</span>
                <span className="font-bold uppercase text-white">GOALS.TARGET_SPEC</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
                <span className="font-mono">[{editingId ? "MUTATE" : "INITIALIZE"}]</span>
              </div>
            </div>

            <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-5">
              <h2 className="font-mono text-sm font-bold uppercase text-white">
                {editingId ? "Edit goal" : "New goal"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X size={17} className="text-zinc-500 hover:text-white" />
              </button>
            </div>
            <div className="dashboard-scroll-panel space-y-4 p-5">
              {error && (
                <div className="rounded-none border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-red-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Description</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="w-full resize-none rounded-none border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-500/50"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Metric</span>
                  <select
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100"
                  >
                    <option value="focus_minutes">Focus minutes</option>
                    <option value="productive_minutes">Productive minutes</option>
                    <option value="project_minutes">Project minutes</option>
                    <option value="hours">Tracked hours</option>
                    <option value="sessions">Focus sessions</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Target</span>
                  <input
                    required
                    min={0.1}
                    step="any"
                    type="number"
                    inputMode="decimal"
                    value={form.target}
                    onChange={(event) => setForm({ ...form, target: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Period</span>
                  <select
                    value={form.period}
                    onChange={(event) => setForm({ ...form, period: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Project</span>
                  <select
                    value={form.projectId}
                    onChange={(event) => setForm({ ...form, projectId: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100"
                  >
                    <option value="">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Unit label</span>
                  <input
                    value={form.unit}
                    onChange={(event) => setForm({ ...form, unit: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    placeholder="Automatic"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Custom start</span>
                  <ThemedDatePicker
                    value={form.startDate}
                    max={form.endDate || undefined}
                    onChange={(startDate) => setForm((current) => ({ ...current, startDate }))}
                    placeholder="Start date"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Custom end</span>
                  <ThemedDatePicker
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(endDate) => setForm((current) => ({ ...current, endDate }))}
                    placeholder="End date"
                  />
                </label>
              </div>
            </div>
            <div className="flex h-14 shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5">
              <button type="button" onClick={() => setShowModal(false)} className="sam-button">
                Cancel
              </button>
              <button disabled={busy} className="sam-button" data-variant="primary">
                {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
