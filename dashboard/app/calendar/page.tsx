"use client";

import { useCallback, useState, useEffect } from "react";
import { Bell, Briefcase, CheckCircle2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
import { calendarApi, projectsApi } from "@/lib/api";
import { useWsMessage } from "@/lib/ws";

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

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    startAt: "",
    endAt: "",
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: "",
      startAt: "",
      endAt: "",
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
  };

  const loadEvents = useCallback(async () => {
    const from = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const to = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const data = await calendarApi.list(USER_ID, from, to);
    setEvents(data);
  }, [currentMonth]);

  useEffect(() => {
    loadEvents().catch(console.error);
    projectsApi.list(USER_ID).then((data) => setProjects(data)).catch(console.error);
  }, [loadEvents]);

  useWsMessage("calendar:changed", () => {
    loadEvents().catch(console.error);
  });

  const eventsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((e) => format(new Date(e.startAt), "yyyy-MM-dd") === dayStr);
  };

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
      await loadEvents();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await calendarApi.delete(id);
      await loadEvents();
    } catch (e) { console.error(e); }
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-zinc-800 rounded-lg">←</button>
            <h1 className="text-2xl font-bold">{format(currentMonth, "MMMM yyyy")}</h1>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-zinc-800 rounded-lg">→</button>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>

        <div className="samaritan-card p-6">
          <div className="grid grid-cols-7 gap-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-sm text-zinc-500 font-medium">{d}</div>
            ))}
            {days.map((day) => {
              const dayEvents = eventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[120px] p-2 rounded-lg border ${isSameMonth(day, currentMonth) ? "border-zinc-800 bg-zinc-950" : "border-zinc-900 bg-zinc-900/50"}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isSameMonth(day, currentMonth) ? "text-zinc-300" : "text-zinc-600"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <div key={evt.id} className="group/evt relative text-xs px-2 py-1 rounded" style={{ backgroundColor: evt.color || evt.project?.color || "#a855f7", color: "white" }}>
                        <button onClick={() => openEdit(evt)} className="w-full text-left truncate pr-10">
                          {evt.allDay ? "All day" : format(new Date(evt.startAt), "HH:mm")} {evt.title}
                        </button>
                        <span className="hidden group-hover/evt:flex absolute right-1 top-1/2 -translate-y-1/2 gap-1">
                        <button
                          onClick={() => openEdit(evt)}
                          className="text-white/80 hover:text-white"
                          title="Edit event"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(evt.id)}
                          className="text-white/80 hover:text-white"
                          title="Delete event"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-xs text-zinc-500">+{dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <form onSubmit={handleSubmit} className="samaritan-card p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">{editingId ? "Edit Event" : "New Event"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Start</label>
                  <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">End</label>
                  <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">All day</label>
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="w-5 h-5 bg-zinc-950 border border-zinc-800 rounded" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Project</label>
                  <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Color</label>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                      <option value="confirmed">Confirmed</option>
                      <option value="tentative">Tentative</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 mt-6 text-sm text-zinc-300">
                    <Briefcase className="w-4 h-4 text-zinc-500" />
                    <input type="checkbox" checked={form.busy} onChange={(e) => setForm({ ...form, busy: e.target.checked })} />
                    Busy
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Reminder</label>
                    <div className="relative">
                      <Bell className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                      <input type="number" value={form.reminderMinutes} onChange={(e) => setForm({ ...form, reminderMinutes: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Recurrence</label>
                    <input placeholder="RRULE:FREQ=WEEKLY" value={form.recurrenceRule} onChange={(e) => setForm({ ...form, recurrenceRule: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" rows={2} />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" rows={3} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-zinc-800 rounded-lg hover:bg-zinc-800">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"><CheckCircle2 className="inline w-4 h-4 mr-1" />{editingId ? "Save" : "Create"}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
