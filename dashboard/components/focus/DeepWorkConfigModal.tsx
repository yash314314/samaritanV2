"use client";

import { useState, useCallback, useEffect } from "react";
import { getUserId, projectsApi } from "@/lib/api";
import {
  X,
  Target,
  Clock,
  Shield,
  AlertTriangle,
  Plus,
  Check,
  Code,
  Globe,
  Terminal,
  FileText,
  BookOpen,
  PenTool,
  Send,
  MessageSquare,
  MessageCircle,
  Smartphone,
  Music,
  Gamepad2,
  Video,
  Image,
  Monitor,
  Mail,
  Calendar,
  ChevronDown,
  FolderKanban,
  TimerReset,
  Volume2,
} from "lucide-react";

const APP_CATALOG = [
  { name: "VS Code", icon: Code, category: "productive" },
  { name: "Chrome", icon: Globe, category: "neutral" },
  { name: "Cursor", icon: Terminal, category: "productive" },
  { name: "Terminal", icon: Terminal, category: "productive" },
  { name: "Notion", icon: FileText, category: "productive" },
  { name: "Obsidian", icon: BookOpen, category: "productive" },
  { name: "Figma", icon: PenTool, category: "productive" },
  { name: "Postman", icon: Send, category: "productive" },
  { name: "Slack", icon: MessageSquare, category: "distracting" },
  { name: "Discord", icon: MessageCircle, category: "distracting" },
  { name: "WhatsApp", icon: Smartphone, category: "distracting" },
  { name: "Telegram", icon: Send, category: "distracting" },
  { name: "Spotify", icon: Music, category: "distracting" },
  { name: "Steam", icon: Gamepad2, category: "distracting" },
  { name: "YouTube", icon: Video, category: "distracting" },
  { name: "Photos", icon: Image, category: "distracting" },
  { name: "Mail", icon: Mail, category: "neutral" },
  { name: "Calendar", icon: Calendar, category: "neutral" },
  { name: "Monitor", icon: Monitor, category: "neutral" },
];

const DOMAIN_CATALOG = [
  { name: "github.com", category: "productive" },
  { name: "stackoverflow.com", category: "productive" },
  { name: "docs.google.com", category: "productive" },
  { name: "notion.so", category: "productive" },
  { name: "linear.app", category: "productive" },
  { name: "figma.com", category: "productive" },
  { name: "youtube.com", category: "distracting" },
  { name: "twitter.com", category: "distracting" },
  { name: "x.com", category: "distracting" },
  { name: "instagram.com", category: "distracting" },
  { name: "reddit.com", category: "distracting" },
  { name: "netflix.com", category: "distracting" },
  { name: "twitch.tv", category: "distracting" },
];

const DURATIONS = [25, 45, 60, 90, 120];

const PROTOCOL_PRESETS = [
  {
    name: "Coding",
    goal: "Ship focused engineering work",
    allowedApps: ["Cursor", "VS Code", "Terminal", "Postman"],
    allowedDomains: ["github.com", "stackoverflow.com"],
    blockedApps: ["Discord", "Steam", "Spotify"],
    blockedDomains: ["youtube.com", "reddit.com", "twitter.com", "x.com"],
  },
  {
    name: "Research",
    goal: "Read, analyze, and capture notes",
    allowedApps: ["Chrome", "Obsidian", "Notion"],
    allowedDomains: ["docs.google.com", "notion.so"],
    blockedApps: ["Discord", "Steam"],
    blockedDomains: ["youtube.com", "instagram.com", "netflix.com"],
  },
  {
    name: "Writing",
    goal: "Draft without context switching",
    allowedApps: ["Obsidian", "Notion", "VS Code"],
    allowedDomains: ["docs.google.com", "notion.so"],
    blockedApps: ["Slack", "Discord", "WhatsApp", "Telegram"],
    blockedDomains: ["reddit.com", "twitter.com", "x.com", "youtube.com"],
  },
];

const ENFORCEMENT_LEVELS = [
  { value: "observe", label: "Observe", desc: "Log only, no blocking", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  { value: "warn", label: "Warn", desc: "Notification on violation", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { value: "require_reason", label: "Require Reason", desc: "Require justification, no app kill", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { value: "block", label: "Block", desc: "Terminate violating apps", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onStart: (config: {
    goal: string;
    projectId?: string | null;
    plannedMinutes: number;
    enforcement: string;
    allowedApps: string[];
    allowedDomains: string[];
    blockedApps: string[];
    blockedDomains: string[];
    timerMode: "countdown" | "pomodoro";
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    totalRounds: number;
    ambientSound: "none" | "white" | "pink" | "brown" | "rain";
    ambientVolume: number;
  }) => void;
  defaultDuration?: number;
}

export default function DeepWorkConfigModal({ open, onClose, onStart, defaultDuration = 60 }: Props) {
  const [duration, setDuration] = useState(defaultDuration);
  const [customDuration, setCustomDuration] = useState("");
  const [goal, setGoal] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [enforcement, setEnforcement] = useState("warn");
  const [allowedApps, setAllowedApps] = useState<string[]>([]);
  const [blockedApps, setBlockedApps] = useState<string[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState({ allow: "", block: "" });
  const [showEnforcementDropdown, setShowEnforcementDropdown] = useState(false);
  const [timerMode, setTimerMode] = useState<"countdown" | "pomodoro">("pomodoro");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [totalRounds, setTotalRounds] = useState(4);
  const [ambientSound, setAmbientSound] = useState<"none" | "white" | "pink" | "brown" | "rain">("brown");
  const [ambientVolume, setAmbientVolume] = useState(0.3);

  useEffect(() => {
    if (!open) return;
    projectsApi.list(getUserId()).then((data) => setProjects(data as Array<{ id: string; name: string; color: string }>)).catch(console.error);
  }, [open]);

  const toggleApp = useCallback((name: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(name)) setList(list.filter(n => n !== name));
    else setList([...list, name]);
  }, []);

  const addDomain = useCallback((type: "allow" | "block") => {
    const val = type === "allow" ? domainInput.allow.trim() : domainInput.block.trim();
    if (!val) return;
    const clean = val.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (type === "allow") {
      if (!allowedDomains.includes(clean)) setAllowedDomains([...allowedDomains, clean]);
      setDomainInput(prev => ({ ...prev, allow: "" }));
    } else {
      if (!blockedDomains.includes(clean)) setBlockedDomains([...blockedDomains, clean]);
      setDomainInput(prev => ({ ...prev, block: "" }));
    }
  }, [domainInput, allowedDomains, blockedDomains]);

  const applyPreset = useCallback((preset: typeof PROTOCOL_PRESETS[number]) => {
    setGoal((current) => current || preset.goal);
    setAllowedApps(preset.allowedApps);
    setAllowedDomains(preset.allowedDomains);
    setBlockedApps(preset.blockedApps);
    setBlockedDomains(preset.blockedDomains);
  }, []);

  const handleStart = () => {
    const finalDuration = timerMode === "pomodoro"
      ? focusMinutes * totalRounds
      : duration || Number(customDuration) || 60;
    onStart({
      goal: goal || "Deep work session",
      projectId: projectId || null,
      plannedMinutes: finalDuration,
      enforcement,
      allowedApps,
      allowedDomains,
      blockedApps,
      blockedDomains,
      timerMode,
      focusMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      totalRounds,
      ambientSound,
      ambientVolume,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="samaritan-card relative my-0 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden sm:my-4 sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <Target className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Configure Deep Work</h2>
              <p className="text-xs text-zinc-500">Set your focus parameters</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="dashboard-scroll-panel min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {/* Objective */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Objective
            </label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="What are you trying to accomplish?"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Timer system</label>
            <div className="grid grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              <button type="button" onClick={() => setTimerMode("pomodoro")} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm transition ${timerMode === "pomodoro" ? "bg-purple-500/20 text-purple-300" : "text-zinc-500 hover:text-zinc-300"}`}><TimerReset className="h-4 w-4" /> Pomodoro</button>
              <button type="button" onClick={() => setTimerMode("countdown")} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm transition ${timerMode === "countdown" ? "bg-purple-500/20 text-purple-300" : "text-zinc-500 hover:text-zinc-300"}`}><Clock className="h-4 w-4" /> Countdown</button>
            </div>
          </div>

          {timerMode === "countdown" ? <>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => { setDuration(d); setCustomDuration(""); }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    duration === d && !customDuration
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {d}m
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customDuration}
                  onChange={e => { setCustomDuration(e.target.value); setDuration(0); }}
                  placeholder="Custom"
                  className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-purple-500/50"
                />
                <span className="text-xs text-zinc-600">min</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Protocol Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROTOCOL_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-300 transition-all hover:border-purple-500/40 hover:bg-purple-500/10"
                >
                  <span className="font-semibold">{preset.name}</span>
                  <span className="mt-0.5 block text-[10px] text-zinc-600">
                    {preset.allowedApps.length} allowed / {preset.blockedApps.length + preset.blockedDomains.length} blocked
                  </span>
                </button>
              ))}
            </div>
          </div>
          </> : <div>
            <div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pomodoro cycle</label><span className="text-[11px] text-purple-300">{focusMinutes * totalRounds}m focused</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TimerInput label="Focus" value={focusMinutes} min={5} max={120} onChange={setFocusMinutes} />
              <TimerInput label="Short break" value={shortBreakMinutes} min={1} max={30} onChange={setShortBreakMinutes} />
              <TimerInput label="Long break" value={longBreakMinutes} min={1} max={60} onChange={setLongBreakMinutes} />
              <TimerInput label="Rounds" value={totalRounds} min={1} max={12} onChange={setTotalRounds} suffix="" />
            </div>
            <div className="mt-3 flex gap-1.5" aria-label="Pomodoro presets">
              {[{ label: "Classic", values: [25, 5, 15, 4] }, { label: "Long focus", values: [50, 10, 20, 3] }, { label: "Sprint", values: [15, 3, 10, 4] }].map((preset) => <button key={preset.label} type="button" onClick={() => { setFocusMinutes(preset.values[0]); setShortBreakMinutes(preset.values[1]); setLongBreakMinutes(preset.values[2]); setTotalRounds(preset.values[3]); }} className="rounded-md border border-zinc-800 px-2.5 py-1.5 text-[10px] text-zinc-500 hover:border-purple-500/30 hover:text-purple-300">{preset.label}</button>)}
            </div>
          </div>}

          <div>
            <div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ambient sound</label><span className="text-[10px] text-zinc-600">Generated locally</span></div>
            <div className="grid grid-cols-5 gap-1.5">
              {(["none", "white", "pink", "brown", "rain"] as const).map((sound) => <button key={sound} type="button" onClick={() => setAmbientSound(sound)} className={`rounded-md border px-2 py-2 text-[11px] capitalize transition ${ambientSound === sound ? "border-purple-500/40 bg-purple-500/10 text-purple-300" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>{sound}</button>)}
            </div>
            {ambientSound !== "none" && <div className="mt-3 flex items-center gap-3"><Volume2 className="h-4 w-4 text-zinc-600" /><input aria-label="Ambient sound volume" type="range" min={0} max={1} step={0.05} value={ambientVolume} onChange={(event) => setAmbientVolume(Number(event.target.value))} className="min-w-0 flex-1 accent-purple-500" /><span className="w-9 text-right text-xs tabular-nums text-zinc-500">{Math.round(ambientVolume * 100)}%</span></div>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-zinc-500">Project</label>
            <div className="relative">
              <FolderKanban className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-9 text-sm text-zinc-200 outline-none focus:border-purple-500/50"
              >
                <option value="">No project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>

          {/* Enforcement */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Enforcement Level
            </label>
            <div className="relative">
              <button
                onClick={() => setShowEnforcementDropdown(!showEnforcementDropdown)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm text-zinc-200 hover:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  <span>
                    {ENFORCEMENT_LEVELS.find(e => e.value === enforcement)?.label}
                    <span className="ml-2 text-xs text-zinc-500">
                      — {ENFORCEMENT_LEVELS.find(e => e.value === enforcement)?.desc}
                    </span>
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </button>
              {showEnforcementDropdown && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
                  {ENFORCEMENT_LEVELS.map(level => (
                    <button
                      key={level.value}
                      onClick={() => { setEnforcement(level.value); setShowEnforcementDropdown(false); }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-800 ${
                        enforcement === level.value ? "bg-zinc-800/50" : ""
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full ${level.bg.replace("/10", "")}`} />
                      <div>
                        <div className={`font-medium ${level.color}`}>{level.label}</div>
                        <div className="text-xs text-zinc-500">{level.desc}</div>
                      </div>
                      {enforcement === level.value && <Check className="ml-auto h-4 w-4 text-purple-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Apps */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Allowed Apps */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-emerald-500">
                Allowed Apps
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {allowedApps.map(app => (
                  <span key={app} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400 border border-emerald-500/20">
                    {app}
                    <button onClick={() => setAllowedApps(allowedApps.filter(a => a !== app))} className="hover:text-emerald-300">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <div className="grid grid-cols-2 gap-1">
                  {APP_CATALOG.map(app => {
                    const Icon = app.icon;
                    const selected = allowedApps.includes(app.name);
                    return (
                      <button
                        key={app.name}
                        onClick={() => toggleApp(app.name, allowedApps, setAllowedApps)}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all ${
                          selected
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{app.name}</span>
                        {selected && <Check className="ml-auto h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Blocked Apps */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-rose-500">
                Blocked Apps
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {blockedApps.map(app => (
                  <span key={app} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-400 border border-rose-500/20">
                    {app}
                    <button onClick={() => setBlockedApps(blockedApps.filter(a => a !== app))} className="hover:text-rose-300">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <div className="grid grid-cols-2 gap-1">
                  {APP_CATALOG.map(app => {
                    const Icon = app.icon;
                    const selected = blockedApps.includes(app.name);
                    return (
                      <button
                        key={app.name}
                        onClick={() => toggleApp(app.name, blockedApps, setBlockedApps)}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all ${
                          selected
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{app.name}</span>
                        {selected && <Check className="ml-auto h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Domains */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Allowed Domains */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-emerald-500">
                Allowed Domains
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {allowedDomains.map(d => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400 border border-emerald-500/20">
                    {d}
                    <button onClick={() => setAllowedDomains(allowedDomains.filter(x => x !== d))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput.allow}
                  onChange={e => setDomainInput(prev => ({ ...prev, allow: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addDomain("allow")}
                  placeholder="e.g. github.com"
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/50"
                />
                <button onClick={() => addDomain("allow")} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DOMAIN_CATALOG.filter(d => d.category === "productive").map(d => (
                  <button
                    key={d.name}
                    onClick={() => toggleApp(d.name, allowedDomains, setAllowedDomains)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      allowedDomains.includes(d.name) ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Blocked Domains */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-rose-500">
                Blocked Domains
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {blockedDomains.map(d => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-400 border border-rose-500/20">
                    {d}
                    <button onClick={() => setBlockedDomains(blockedDomains.filter(x => x !== d))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput.block}
                  onChange={e => setDomainInput(prev => ({ ...prev, block: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addDomain("block")}
                  placeholder="e.g. youtube.com"
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-rose-500/50"
                />
                <button onClick={() => addDomain("block")} className="rounded-lg bg-rose-500/10 px-3 py-2 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DOMAIN_CATALOG.filter(d => d.category === "distracting").map(d => (
                  <button
                    key={d.name}
                    onClick={() => toggleApp(d.name, blockedDomains, setBlockedDomains)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      blockedDomains.includes(d.name) ? "bg-rose-500/20 text-rose-400" : "bg-zinc-800 text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              {enforcement !== "observe" && (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  {blockedApps.length + blockedDomains.length} restrictions active
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={timerMode === "countdown" && !duration && !customDuration}
                className="flex items-center gap-2 rounded-lg bg-purple-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Clock className="h-4 w-4" />
                Start Deep Work
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimerInput({ label, value, min, max, onChange, suffix = "m" }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; suffix?: string }) {
  return <label className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"><span className="block text-[10px] text-zinc-600">{label}</span><span className="mt-1 flex items-center gap-1"><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-200 outline-none" /><span className="text-[10px] text-zinc-600">{suffix}</span></span></label>;
}
