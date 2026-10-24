"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AppWindow,
  CheckCircle2,
  Globe2,
  Loader2,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";

import { distractionBlocksApi } from "@/lib/api";
import { useWsMessage } from "@/lib/ws";

type Rule = {
  id: string;
  targetType: "app" | "domain";
  target: string;
  normalizedTarget: string;
  scope: "always" | "during_focus";
  active: boolean;
};

type BlockEvent = {
  id: string;
  targetType: "app" | "domain";
  target: string;
  appName: string;
  domain: string | null;
  outcome: "killed" | "failed" | "matched";
  reason: string | null;
  occurredAt: string;
};

type BlockDashboard = {
  rules: Rule[];
  recentEvents: BlockEvent[];
  summary: {
    totalRules: number;
    enabledRules: number;
    activeNow: number;
    attemptsToday: number;
    killedToday: number;
    failedToday: number;
  };
};

type Tab = "rules" | "activity" | "levels";

const EMPTY_DASHBOARD: BlockDashboard = {
  rules: [],
  recentEvents: [],
  summary: { totalRules: 0, enabledRules: 0, activeNow: 0, attemptsToday: 0, killedToday: 0, failedToday: 0 },
};

export default function DistractionBlockerCard({ focusActive }: { focusActive: boolean }) {
  const [data, setData] = useState<BlockDashboard>(EMPTY_DASHBOARD);
  const [tab, setTab] = useState<Tab>("rules");
  const [targetType, setTargetType] = useState<"app" | "domain">("app");
  const [scope, setScope] = useState<"always" | "during_focus">("during_focus");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await distractionBlocksApi.dashboard() as BlockDashboard);
    } catch (loadError) {
      console.error("Distraction blocker load failed", loadError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useWsMessage("distraction-blocks:changed", load);
  useWsMessage("distraction-block:event", load);

  const activeNow = useMemo(
    () => data.rules.filter((rule) => rule.active && (rule.scope === "always" || focusActive)).length,
    [data.rules, focusActive]
  );

  async function run(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    setError("");
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Blocker action failed");
    } finally {
      setBusy(null);
    }
  }

  function addRule(event: FormEvent) {
    event.preventDefault();
    if (!target.trim()) return;
    run("create", async () => {
      await distractionBlocksApi.create({ targetType, target: target.trim(), scope });
      setTarget("");
    });
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "rules", label: "Rules" },
    { id: "activity", label: `Activity ${data.summary.attemptsToday || ""}`.trim() },
    { id: "levels", label: "Levels" },
  ];

  return (
    <div className="samaritan-card flex h-full min-h-0 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Distraction Blocker
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {activeNow} enforced now · {data.summary.killedToday} blocked today
          </p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${activeNow ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-zinc-800 bg-zinc-950 text-zinc-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${activeNow ? "animate-pulse bg-red-500" : "bg-zinc-700"}`} />
          {activeNow ? "Armed" : "Standby"}
        </span>
      </div>

      <div className="sam-segment mt-3 grid grid-cols-3" role="tablist" aria-label="Blocker views">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <form onSubmit={addRule} className="space-y-2 border-b border-zinc-900 pb-3">
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                <button type="button" title="Block an application" onClick={() => setTargetType("app")} className={`flex h-8 w-8 items-center justify-center rounded-md ${targetType === "app" ? "bg-red-500/15 text-red-300" : "text-zinc-600 hover:text-zinc-300"}`}><AppWindow className="h-3.5 w-3.5" /></button>
                <button type="button" title="Block a website domain" onClick={() => setTargetType("domain")} className={`flex h-8 w-8 items-center justify-center rounded-md ${targetType === "domain" ? "bg-red-500/15 text-red-300" : "text-zinc-600 hover:text-zinc-300"}`}><Globe2 className="h-3.5 w-3.5" /></button>
              </div>
              <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder={targetType === "app" ? "Application name" : "example.com"} className="h-9 min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-red-500/40" />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className="h-8 min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-400 outline-none focus:border-red-500/40">
                <option value="during_focus">During focus</option>
                <option value="always">Always</option>
              </select>
              <button type="submit" title="Add blocker rule" disabled={!target.trim() || Boolean(busy)} className="sam-button h-8 w-8 px-0" data-variant="primary">
                {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </form>

          <div className="dashboard-scroll-panel mt-2 flex-1 space-y-1.5 pr-1">
            {data.rules.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">No persistent rules</div>
            ) : data.rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 rounded-lg border border-zinc-900 bg-zinc-950 px-2.5 py-2">
                {rule.targetType === "app" ? <AppWindow className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : <Globe2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-300">{rule.target}</div>
                  <div className="text-[10px] text-zinc-600">{rule.scope === "always" ? "Always" : "During focus"}</div>
                </div>
                <input type="checkbox" title={rule.active ? "Disable rule" : "Enable rule"} checked={rule.active} onChange={(event) => run(rule.id, () => distractionBlocksApi.update(rule.id, { active: event.target.checked }))} disabled={busy === rule.id} className="h-3.5 w-3.5 shrink-0 accent-red-500" />
                <button type="button" title="Delete rule" onClick={() => run(rule.id, () => distractionBlocksApi.delete(rule.id))} disabled={busy === rule.id} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-700 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="dashboard-scroll-panel mt-3 flex-1 space-y-2 pr-1">
          {data.recentEvents.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">No block attempts today</div>
          ) : data.recentEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-2.5 border-b border-zinc-900 pb-2">
              {event.outcome === "killed" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-zinc-300">{event.appName}</div>
                <div className="truncate text-[10px] text-zinc-600">{event.target} · {new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <span className={`text-[10px] font-medium ${event.outcome === "killed" ? "text-zinc-300" : "text-red-400"}`}>{event.outcome}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "levels" && <EnforcementLevels />}
      {error && <div className="mt-2 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">{error}</div>}
    </div>
  );
}

function EnforcementLevels() {
  const levels = [
    { label: "Observe", detail: "Record violations", icon: Activity, tone: "text-zinc-400" },
    { label: "Warn", detail: "Notify immediately", icon: Shield, tone: "text-zinc-200" },
    { label: "Require Reason", detail: "Capture justification", icon: ShieldAlert, tone: "text-red-400" },
    { label: "Block", detail: "Terminate safe-listed apps", icon: XCircle, tone: "text-red-500" },
  ];
  return (
    <div className="dashboard-scroll-panel mt-3 flex-1 space-y-2 pr-1">
      {levels.map((level) => {
        const Icon = level.icon;
        return (
          <div key={level.label} className="flex items-center gap-3 rounded-lg border border-zinc-900 bg-zinc-950 px-3 py-2.5">
            <Icon className={`h-4 w-4 ${level.tone}`} />
            <div className="min-w-0"><div className="text-xs font-medium text-zinc-300">{level.label}</div><div className="text-[10px] text-zinc-600">{level.detail}</div></div>
          </div>
        );
      })}
    </div>
  );
}
