"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/sam/PageHeader";
import { Decode } from "@/components/sam/Decode";
import SamLoading from "@/components/sam/SamLoading";
import {
  Archive,
  BarChart3,
  Check,
  CheckSquare,
  Clock3,
  FolderKanban,
  Gauge,
  Layers3,
  ListFilter,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Target,
  Trash2,
  X,
} from "lucide-react";

import { projectRulesApi, projectsApi } from "@/lib/api";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { playSamaritanDialogSequence, playSamaritanDismiss } from "@/lib/samaritanAudio";
import { getUserId } from "@/lib/auth";


type Project = {
  id: string;
  name: string;
  description?: string | null;
  icon: string | null;
  color: string;
  weeklyHourGoal: number;
  active: boolean;
  rules?: ProjectRule[];
  timeSummary?: { weekMinutes: number; progressPercent: number };
};

type ProjectRule = { id: string; appName: string | null; domain: string | null; titleKeyword: string | null; matchType: string };
type Activity = { id: string; appName: string; windowTitle: string; domain?: string | null; category?: string | null; intent?: string | null; startTime: string; durationMinutes: number; iconUrl?: string | null };
type Dashboard = {
  project: Project & { rules: ProjectRule[] };
  summary: { todayMinutes: number; weekMinutes: number; rangeMinutes: number; activityMinutes: number; calendarMinutes: number; weeklyGoalMinutes: number; weeklyProgress: number; changePercent: number; focusQuality: number; focusSessions: number; completedFocusSessions: number };
  range: { from: string; to: string; days: number; timezone: string };
  daily: Array<{ date: string; minutes: number; activityMinutes: number; calendarMinutes: number }>;
  topApps: Array<{ name: string; minutes: number }>;
  categories: Array<{ name: string; minutes: number }>;
  recentActivities: Activity[];
  goals: Array<{ id: string; title: string; progress: number; target: number; progressRatio: number; status: string }>;
};

const emptyProject = { name: "", description: "", icon: "", color: "#fb0915", weeklyHourGoal: 10 };
const emptyRule = { appName: "", domain: "", titleKeyword: "", matchType: "exact" };

function hours(minutes = 0) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function activityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [unassigned, setUnassigned] = useState<Activity[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [tab, setTab] = useState<"overview" | "activity" | "rules" | "unassigned">("overview");
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
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
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyProject);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [remember, setRemember] = useState(true);
  const [testForm, setTestForm] = useState({ appName: "", domain: "", windowTitle: "" });
  const [testResult, setTestResult] = useState<{ matchesProject: boolean; projectName: string | null; confidence: number } | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedId) || null;

  const loadProjects = useCallback(async () => {
    const data = await projectsApi.list(getUserId(), showArchived) as Project[];
    setProjects(data);
    setSelectedId((current) => current && data.some((project) => project.id === current) ? current : data[0]?.id || null);
  }, [showArchived]);

  const loadDashboard = useCallback(async (id: string) => {
    setDashboard(await projectsApi.dashboard(id, getUserId(), days) as Dashboard);
  }, [days]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await loadProjects();
      if (selectedId) await loadDashboard(selectedId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load projects");
    } finally {
      setLoading(false);
    }
  }, [loadProjects, loadDashboard, selectedId]);

  useEffect(() => { void loadProjects().finally(() => setLoading(false)); }, [loadProjects]);
  useEffect(() => { if (selectedId) void loadDashboard(selectedId).catch(console.error); }, [selectedId, loadDashboard]);
  useEffect(() => { setTargetProjectId(selectedId || ""); }, [selectedId]);
  useEffect(() => {
    if (tab !== "unassigned") return;
    projectsApi.unassigned(getUserId()).then((data) => setUnassigned(data as Activity[])).catch(console.error);
  }, [tab]);

  useRealtimeRefresh(refresh, {
    events: ["activity:new", "calendar:session.started", "calendar:session.updated", "calendar:session.ended", "project:changed", "goal:changed", "deepwork:ended"],
    debounceMs: 650,
  });

  const maxDaily = Math.max(1, ...(dashboard?.daily.map((item) => item.minutes) || [1]));
  const categoryMax = Math.max(1, ...(dashboard?.categories.map((item) => item.minutes) || [1]));
  const appMax = Math.max(1, ...(dashboard?.topApps.map((item) => item.minutes) || [1]));

  async function action(key: string, operation: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await operation();
      await loadProjects();
      if (selectedId) await loadDashboard(selectedId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project action failed");
    } finally {
      setBusy(null);
    }
  }

  function openProject(project?: Project) {
    setEditing(project || null);
    setForm(project ? { name: project.name, description: project.description || "", icon: project.icon || "", color: project.color, weeklyHourGoal: project.weeklyHourGoal } : emptyProject);
    setShowModal(true);
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    await action("project", () => editing
      ? projectsApi.update(editing.id, { ...form, userId: getUserId() })
      : projectsApi.create({ ...form, userId: getUserId() }));
    setShowModal(false);
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    await action("rule", () => editingRuleId
      ? projectRulesApi.update(selectedId, editingRuleId, ruleForm)
      : projectRulesApi.create(selectedId, ruleForm));
    setRuleForm(emptyRule);
    setEditingRuleId(null);
  }

  async function assignSelected(projectId: string | null, rememberChoice = false) {
    if (!selectedActivities.length) return;
    await action("assign", () => projectsApi.assignActivities({ userId: getUserId(), activityIds: selectedActivities, projectId, remember: rememberChoice }));
    setUnassigned((items) => items.filter((item) => !selectedActivities.includes(item.id)));
    setSelectedActivities([]);
  }

  const toggleActivity = (id: string) => setSelectedActivities((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="dashboard-page text-zinc-100">
      <div className="dashboard-surface flex h-full flex-col gap-3">
        <PageHeader
          title="Projects"
          description="Time attributed to each project automatically, with progress against weekly goals."
          actions={
            <>
              <button type="button" title="Refresh" aria-label="Refresh projects" onClick={() => void refresh()} className="sam-button h-8 w-8 px-0">
                <RefreshCw size={14} strokeWidth={1.5} className={loading ? "animate-spin" : ""} />
              </button>
              <button type="button" onClick={() => openProject()} className="sam-button" data-variant="primary">
                <Plus size={14} strokeWidth={1.5} /> New project
              </button>
            </>
          }
        />

        {error && <div className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"><span className="min-w-0 flex-1 truncate">{error}</span><button onClick={() => setError(null)}><X size={14} /></button></div>}

        <section className="samaritan-card grid min-h-0 flex-1 md:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-zinc-900 md:border-b-0 md:border-r">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-900 px-4"><span className="text-xs font-medium uppercase text-zinc-500">{showArchived ? "All projects" : "Active projects"}</span><button type="button" aria-pressed={showArchived} aria-label={showArchived ? "Hide archived projects" : "Show archived projects"} title={showArchived ? "Hide archived" : "Show archived"} onClick={() => setShowArchived((value) => !value)} className={`flex items-center gap-1.5 text-[10px] ${showArchived ? "text-red-400" : "text-zinc-600 hover:text-zinc-300"}`}><Archive size={12} />{projects.length}</button></div>
            <div className="dashboard-scroll-panel">
              {loading ? <SamLoading compact label="Loading projects" /> : projects.length === 0 ? <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-600"><FolderKanban size={26} /><span className="text-sm">No projects</span></div> : projects.map((project) => (
                <button key={project.id} type="button" aria-current={selectedId === project.id ? "true" : undefined} onClick={() => { setSelectedId(project.id); setTab("overview"); setSelectedActivities([]); }} className={`flex w-full items-center gap-3 border-b border-zinc-900 px-4 py-3 text-left transition ${!project.active ? "opacity-55" : ""} ${selectedId === project.id ? "bg-red-500/10" : "hover:bg-zinc-950"}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold" style={{ backgroundColor: `${project.color}20`, color: project.color }}>{project.icon || project.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 overflow-hidden"><span className="block truncate text-sm text-zinc-200">{project.name}</span><span className="mt-0.5 block truncate text-[11px] text-zinc-600">{project.active ? `${hours(project.timeSummary?.weekMinutes)} this week` : "Archived"}</span></span>
                  <span className="shrink-0 text-[10px] font-medium" style={{ color: project.color }}>{project.timeSummary?.progressPercent || 0}%</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            {selectedProject && dashboard ? <>
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-900 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-semibold" style={{ backgroundColor: `${selectedProject.color}20`, color: selectedProject.color }}>{selectedProject.icon || selectedProject.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{selectedProject.name}</h2><p className="truncate text-xs text-zinc-600">{selectedProject.description || `${dashboard.project.rules.length} attribution rules`}</p></div>
                <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-400"><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select>
                {selectedProject.active ? <><button title="Edit project" onClick={() => openProject(selectedProject)} className="sam-button h-8 w-8 px-0"><Pencil size={14} /></button><button title="Archive project" onClick={() => { if (confirm(`Archive ${selectedProject.name}?`)) void action("archive", () => projectsApi.delete(selectedProject.id)); }} className="sam-button h-8 w-8 px-0"><Archive size={14} /></button></> : <button title="Restore project" onClick={() => void action("restore", () => projectsApi.restore(selectedProject.id, getUserId()))} className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 text-xs text-red-400 hover:bg-red-500/10"><RotateCcw size={13} /> Restore</button>}
              </div>

              <div className="grid shrink-0 grid-cols-4 border-b border-zinc-900">
                {[
                  ["Today", hours(dashboard.summary.todayMinutes), Clock3],
                  ["This week", hours(dashboard.summary.weekMinutes), BarChart3],
                  ["Weekly goal", `${dashboard.summary.weeklyProgress}%`, Target],
                  ["Focus quality", `${dashboard.summary.focusQuality}`, Gauge],
                ].map(([label, value, Icon]) => <div key={String(label)} className="flex min-w-0 items-center gap-2 border-r border-zinc-900 px-3 py-2.5 last:border-r-0"><Icon size={14} className="shrink-0 text-red-500" /><div className="min-w-0"><div className="truncate text-sm font-semibold"><Decode value={String(value)} /></div><div className="truncate text-[10px] text-zinc-600">{String(label)}</div></div></div>)}
              </div>

              <nav aria-label="Project details" role="tablist" className="flex h-10 shrink-0 items-end gap-1 border-b border-zinc-900 px-3">
                {([['overview', 'Overview', BarChart3], ['activity', 'Activity', Layers3], ['rules', 'Rules', ListFilter], ['unassigned', 'Unassigned', Sparkles]] as const).map(([value, label, Icon]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setSelectedActivities([]); }} className={`flex h-10 items-center gap-1.5 border-b-2 px-3 text-xs transition ${tab === value ? "border-red-500 text-red-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}><Icon size={13} />{label}</button>)}
              </nav>

              <div className="dashboard-scroll-panel">
                {tab === "overview" && <div className="grid min-h-full grid-cols-1 content-start lg:grid-cols-2">
                  <section className="border-b border-zinc-900 p-4 lg:col-span-2">
                    <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-medium uppercase text-zinc-500">Tracked time</h3><span className={`text-xs ${dashboard.summary.changePercent >= 0 ? "text-white" : "text-red-400"}`}>{dashboard.summary.changePercent >= 0 ? "+" : ""}{dashboard.summary.changePercent}% vs previous</span></div>
                    <div className="flex h-32 items-end gap-1.5">{dashboard.daily.map((item) => <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end"><div className="sam-rise w-full origin-bottom bg-red-500/80 transition-all duration-700 group-hover:bg-red-400" style={{ height: `${Math.max(item.minutes ? 4 : 1, item.minutes / maxDaily * 100)}%` }} /><div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-black px-2 py-1 text-[10px] text-zinc-200 group-hover:block">{item.date} · {hours(item.minutes)}</div></div>)}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-700"><span>{dashboard.range.from}</span><span>{hours(dashboard.summary.activityMinutes)} activity · {hours(dashboard.summary.calendarMinutes)} calendar</span><span>{dashboard.range.to}</span></div>
                  </section>
                  <section className="border-b border-zinc-900 p-4 lg:border-r"><h3 className="mb-3 text-xs font-medium uppercase text-zinc-500">Top apps</h3><div className="space-y-2.5">{dashboard.topApps.slice(0, 6).map((item) => <div key={item.name}><div className="mb-1 flex justify-between text-xs"><span className="truncate text-zinc-300">{item.name}</span><span className="text-zinc-600">{hours(item.minutes)}</span></div><div className="h-1 bg-zinc-900"><div className="sam-fill h-full bg-signal text-void" style={{ width: `${item.minutes / appMax * 100}%` }} /></div></div>)}</div></section>
                  <section className="border-b border-zinc-900 p-4"><h3 className="mb-3 text-xs font-medium uppercase text-zinc-500">Categories</h3><div className="space-y-2.5">{dashboard.categories.slice(0, 6).map((item) => <div key={item.name}><div className="mb-1 flex justify-between text-xs"><span className="truncate capitalize text-zinc-300">{item.name.replaceAll('_', ' ')}</span><span className="text-zinc-600">{hours(item.minutes)}</span></div><div className="h-1 bg-zinc-900"><div className="sam-fill h-full bg-zinc-200" style={{ width: `${item.minutes / categoryMax * 100}%` }} /></div></div>)}</div></section>
                  <section className="p-4 lg:col-span-2"><div className="mb-3 flex justify-between"><h3 className="text-xs font-medium uppercase text-zinc-500">Linked goals</h3><span className="text-[11px] text-zinc-600">{dashboard.goals.length}</span></div>{dashboard.goals.length ? <div className="grid gap-3 md:grid-cols-2">{dashboard.goals.map((goal) => <div key={goal.id} className="border-l-2 border-red-500 bg-zinc-950/60 px-3 py-2"><div className="flex justify-between text-xs"><span className="truncate text-zinc-300">{goal.title}</span><span className="text-red-400">{Math.round(goal.progressRatio * 100)}%</span></div><div className="mt-2 h-1 bg-zinc-900"><div className="sam-fill h-full bg-signal text-void" style={{ width: `${Math.min(100, goal.progressRatio * 100)}%` }} /></div></div>)}</div> : <div className="text-sm text-zinc-600">No goals linked to this project</div>}</section>
                </div>}

                {tab === "activity" && <ActivityList activities={dashboard.recentActivities} selected={selectedActivities} onToggle={toggleActivity} />}

                {tab === "rules" && editingRuleId === "__legacy__" && selectedProject && dashboard && testResult && <div className="hidden">
                  <section className="border-b border-zinc-900 p-4 lg:border-b-0 lg:border-r"><h3 className="mb-3 text-xs font-medium uppercase text-zinc-500">New rule</h3><form onSubmit={addRule} className="space-y-2"><input placeholder="App name" value={ruleForm.appName} onChange={(event) => setRuleForm({ ...ruleForm, appName: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-red-500/50" /><input placeholder="Domain" value={ruleForm.domain} onChange={(event) => setRuleForm({ ...ruleForm, domain: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-red-500/50" /><input placeholder="Window title keyword" value={ruleForm.titleKeyword} onChange={(event) => setRuleForm({ ...ruleForm, titleKeyword: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-red-500/50" /><div className="flex gap-2"><select value={ruleForm.matchType} onChange={(event) => setRuleForm({ ...ruleForm, matchType: event.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs"><option value="exact">Exact</option><option value="contains">Contains</option></select><button disabled={busy === "rule"} className="sam-button" data-variant="primary"><Plus size={13} /> Add</button></div></form><div className="my-4 border-t border-zinc-900" /><h3 className="mb-2 text-xs font-medium uppercase text-zinc-500">Test attribution</h3><div className="space-y-2"><input placeholder="App name" value={testForm.appName} onChange={(event) => setTestForm({ ...testForm, appName: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs" /><input placeholder="Domain or window title" value={testForm.domain} onChange={(event) => setTestForm({ ...testForm, domain: event.target.value, windowTitle: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs" /><button onClick={() => projectRulesApi.test(selectedId!, testForm).then((data) => setTestResult(data as typeof testResult))} className="sam-button w-full"><Search size={13} /> Test rules</button>{testResult && <div className={`rounded-lg border px-3 py-2 text-xs ${testResult.matchesProject ? "border-zinc-700 bg-zinc-900 text-white" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{testResult.matchesProject ? `Matched ${selectedProject.name}` : testResult.projectName ? `Matched ${testResult.projectName}` : "No project matched"}</div>}</div></section>
                  <section><div className="flex h-10 items-center justify-between border-b border-zinc-900 px-4"><span className="text-xs uppercase text-zinc-500">Rules</span><span className="text-xs text-zinc-600">{dashboard.project.rules.length}</span></div>{dashboard.project.rules.map((rule) => <div key={rule.id} className="flex items-center gap-3 border-b border-zinc-900 px-4 py-3"><ListFilter size={14} className="text-red-500" /><div className="min-w-0 flex-1 text-xs"><div className="truncate text-zinc-300">{rule.appName || rule.domain || rule.titleKeyword}</div><div className="mt-0.5 text-[10px] text-zinc-600">{rule.matchType} · {rule.appName ? "app" : rule.domain ? "domain" : "title"}</div></div><button title="Delete rule" onClick={() => void action(rule.id, () => projectRulesApi.delete(selectedId!, rule.id))} className="text-zinc-600 hover:text-red-400"><Trash2 size={14} /></button></div>)}</section>
                </div>}

                {tab === "rules" && <RulesEditor
                  projectName={selectedProject.name}
                  rules={dashboard.project.rules}
                  form={ruleForm}
                  setForm={setRuleForm}
                  editingRuleId={editingRuleId}
                  busy={busy === "rule"}
                  onSave={addRule}
                  onCancelEdit={() => { setEditingRuleId(null); setRuleForm(emptyRule); }}
                  onEdit={(rule) => { setEditingRuleId(rule.id); setRuleForm({ appName: rule.appName || "", domain: rule.domain || "", titleKeyword: rule.titleKeyword || "", matchType: rule.matchType }); }}
                  onDelete={(rule) => void action(rule.id, () => projectRulesApi.delete(selectedId!, rule.id))}
                  testForm={testForm}
                  setTestForm={setTestForm}
                  testResult={testResult}
                  onTest={() => projectRulesApi.test(selectedId!, testForm).then((data) => setTestResult(data as typeof testResult))}
                />}

                {tab === "unassigned" && <ActivityList activities={unassigned} selected={selectedActivities} onToggle={toggleActivity} empty="No unassigned activity in the last 7 days" />}
              </div>

              {(tab === "activity" || tab === "unassigned") && selectedActivities.length > 0 && <div className="flex h-12 shrink-0 items-center gap-3 border-t border-red-500/20 bg-red-500/5 px-4"><span className="text-xs text-zinc-200">{selectedActivities.length} selected</span><span className="flex-1" />{tab === "unassigned" && <label className="flex items-center gap-2 text-xs text-zinc-400"><button onClick={() => setRemember((value) => !value)}>{remember ? <CheckSquare size={16} className="text-red-500" /> : <Square size={16} />}</button>Remember</label>}<select value={targetProjectId} onChange={(event) => setTargetProjectId(event.target.value)} className="h-8 max-w-44 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300"><option value="">Unassigned</option>{projects.filter((project) => project.active).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button disabled={busy === "assign"} onClick={() => void assignSelected(targetProjectId || null, tab === "unassigned" && remember)} className="sam-button" data-variant="primary">{busy === "assign" ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Apply</button></div>}
            </> : <div className="flex h-full items-center justify-center text-sm text-zinc-600">Create or select a project</div>}
          </main>
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
            onSubmit={saveProject}
            className="samaritan-card sam-dialog-aperture relative w-full max-w-lg overflow-hidden border border-zinc-800 bg-zinc-950"
          >
            <div className="sam-scanline-beam" aria-hidden="true" />

            {/* Surveillance Directive Banner */}
            <div className="flex shrink-0 select-none items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2 font-mono text-[10px] tracking-wider">
              <div className="flex items-center gap-2">
                <span className="text-xs leading-none text-red-500 animate-pulse" aria-hidden="true">
                  ▼
                </span>
                <span className="uppercase text-zinc-500">{"/// SYS.DIRECTIVE //"}</span>
                <span className="font-bold uppercase text-white">PROJECT.CONFIG</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
                <span className="font-mono">[{editing ? "MUTATE" : "CREATE"}]</span>
              </div>
            </div>

            <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-5">
              <h2 className="font-mono text-sm font-bold uppercase text-white">
                {editing ? "Edit project" : "New project"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X size={17} className="text-zinc-500 hover:text-white" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
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
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Icon</span>
                  <input
                    maxLength={4}
                    value={form.icon}
                    onChange={(event) => setForm({ ...form, icon: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-red-500/50"
                    placeholder="Initial"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Color</span>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) => setForm({ ...form, color: event.target.value })}
                    className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 p-1"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block font-mono text-xs uppercase text-zinc-400">Weekly target</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={0.5}
                    value={form.weeklyHourGoal}
                    onChange={(event) => setForm({ ...form, weeklyHourGoal: Number(event.target.value) })}
                    className="min-w-0 flex-1 accent-red-500"
                  />
                  <span className="w-14 text-right font-mono text-sm text-red-400">{form.weeklyHourGoal}h</span>
                </div>
              </label>
            </div>
            <div className="flex h-14 items-center justify-end gap-2 border-t border-zinc-800 px-5">
              <button type="button" onClick={() => setShowModal(false)} className="sam-button">
                Cancel
              </button>
              <button disabled={busy === "project"} className="sam-button" data-variant="primary">
                {busy === "project" ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function RulesEditor({ projectName, rules, form, setForm, editingRuleId, busy, onSave, onCancelEdit, onEdit, onDelete, testForm, setTestForm, testResult, onTest }: {
  projectName: string;
  rules: ProjectRule[];
  form: typeof emptyRule;
  setForm: (value: typeof emptyRule) => void;
  editingRuleId: string | null;
  busy: boolean;
  onSave: (event: FormEvent) => void;
  onCancelEdit: () => void;
  onEdit: (rule: ProjectRule) => void;
  onDelete: (rule: ProjectRule) => void;
  testForm: { appName: string; domain: string; windowTitle: string };
  setTestForm: (value: { appName: string; domain: string; windowTitle: string }) => void;
  testResult: { matchesProject: boolean; projectName: string | null; confidence: number } | null;
  onTest: () => void;
}) {
  return <div className="grid min-h-full lg:grid-cols-[minmax(280px,.42fr)_minmax(0,.58fr)]">
    <section className="border-b border-zinc-900 p-4 lg:border-b-0 lg:border-r">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-medium uppercase text-zinc-500">{editingRuleId ? "Edit rule" : "New rule"}</h3>{editingRuleId && <button onClick={onCancelEdit} className="sam-button">Cancel</button>}</div>
      <form onSubmit={onSave} className="space-y-2">
        <input placeholder="App name" value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-red-500/50" />
        <input placeholder="Domain" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-red-500/50" />
        <input placeholder="Window title keyword" value={form.titleKeyword} onChange={(event) => setForm({ ...form, titleKeyword: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-red-500/50" />
        <div className="flex gap-2"><select value={form.matchType} onChange={(event) => setForm({ ...form, matchType: event.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs"><option value="exact">Exact</option><option value="contains">Contains</option></select><button disabled={busy} className="sam-button" data-variant="primary">{busy ? <LoaderCircle size={13} className="animate-spin" /> : editingRuleId ? <Check size={13} /> : <Plus size={13} />}{editingRuleId ? "Save" : "Add"}</button></div>
      </form>
      <div className="my-4 border-t border-zinc-900" />
      <h3 className="mb-2 text-xs font-medium uppercase text-zinc-500">Test attribution</h3>
      <div className="space-y-2"><input placeholder="App name" value={testForm.appName} onChange={(event) => setTestForm({ ...testForm, appName: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs" /><input placeholder="Domain or window title" value={testForm.domain} onChange={(event) => setTestForm({ ...testForm, domain: event.target.value, windowTitle: event.target.value })} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs" /><button type="button" onClick={onTest} className="sam-button w-full"><Search size={13} /> Test rules</button>{testResult && <div className={`rounded-lg border px-3 py-2 text-xs ${testResult.matchesProject ? "border-zinc-700 bg-zinc-900 text-white" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{testResult.matchesProject ? `Matched ${projectName}` : testResult.projectName ? `Matched ${testResult.projectName}` : "No project matched"}</div>}</div>
    </section>
    <section><div className="flex h-10 items-center justify-between border-b border-zinc-900 px-4"><span className="text-xs uppercase text-zinc-500">Rules</span><span className="text-xs text-zinc-600">{rules.length}</span></div>{rules.map((rule) => <div key={rule.id} className={`flex items-center gap-3 border-b border-zinc-900 px-4 py-3 ${editingRuleId === rule.id ? "bg-red-500/10" : ""}`}><ListFilter size={14} className="text-red-500" /><div className="min-w-0 flex-1 text-xs"><div className="truncate text-zinc-300">{rule.appName || rule.domain || rule.titleKeyword}</div><div className="mt-0.5 text-[10px] text-zinc-600">{rule.matchType} · {rule.appName ? "app" : rule.domain ? "domain" : "title"}</div></div><button title="Edit rule" onClick={() => onEdit(rule)} className="text-zinc-600 hover:text-red-400"><Pencil size={14} /></button><button title="Delete rule" onClick={() => onDelete(rule)} className="text-zinc-600 hover:text-red-400"><Trash2 size={14} /></button></div>)}</section>
  </div>;
}

function ActivityList({ activities, selected, onToggle, empty = "No project activity in this range" }: { activities: Activity[]; selected: string[]; onToggle: (id: string) => void; empty?: string }) {
  if (!activities.length) return <div className="flex min-h-56 items-center justify-center text-sm text-zinc-600">{empty}</div>;
  return <div>{activities.map((activity) => { const checked = selected.includes(activity.id); return <button key={activity.id} onClick={() => onToggle(activity.id)} className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-900 px-4 py-3 text-left transition ${checked ? "bg-red-500/10" : "hover:bg-zinc-950"}`}>{checked ? <CheckSquare size={16} className="text-red-500" /> : <Square size={16} className="text-zinc-700" />}<span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-xs font-medium text-zinc-300">{activity.appName}</span>{activity.category && <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-600">{activity.category.replaceAll('_', ' ')}</span>}</span><span className="mt-1 block truncate text-[11px] text-zinc-600">{activity.windowTitle || activity.domain || "Untitled activity"}</span></span><span className="text-right"><span className="block text-xs text-zinc-400">{hours(activity.durationMinutes)}</span><span className="mt-1 block text-[10px] text-zinc-700">{activityTime(activity.startTime)}</span></span></button>; })}</div>;
}
