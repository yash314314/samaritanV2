"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers3,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";

import { calendarApi, fetchHeatmap, fetchTimeline, projectsApi } from "@/lib/api";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { useAppContext } from "@/context/AppContext";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  description?: string | null;
  location?: string | null;
  status?: string;
  busy?: boolean;
  recurrenceRule?: string | null;
  reminderMinutes?: number | null;
  notes?: string | null;
  projectId?: string | null;
  project?: Project | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

type DaySummary = {
  trackedMs: number;
  idleMinutes: number;
  focus: number;
  productivity: number;
  dominantApp: string | null;
  dominantCategory: string | null;
  topApps: { name: string; duration: number; minutes?: number; percentage?: number }[];
  categories: { name: string; duration: number; minutes?: number; percentage?: number }[];
};

function dateKey(day: Date) {
  return format(day, "yyyy-MM-dd");
}

function inputDate(day: Date, hour: number) {
  const next = new Date(day);
  next.setHours(hour, 0, 0, 0);
  return format(next, "yyyy-MM-dd'T'HH:mm");
}

function normalizeScore(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function mergeBreakdowns(items: any[], totalMs: number) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item?.name) continue;
    totals.set(item.name, (totals.get(item.name) ?? 0) + Number(item.duration ?? 0));
  }
  return [...totals.entries()]
    .map(([name, duration]) => ({
      name,
      duration,
      minutes: Number((duration / 60000).toFixed(1)),
      percentage: totalMs > 0 ? Number(((duration / totalMs) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.duration - a.duration);
}

function summarizeDay(dayHeatmap: Record<string, any> | undefined): DaySummary {
  const buckets = Object.values(dayHeatmap ?? {});
  const trackedMs = buckets.reduce((sum, bucket: any) => sum + Number(bucket?.duration ?? 0), 0);
  const idleMinutes = buckets.reduce((sum, bucket: any) => sum + Number(bucket?.idleMinutes ?? 0), 0);
  const weightedFocus = buckets.reduce(
    (sum, bucket: any) => sum + normalizeScore(bucket?.focus ?? bucket?.score) * Number(bucket?.duration ?? 0),
    0
  );
  const weightedProductivity = buckets.reduce(
    (sum, bucket: any) => sum + normalizeScore(bucket?.productivity ?? bucket?.score) * Number(bucket?.duration ?? 0),
    0
  );
  const apps = mergeBreakdowns(buckets.flatMap((bucket: any) => bucket?.topApps ?? []), trackedMs);
  const categories = mergeBreakdowns(buckets.flatMap((bucket: any) => bucket?.categoryBreakdown ?? []), trackedMs);

  return {
    trackedMs,
    idleMinutes,
    focus: trackedMs > 0 ? weightedFocus / trackedMs : 0,
    productivity: trackedMs > 0 ? weightedProductivity / trackedMs : 0,
    dominantApp: apps[0]?.name ?? null,
    dominantCategory: categories[0]?.name ?? null,
    topApps: apps,
    categories,
  };
}

function focusColor(summary: DaySummary) {
  if (summary.trackedMs <= 0) return "#18181b";
  if (summary.focus >= 75) return "#a855f7";
  if (summary.focus >= 55) return "#7c3aed";
  if (summary.focus >= 35) return "#4c1d95";
  return "#27272a";
}

function getLatestTitle(entry: any) {
  return entry?.items?.at?.(-1)?.title ?? entry?.items?.[0]?.title ?? "Untitled activity";
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
      <div className="text-[10px] uppercase text-zinc-600">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function CalendarPage() {
  const { setSelectedDate } = useAppContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [monthHeatmap, setMonthHeatmap] = useState<Record<string, Record<string, any>>>({});
  const [selectedTimeline, setSelectedTimeline] = useState<any[]>([]);
  const [loadingReview, setLoadingReview] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    startAt: inputDate(new Date(), 9),
    endAt: inputDate(new Date(), 10),
    allDay: false,
    color: "#8b5cf6",
    description: "",
    location: "",
    status: "confirmed",
    busy: true,
    recurrenceRule: "",
    reminderMinutes: 10,
    notes: "",
    projectId: "",
  });

  const { calendarFrom, calendarTo, days } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const result: Date[] = [];
    const cursor = new Date(calendarStart);
    while (cursor <= calendarEnd) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return {
      calendarFrom: dateKey(calendarStart),
      calendarTo: dateKey(calendarEnd),
      days: result,
    };
  }, [currentMonth]);

  const selectedKey = dateKey(selectedDay);
  const selectedEvents = useMemo(
    () => events.filter((event) => dateKey(new Date(event.startAt)) === selectedKey),
    [events, selectedKey]
  );
  const selectedSummary = useMemo(
    () => summarizeDay(monthHeatmap[selectedKey]),
    [monthHeatmap, selectedKey]
  );

  const resetForm = useCallback((day = selectedDay) => {
    setEditingId(null);
    setForm({
      title: "",
      startAt: inputDate(day, 9),
      endAt: inputDate(day, 10),
      allDay: false,
      color: "#8b5cf6",
      description: "",
      location: "",
      status: "confirmed",
      busy: true,
      recurrenceRule: "",
      reminderMinutes: 10,
      notes: "",
      projectId: "",
    });
  }, [selectedDay]);

  const loadMonth = useCallback(async () => {
    setLoadingReview(true);
    try {
      const [eventData, heatmapData] = await Promise.all([
        calendarApi.list(USER_ID, calendarFrom, calendarTo),
        fetchHeatmap(USER_ID, calendarFrom, calendarTo, "focus"),
      ]);
      setEvents(Array.isArray(eventData) ? eventData : []);
      setMonthHeatmap(heatmapData ?? {});
    } finally {
      setLoadingReview(false);
    }
  }, [calendarFrom, calendarTo]);

  const loadSelectedDay = useCallback(async () => {
    const data = await fetchTimeline(USER_ID, undefined, undefined, selectedKey);
    setSelectedTimeline(Array.isArray(data) ? data : []);
  }, [selectedKey]);

  useEffect(() => {
    loadMonth().catch(console.error);
    projectsApi.list(USER_ID).then((data) => setProjects(data)).catch(console.error);
  }, [loadMonth]);

  useEffect(() => {
    loadSelectedDay().catch(console.error);
  }, [loadSelectedDay]);

  useRealtimeRefresh(
    () => Promise.all([loadMonth(), loadSelectedDay()]).then(() => undefined),
    {
      events: ["activity:new", "session:metrics", "analytics:daily", "calendar:changed", "deepwork:ended"],
      debounceMs: 800,
    }
  );

  function goMonth(direction: "prev" | "next") {
    const next = direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    setCurrentMonth(next);
    const nextSelected = startOfMonth(next);
    setSelectedDay(nextSelected);
    setSelectedDate(nextSelected);
  }

  function selectDay(day: Date) {
    setSelectedDay(day);
    setSelectedDate(day);
  }

  const eventsForDay = (day: Date) => {
    const dayStr = dateKey(day);
    return events.filter((event) => dateKey(new Date(event.startAt)) === dayStr);
  };

  function openCreate(day = selectedDay) {
    resetForm(day);
    setShowModal(true);
  }

  function openEdit(evt: CalendarEvent) {
    setEditingId(evt.id);
    setForm({
      title: evt.title,
      startAt: evt.startAt.slice(0, 16),
      endAt: evt.endAt.slice(0, 16),
      allDay: evt.allDay,
      color: evt.color || evt.project?.color || "#8b5cf6",
      description: evt.description || "",
      location: evt.location || "",
      status: evt.status || "confirmed",
      busy: evt.busy ?? true,
      recurrenceRule: evt.recurrenceRule || "",
      reminderMinutes: evt.reminderMinutes ?? 10,
      notes: evt.notes || "",
      projectId: evt.projectId || evt.project?.id || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        userId: USER_ID,
        title: form.title,
        startAt: form.startAt,
        endAt: form.endAt,
        allDay: form.allDay,
        color: form.color,
        description: form.description,
        location: form.location,
        status: form.status,
        busy: form.busy,
        recurrenceRule: form.recurrenceRule || undefined,
        reminderMinutes: form.reminderMinutes,
        notes: form.notes,
        projectId: form.projectId || undefined,
      };
      if (editingId) {
        await calendarApi.update(editingId, payload);
      } else {
        await calendarApi.create(payload);
      }
      setShowModal(false);
      resetForm();
      await loadMonth();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await calendarApi.delete(id);
      await loadMonth();
    } catch (error) {
      console.error(error);
    }
  }

  const monthSummaries = days
    .filter((day) => isSameMonth(day, currentMonth))
    .map((day) => summarizeDay(monthHeatmap[dateKey(day)]));
  const trackedDays = monthSummaries.filter((summary) => summary.trackedMs > 0);
  const totalTrackedMs = trackedDays.reduce((sum, summary) => sum + summary.trackedMs, 0);
  const monthFocus =
    totalTrackedMs > 0
      ? trackedDays.reduce((sum, summary) => sum + summary.focus * summary.trackedMs, 0) / totalTrackedMs
      : 0;

  return (
    <div className="dashboard-page text-zinc-100">
      <div className="dashboard-surface grid grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="samaritan-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-purple-300">
                <Sparkles className="h-4 w-4" />
                Calendar Review
              </div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {format(currentMonth, "MMMM yyyy")}
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                Scheduled events, tracked time, focus quality, and daily drilldown in one place.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goMonth("prev")}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition hover:text-zinc-100"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  selectDay(today);
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:text-zinc-100"
              >
                Today
              </button>
              <button
                onClick={() => goMonth("next")}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition hover:text-zinc-100"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openCreate()}
                className="ml-2 flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-600"
              >
                <Plus className="h-4 w-4" />
                New Event
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Month Focus" value={monthFocus.toFixed(0)} sub="activity weighted" />
            <StatTile label="Tracked" value={formatMs(totalTrackedMs)} sub={`${trackedDays.length} active days`} />
            <StatTile label="Events" value={events.length} sub="scheduled blocks" />
            <StatTile label="Selected" value={format(selectedDay, "MMM d")} sub={format(selectedDay, "EEEE")} />
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="samaritan-card min-h-0 p-4">
            <div className="mb-3 grid grid-cols-7 gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-zinc-500">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid h-[calc(100%-2rem)] grid-cols-7 grid-rows-6 gap-1.5">
              {days.map((day) => {
                const key = dateKey(day);
                const summary = summarizeDay(monthHeatmap[key]);
                const dayEvents = eventsForDay(day);
                const selected = isSameDay(day, selectedDay);
                const inMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`group min-h-0 rounded-lg border p-1.5 text-left transition ${
                      selected
                        ? "border-purple-400 bg-purple-500/10"
                        : inMonth
                        ? "border-zinc-800 bg-zinc-950/80 hover:border-purple-500/30"
                        : "border-zinc-900 bg-zinc-950/30 opacity-55"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-sm font-medium ${inMonth ? "text-zinc-200" : "text-zinc-600"}`}>
                        {format(day, "d")}
                      </span>
                      {summary.trackedMs > 0 && (
                        <span className="text-[10px] text-zinc-500">
                          {summary.focus.toFixed(0)}
                        </span>
                      )}
                    </div>

                    <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: summary.trackedMs > 0 ? `${Math.max(8, summary.focus)}%` : "0%",
                          backgroundColor: focusColor(summary),
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: event.color || event.project?.color || "#8b5cf6" }}
                        >
                          {event.allDay ? "All day" : format(new Date(event.startAt), "HH:mm")} {event.title}
                        </div>
                      ))}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600">
                      <span>{summary.trackedMs > 0 ? formatMs(summary.trackedMs) : "No tracking"}</span>
                      {dayEvents.length > 2 && <span>+{dayEvents.length - 2}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,0.8fr)_minmax(0,1fr)] gap-4">
            <div className="samaritan-card p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-purple-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">
                      {format(selectedDay, "EEEE, MMM d")}
                    </h2>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">Review schedule against actual tracked work.</p>
                </div>
                {loadingReview && <span className="text-[10px] text-purple-300">Syncing</span>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Tracked" value={formatMs(selectedSummary.trackedMs)} />
                <StatTile label="Focus" value={selectedSummary.focus.toFixed(0)} />
                <StatTile label="Idle" value={`${selectedSummary.idleMinutes.toFixed(0)}m`} />
                <StatTile label="Productivity" value={selectedSummary.productivity.toFixed(0)} />
              </div>

              <div className="mt-4 rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <Layers3 className="h-3.5 w-3.5 text-purple-400" />
                  Dominant Work
                </div>
                <div className="text-sm text-zinc-100">
                  {selectedSummary.dominantCategory ?? "No tracked category"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {selectedSummary.dominantApp ?? "No dominant app yet"}
                </div>
              </div>
            </div>

            <div className="samaritan-card flex min-h-0 flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Scheduled</h2>
                <button
                  type="button"
                  onClick={() => openCreate(selectedDay)}
                  className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-300 transition hover:bg-purple-500/20"
                >
                  Add
                </button>
              </div>

              <div className="dashboard-scroll-panel space-y-2 pr-1">
                {selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-200">{event.title}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {event.allDay
                            ? "All day"
                            : `${format(new Date(event.startAt), "HH:mm")} - ${format(new Date(event.endAt), "HH:mm")}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => openEdit(event)} title="Edit event" className="text-zinc-500 hover:text-zinc-200">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(event.id)} title="Delete event" className="text-zinc-500 hover:text-rose-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {event.location && <div className="mt-2 text-[11px] text-zinc-600">{event.location}</div>}
                  </div>
                ))}
                {selectedEvents.length === 0 && (
                  <div className="rounded-lg bg-zinc-950/60 p-5 text-center text-sm text-zinc-500">
                    No scheduled events.
                  </div>
                )}
              </div>
            </div>

            <div className="samaritan-card flex min-h-0 flex-col p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Actual Timeline</h2>
              </div>

              <div className="dashboard-scroll-panel space-y-2 pr-1">
                {selectedTimeline.slice().reverse().slice(0, 10).map((entry) => (
                  <div key={`${entry.start}-${entry.appName}`} className="rounded-lg bg-zinc-950/70 p-3 ring-1 ring-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-200">{entry.appName}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{getLatestTitle(entry)}</div>
                      </div>
                      <div className="shrink-0 text-xs text-zinc-500">{formatMs(Number(entry.duration ?? 0))}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600">
                      <span>{entry.category ?? "unknown"}</span>
                      <span>{entry.intent ?? "unknown"}</span>
                    </div>
                  </div>
                ))}
                {selectedTimeline.length === 0 && (
                  <div className="rounded-lg bg-zinc-950/60 p-5 text-center text-sm text-zinc-500">
                    No tracked activity for this day.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="samaritan-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
              <h2 className="mb-4 text-lg font-bold">{editingId ? "Edit Event" : "New Event"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Start</label>
                    <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">End</label>
                    <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" required />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
                  All day
                </label>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Project</label>
                  <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Color</label>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <option value="confirmed">Confirmed</option>
                      <option value="tentative">Tentative</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <label className="mt-6 flex items-center gap-2 text-sm text-zinc-300">
                    <Briefcase className="h-4 w-4 text-zinc-500" />
                    <input type="checkbox" checked={form.busy} onChange={(e) => setForm({ ...form, busy: e.target.checked })} />
                    Busy
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Reminder</label>
                    <div className="relative">
                      <Bell className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input type="number" value={form.reminderMinutes} onChange={(e) => setForm({ ...form, reminderMinutes: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Recurrence</label>
                    <input placeholder="RRULE:FREQ=WEEKLY" value={form.recurrenceRule} onChange={(e) => setForm({ ...form, recurrenceRule: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" rows={2} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2" rows={3} />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-zinc-800 px-4 py-2 transition hover:bg-zinc-800">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-purple-500 px-4 py-2 text-white transition hover:bg-purple-600">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  {editingId ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
