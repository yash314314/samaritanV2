"use client";

import { useState } from "react";
import { Activity, BrainCircuit, CalendarCheck2, ClockArrowUp, Gauge, TimerReset } from "lucide-react";
import { format, parseISO } from "date-fns";
import { CalendarIntelligencePanel, type CalendarIntelligence } from "./CalendarIntelligencePanel";

export type CalendarMeetingInsights = {
  scheduledMs: number;
  actualMs: number;
  varianceMs: number;
  overrunMs: number;
  meetingCount: number;
  confirmedCount: number;
  tentativeCount: number;
  missedCount: number;
  attendanceRate: number | null;
  medianRecoveryMs: number | null;
  recoverySampleCount: number;
  focusDelta: number | null;
  focusSampleCount: number;
  daily: Array<{ date: string; meetingMs: number; meetingCount: number; focusScore: number | null }>;
  projects: Array<{ id: string | null; name: string; color: string; durationMs: number; meetingCount: number }>;
};

function durationLabel(ms: number | null) {
  if (ms == null) return "--";
  const minutes = Math.round(Math.abs(ms) / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "purple",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: "purple" | "cyan" | "emerald" | "amber";
}) {
  const tones = {
    purple: "text-purple-300 bg-purple-500/10",
    cyan: "text-cyan-300 bg-cyan-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    amber: "text-amber-300 bg-amber-500/10",
  };
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-md p-1.5 ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></span>
        <span className="truncate text-[10px] font-medium uppercase text-zinc-500">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold text-zinc-100">{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-zinc-600">{detail}</div>
    </div>
  );
}

export function CalendarInsights({ insights, intelligence, onProtectFocus }: { insights: CalendarMeetingInsights; intelligence: CalendarIntelligence; onProtectFocus: (window: CalendarIntelligence["focusWindows"][number]) => void }) {
  const [view, setView] = useState<"outcomes" | "schedule">("outcomes");
  const maxMeetingMs = Math.max(1, ...insights.daily.map((day) => day.meetingMs));
  const totalProjectMs = Math.max(1, insights.projects.reduce((sum, project) => sum + project.durationMs, 0));
  const variancePrefix = insights.varianceMs > 0 ? "+" : insights.varianceMs < 0 ? "-" : "";
  const focusPrefix = insights.focusDelta != null && insights.focusDelta > 0 ? "+" : "";

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800 border-b border-zinc-800 lg:grid-cols-4 lg:divide-y-0">
        <Metric
          icon={CalendarCheck2}
          label="Attendance"
          value={insights.attendanceRate == null ? "--" : `${insights.attendanceRate}%`}
          detail={`${insights.confirmedCount} confirmed / ${insights.meetingCount} total`}
          tone="emerald"
        />
        <Metric
          icon={ClockArrowUp}
          label="Actual vs planned"
          value={`${variancePrefix}${durationLabel(insights.varianceMs)}`}
          detail={`${durationLabel(insights.actualMs)} actual / ${durationLabel(insights.scheduledMs)} planned`}
          tone="cyan"
        />
        <Metric
          icon={TimerReset}
          label="Median recovery"
          value={durationLabel(insights.medianRecoveryMs)}
          detail={`${insights.recoverySampleCount} observed transitions`}
          tone="amber"
        />
        <Metric
          icon={Gauge}
          label="Post-meeting focus"
          value={insights.focusDelta == null ? "--" : `${focusPrefix}${insights.focusDelta}`}
          detail={`${insights.focusSampleCount} before / after comparisons`}
        />
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 bg-black px-4 py-2">
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
          <button type="button" onClick={() => setView("outcomes")} className={`rounded-md px-3 py-1.5 text-[11px] transition ${view === "outcomes" ? "bg-purple-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>Meeting outcomes</button>
          <button type="button" onClick={() => setView("schedule")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] transition ${view === "schedule" ? "bg-purple-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}><BrainCircuit className="h-3 w-3" />Schedule intelligence</button>
        </div>
        <span className="text-[9px] uppercase text-zinc-700">Explainable schedule analysis</span>
      </div>

      {view === "outcomes" ? <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col border-b border-zinc-800 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Meeting load and focus</h2>
              <div className="mt-1 flex items-center gap-4 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-purple-500" />Meeting time</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-300" />Daily focus</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-zinc-200">{durationLabel(insights.actualMs)}</div>
              <div className="text-[10px] text-zinc-600">across {insights.meetingCount} meetings</div>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-end gap-1 border-b border-zinc-800 px-1 pb-6 pt-4">
            {[25, 50, 75].map((line) => (
              <div key={line} className="pointer-events-none absolute left-0 right-0 border-t border-zinc-900" style={{ bottom: `${line}%` }} />
            ))}
            {insights.daily.map((day, index) => {
              const meetingHeight = day.meetingMs > 0 ? Math.max(4, (day.meetingMs / maxMeetingMs) * 86) : 1;
              const focus = day.focusScore ?? 0;
              return (
                <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${day.date}: ${durationLabel(day.meetingMs)} meetings, focus ${day.focusScore ?? "--"}`}>
                  <div
                    className="w-full max-w-8 origin-bottom bg-purple-500/75 transition-all duration-500 group-hover:bg-purple-400"
                    style={{ height: `${meetingHeight}%`, animation: `calendar-bar-rise 520ms ${Math.min(index, 12) * 35}ms ease-out both` }}
                  />
                  {day.focusScore != null && (
                    <span
                      className="absolute z-10 h-2 w-2 rounded-full border border-black bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.45)] transition-transform group-hover:scale-150"
                      style={{ bottom: `${Math.max(2, Math.min(96, focus))}%` }}
                    />
                  )}
                  <span className="absolute -bottom-5 text-[8px] text-zinc-700 group-hover:text-zinc-400">
                    {format(parseISO(day.date), "d")}
                  </span>
                </div>
              );
            })}
            {insights.daily.length === 0 && (
              <div className="m-auto text-sm text-zinc-600">No activity in this range</div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Project allocation</h2>
            <span className="text-[10px] text-zinc-600">Actual meeting time</span>
          </div>
          <div className="dashboard-scroll-panel space-y-4 pr-1">
            {insights.projects.map((project) => {
              const percent = Math.round((project.durationMs / totalProjectMs) * 100);
              return (
                <div key={project.id ?? "unassigned"}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 truncate text-zinc-300">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: project.color }} />
                      <span className="truncate">{project.name}</span>
                    </span>
                    <span className="shrink-0 text-zinc-500">{durationLabel(project.durationMs)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden bg-zinc-900">
                    <div className="h-full origin-left transition-all duration-700" style={{ width: `${percent}%`, background: project.color, animation: "calendar-width-in 650ms ease-out both" }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-zinc-700">
                    <span>{project.meetingCount} meetings</span><span>{percent}%</span>
                  </div>
                </div>
              );
            })}
            {insights.projects.length === 0 && <div className="py-8 text-center text-xs text-zinc-600">No project meetings</div>}
          </div>
        </section>
      </div> : <CalendarIntelligencePanel intelligence={intelligence} onProtectFocus={onProtectFocus} />}

      <div className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-950/55 text-center sm:grid-cols-4">
        <div className="px-3 py-2"><div className="text-sm font-semibold text-amber-300">{insights.tentativeCount}</div><div className="text-[9px] uppercase text-zinc-600">Review</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-rose-300">{insights.missedCount}</div><div className="text-[9px] uppercase text-zinc-600">Missed</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-cyan-300">{durationLabel(insights.overrunMs)}</div><div className="text-[9px] uppercase text-zinc-600">Overrun</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-zinc-200">{insights.meetingCount}</div><div className="text-[9px] uppercase text-zinc-600">Meetings</div></div>
      </div>
    </div>
  );
}
