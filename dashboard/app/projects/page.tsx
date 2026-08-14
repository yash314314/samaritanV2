"use client";

import { useCallback, useState, useEffect } from "react";
import { CalendarDays, Clock3, Pencil, Plus, Trash2, Video } from "lucide-react";
import { projectsApi, projectRulesApi } from "@/lib/api";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

interface Project {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  weeklyHourGoal: number;
  goals?: { id: string }[];
  rules?: { id: string }[];
  _count?: { time: number; events: number; calendarSessions: number };
  timeSummary?: {
    weekMinutes: number;
    activityMinutes: number;
    calendarMinutes: number;
    goalMinutes: number;
    progressPercent: number;
    from: string;
    to: string;
    timezone: string;
  };
}

interface ProjectRule {
  id: string;
  appName: string | null;
  domain: string | null;
  titleKeyword: string | null;
  matchType: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "", color: "#8b5cf6", weeklyHourGoal: 10 });
  const [ruleForm, setRuleForm] = useState({ appName: "", domain: "", titleKeyword: "", matchType: "exact" });

  const loadProjects = useCallback(async () => {
    const data = await projectsApi.list(USER_ID);
    setProjects(data as Project[]);
  }, []);

  useEffect(() => {
    projectsApi.list(USER_ID).then((data) => setProjects(data as Project[])).catch(console.error);
  }, []);

  useRealtimeRefresh(loadProjects, {
    events: ["activity:new", "calendar:session.started", "calendar:session.updated", "calendar:session.ended", "calendar:changed", "project:changed"],
    debounceMs: 700,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingProject) {
        await projectsApi.update(editingProject.id, form);
      } else {
        await projectsApi.create({ ...form, userId: USER_ID });
      }
      setShowModal(false);
      loadProjects();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.name}"?`)) return;
    try {
      await projectsApi.delete(project.id);
      loadProjects();
    } catch (e) { console.error(e); }
  }

  async function loadRules(project: Project) {
    setSelectedProject(project);
    try {
      const data = await projectRulesApi.list(project.id);
      setRules(data as ProjectRule[]);
      setShowRulesModal(true);
    } catch (e) { console.error(e); }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await projectRulesApi.create(selectedProject.id, ruleForm);
      setRuleForm({ appName: "", domain: "", titleKeyword: "", matchType: "exact" });
      loadRules(selectedProject);
    } catch (e) { console.error(e); }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!selectedProject) return;
    try {
      await projectRulesApi.delete(selectedProject.id, ruleId);
      loadRules(selectedProject);
    } catch (e) { console.error(e); }
  }

  return (
    <div className="dashboard-page text-zinc-100">
      <div className="dashboard-surface grid grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="samaritan-card flex items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-bold">Projects</h1>
            <p className="text-sm text-zinc-500">Track time across your projects</p>
          </div>
          <button
            onClick={() => { setEditingProject(null); setForm({ name: "", icon: "", color: "#8b5cf6", weeklyHourGoal: 10 }); setShowModal(true); }}
            className="flex items-center gap-2 rounded-lg bg-purple-500 px-3 py-2 text-sm text-white hover:bg-purple-600"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        <div className="dashboard-scroll-panel grid auto-rows-min grid-cols-1 gap-3 pr-1 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="samaritan-card p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: project.color + "20", color: project.color }}>
                    {project.icon || "📁"}
                  </div>
                  <div>
                    <h3 className="line-clamp-1 font-semibold">{project.name}</h3>
                    <p className="text-xs text-zinc-500">{project.goals?.length || 0} goals</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingProject(project); setForm({ name: project.name, icon: project.icon || "", color: project.color, weeklyHourGoal: project.weeklyHourGoal }); setShowModal(true); }} className="p-1 hover:text-purple-400">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(project)} className="p-1 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mb-3 border-y border-zinc-900 py-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-600">This week</div>
                    <div className="mt-1 text-xl font-semibold text-zinc-100">{((project.timeSummary?.weekMinutes ?? 0) / 60).toFixed(1)}h</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium" style={{ color: project.color }}>{project.timeSummary?.progressPercent ?? 0}%</div>
                    <div className="text-[10px] text-zinc-600">of {project.weeklyHourGoal}h goal</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-zinc-900">
                  <div
                    className="h-full origin-left transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, project.timeSummary?.progressPercent ?? 0))}%`, backgroundColor: project.color }}
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-3 divide-x divide-zinc-900 text-center">
                <div className="min-w-0 px-1">
                  <Clock3 className="mx-auto h-3.5 w-3.5 text-purple-400" />
                  <div className="mt-1 truncate text-xs font-medium text-zinc-300">{((project.timeSummary?.activityMinutes ?? 0) / 60).toFixed(1)}h</div>
                  <div className="text-[9px] uppercase text-zinc-700">Activity</div>
                </div>
                <div className="min-w-0 px-1">
                  <Video className="mx-auto h-3.5 w-3.5 text-cyan-400" />
                  <div className="mt-1 truncate text-xs font-medium text-zinc-300">{((project.timeSummary?.calendarMinutes ?? 0) / 60).toFixed(1)}h</div>
                  <div className="text-[9px] uppercase text-zinc-700">Sessions</div>
                </div>
                <div className="min-w-0 px-1">
                  <CalendarDays className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                  <div className="mt-1 truncate text-xs font-medium text-zinc-300">{project._count?.events || 0}</div>
                  <div className="text-[9px] uppercase text-zinc-700">Events</div>
                </div>
              </div>
              <button onClick={() => loadRules(project)} className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm transition-colors hover:bg-zinc-900">
                Manage Rules ({project.rules?.length || 0})
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-center text-zinc-500 py-16">
              No projects yet. Create one to start tracking time.
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <form onSubmit={handleSave} className="samaritan-card p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">{editingProject ? "Edit Project" : "New Project"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Icon (emoji)</label>
                  <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Color</label>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Weekly Hour Goal</label>
                  <input type="number" value={form.weeklyHourGoal} onChange={(e) => setForm({ ...form, weeklyHourGoal: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-zinc-800 rounded-lg hover:bg-zinc-800">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">Save</button>
              </div>
            </form>
          </div>
        )}

        {showRulesModal && selectedProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="samaritan-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Rules for {selectedProject.name}</h2>
                <button onClick={() => setShowRulesModal(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>
              <form onSubmit={handleAddRule} className="mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="App name (e.g., Figma)" value={ruleForm.appName} onChange={(e) => setRuleForm({ ...ruleForm, appName: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Domain (e.g., figma.com)" value={ruleForm.domain} onChange={(e) => setRuleForm({ ...ruleForm, domain: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Title keyword" value={ruleForm.titleKeyword} onChange={(e) => setRuleForm({ ...ruleForm, titleKeyword: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                  <select value={ruleForm.matchType} onChange={(e) => setRuleForm({ ...ruleForm, matchType: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm">
                    <option value="exact">Exact match</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>
                <button type="submit" className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm">Add Rule</button>
              </form>
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <div className="flex-1">
                      {rule.appName && <div className="text-sm"><span className="text-zinc-500">App:</span> {rule.appName}</div>}
                      {rule.domain && <div className="text-sm"><span className="text-zinc-500">Domain:</span> {rule.domain}</div>}
                      {rule.titleKeyword && <div className="text-sm"><span className="text-zinc-500">Keyword:</span> {rule.titleKeyword}</div>}
                      <div className="text-xs text-zinc-600 mt-1">Match: {rule.matchType}</div>
                    </div>
                    <button onClick={() => handleDeleteRule(rule.id)} className="p-1 hover:text-rose-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {rules.length === 0 && (
                  <div className="text-center text-zinc-500 py-8">No rules yet. Add one above to auto-tag activities.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
