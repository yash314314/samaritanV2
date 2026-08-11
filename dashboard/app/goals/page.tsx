"use client";

import { useCallback, useState, useEffect } from "react";
import { Archive, CheckCircle2, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { goalsApi, projectsApi } from "@/lib/api";
import { useWsMessage } from "@/lib/ws";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

interface Goal {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  unit?: string | null;
  target: number;
  progress?: number;
  progressRatio?: number;
  period: string;
  priority?: string;
  startDate?: string | null;
  endDate?: string | null;
  project?: { id: string; name: string; color: string } | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "focus_minutes",
    unit: "",
    target: 60,
    period: "daily",
    priority: "medium",
    startDate: "",
    endDate: "",
    projectId: "",
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      type: "focus_minutes",
      unit: "",
      target: 60,
      period: "daily",
      priority: "medium",
      startDate: "",
      endDate: "",
      projectId: "",
    });
  };

  const loadGoals = useCallback(async () => {
    const data = await goalsApi.list(USER_ID);
    setGoals(data);
  }, []);

  useEffect(() => {
    loadGoals().catch(console.error);
    projectsApi.list(USER_ID).then((data) => setProjects(data)).catch(console.error);
  }, [loadGoals]);

  useWsMessage<{ goals: Goal[] }>("goal:progress", (payload) => {
    setGoals(payload.goals);
  });

  useWsMessage("goal:changed", () => {
    loadGoals().catch(console.error);
  });

  function openEdit(goal: Goal) {
    setEditingId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description || "",
      type: goal.type,
      unit: goal.unit || "",
      target: goal.target,
      period: goal.period,
      priority: goal.priority || "medium",
      startDate: goal.startDate ? goal.startDate.slice(0, 10) : "",
      endDate: goal.endDate ? goal.endDate.slice(0, 10) : "",
      projectId: goal.project?.id || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        userId: USER_ID,
        title: form.title,
        description: form.description,
        type: form.type,
        unit: form.unit || undefined,
        target: form.target,
        period: form.period,
        priority: form.priority,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        projectId: form.projectId || undefined,
      };
      if (editingId) {
        await goalsApi.update(editingId, payload);
      } else {
        await goalsApi.create(payload);
      }
      setShowModal(false);
      resetForm();
      await loadGoals();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    try {
      await goalsApi.delete(id);
      await loadGoals();
    } catch (e) { console.error(e); }
  }

  async function archiveGoal(id: string) {
    await goalsApi.update(id, { active: false });
    await loadGoals();
  }

  function goalUnit(goal: Goal) {
    if (goal.unit) return goal.unit;
    if (goal.type === "focus_minutes") return "minutes";
    if (goal.type === "hours") return "hours";
    if (goal.type === "sessions") return "sessions";
    return "units";
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Goals</h1>
            <p className="text-sm text-zinc-500">Track your progress</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            <Plus className="w-4 h-4" /> New Goal
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = goal.progress ?? 0;
            const ratio = Math.min(100, Math.round((goal.progressRatio ?? (goal.target > 0 ? progress / goal.target : 0)) * 100));
            return (
            <div key={goal.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Target className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{goal.title}</h3>
                    <p className="text-xs text-zinc-500">{goal.period} · {goal.priority || "medium"} priority</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(goal)} className="p-1 hover:text-zinc-100 text-zinc-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => archiveGoal(goal.id)} className="p-1 hover:text-amber-400 text-zinc-500" title="Archive"><Archive className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(goal.id)} className="p-1 hover:text-rose-400 text-zinc-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {goal.description && <p className="mb-4 text-sm text-zinc-400">{goal.description}</p>}
              <div className="flex items-end gap-2">
                <div className="text-3xl font-bold">{Math.round(progress)}</div>
                <div className="text-sm text-zinc-500 mb-1">/ {goal.target} {goalUnit(goal)}</div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full ${ratio >= 100 ? "bg-emerald-400" : "bg-purple-500"}`} style={{ width: `${ratio}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-zinc-500">
                <span>{ratio}% complete</span>
                <span>{goal.startDate?.slice(0, 10) || "auto"} to {goal.endDate?.slice(0, 10) || goal.period}</span>
              </div>
              {goal.project && (
                <div className="mt-3 text-xs text-zinc-400">Project: {goal.project.name}</div>
              )}
            </div>
          );})}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">{editingId ? "Edit Goal" : "New Goal"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" rows={2} />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    <option value="focus_minutes">Focus Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="sessions">Sessions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Target</label>
                  <input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Unit label</label>
                  <input placeholder="minutes, hours, sessions" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Period</label>
                  <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Start</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">End</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" />
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
