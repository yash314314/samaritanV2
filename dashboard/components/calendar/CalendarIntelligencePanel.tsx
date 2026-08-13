"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, Clock3, Focus, Plus, ShieldAlert, Sparkles } from "lucide-react";

export type CalendarIntelligence = {
  timezone: string;
  workday: { startHour: number; endHour: number };
  summary: {
    pressureScore: number;
    pressureLevel: "low" | "balanced" | "high" | "critical";
    conflictCount: number;
    compressedGapCount: number;
    overloadedDayCount: number;
    focusWindowCount: number;
    availableFocusMs: number;
  };
  days: Array<{
    date: string;
    eventCount: number;
    busyMs: number;
    meetingLoadPercent: number;
    conflictCount: number;
    compressedGapCount: number;
    longestFocusMs: number;
    pressureScore: number;
  }>;
  conflicts: Array<{
    date: string;
    overlapMs: number;
    first: { id: string; title: string; start: string; end: string; color: string | null };
    second: { id: string; title: string; start: string; end: string; color: string | null };
  }>;
  focusWindows: Array<{
    date: string;
    startAt: string;
    endAt: string;
    durationMs: number;
    quality: "prime" | "good" | "available";
    reason: string;
  }>;
  recommendations: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    date?: string;
  }>;
};

function duration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function severityStyle(severity: CalendarIntelligence["recommendations"][number]["severity"]) {
  if (severity === "critical") return { icon: ShieldAlert, color: "text-rose-300", background: "bg-rose-500/10", border: "border-rose-500/20" };
  if (severity === "warning") return { icon: AlertTriangle, color: "text-amber-300", background: "bg-amber-500/10", border: "border-amber-500/20" };
  return { icon: Sparkles, color: "text-purple-300", background: "bg-purple-500/10", border: "border-purple-500/20" };
}

export function CalendarIntelligencePanel({ intelligence, onProtectFocus }: { intelligence: CalendarIntelligence; onProtectFocus: (window: CalendarIntelligence["focusWindows"][number]) => void }) {
  const pressureTone = intelligence.summary.pressureScore >= 75 ? "text-rose-300" : intelligence.summary.pressureScore >= 50 ? "text-amber-300" : "text-emerald-300";
  const busiestDays = [...intelligence.days].sort((a, b) => b.pressureScore - a.pressureScore).slice(0, 8);

  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] border-b border-zinc-800 lg:border-b-0 lg:border-r">
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800 border-b border-zinc-800 sm:grid-cols-4 sm:divide-y-0">
          <div className="px-4 py-3"><div className={`text-xl font-semibold ${pressureTone}`}>{intelligence.summary.pressureScore}</div><div className="text-[9px] uppercase text-zinc-600">Pressure · {intelligence.summary.pressureLevel}</div></div>
          <div className="px-4 py-3"><div className="text-xl font-semibold text-rose-300">{intelligence.summary.conflictCount}</div><div className="text-[9px] uppercase text-zinc-600">Conflicts</div></div>
          <div className="px-4 py-3"><div className="text-xl font-semibold text-amber-300">{intelligence.summary.compressedGapCount}</div><div className="text-[9px] uppercase text-zinc-600">Tight transitions</div></div>
          <div className="px-4 py-3"><div className="text-xl font-semibold text-purple-300">{intelligence.summary.overloadedDayCount}</div><div className="text-[9px] uppercase text-zinc-600">Heavy days</div></div>
        </div>

        <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
          <div className="flex min-h-0 flex-col border-b border-zinc-800 p-4 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-200">Schedule findings</h3>
              <span className="text-[10px] text-zinc-600">{intelligence.timezone}</span>
            </div>
            <div className="dashboard-scroll-panel space-y-2 pr-1">
              {intelligence.conflicts.map((conflict) => (
                <div key={`${conflict.first.id}-${conflict.second.id}`} className="border-l-2 border-rose-500 bg-rose-500/10 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-medium text-zinc-200">{conflict.first.title} overlaps {conflict.second.title}</span><span className="shrink-0 text-[9px] text-rose-300">{duration(conflict.overlapMs)}</span></div>
                      <p className="mt-1 text-[10px] text-zinc-500">{format(new Date(conflict.first.start), "h:mm a")} - {format(new Date(conflict.first.end), "h:mm a")} / {format(new Date(conflict.second.start), "h:mm a")} - {format(new Date(conflict.second.end), "h:mm a")}</p>
                    </div>
                  </div>
                </div>
              ))}
              {intelligence.recommendations.map((recommendation) => {
                const style = severityStyle(recommendation.severity);
                const Icon = style.icon;
                return (
                  <div key={recommendation.id} className={`border-l-2 px-3 py-2.5 ${style.border} ${style.background}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-medium text-zinc-200">{recommendation.title}</span>
                          {recommendation.date && <span className="shrink-0 text-[9px] text-zinc-600">{format(parseISO(recommendation.date), "EEE, MMM d")}</span>}
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{recommendation.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">Highest-pressure days</div>
            <div className="dashboard-scroll-panel space-y-3 pr-1">
              {busiestDays.map((day) => (
                <div key={day.date}>
                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">{format(parseISO(day.date), "EEE, MMM d")}</span>
                    <span className="text-zinc-600">{day.eventCount} events / {day.meetingLoadPercent}% busy</span>
                  </div>
                  <div className="h-1.5 overflow-hidden bg-zinc-900">
                    <div className={`h-full origin-left ${day.pressureScore >= 70 ? "bg-rose-400" : day.pressureScore >= 45 ? "bg-amber-400" : "bg-purple-500"}`} style={{ width: `${Math.max(2, day.pressureScore)}%`, animation: "calendar-width-in 650ms ease-out both" }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-zinc-700"><span>{day.conflictCount} conflicts</span><span>{duration(day.longestFocusMs)} longest focus</span></div>
                </div>
              ))}
              {busiestDays.length === 0 && <div className="py-8 text-center text-xs text-zinc-600">No workdays in this range</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Focus className="h-4 w-4 text-purple-400" /><h3 className="text-sm font-semibold text-zinc-200">Focus opportunities</h3></div>
            <p className="mt-1 text-[10px] text-zinc-600">Open time inside the {intelligence.workday.startHour}:00-{intelligence.workday.endHour}:00 workday</p>
          </div>
          <div className="text-right"><div className="text-sm font-semibold text-purple-200">{duration(intelligence.summary.availableFocusMs)}</div><div className="text-[9px] text-zinc-600">available</div></div>
        </div>
        <div className="dashboard-scroll-panel space-y-2 pr-1">
          {intelligence.focusWindows.map((window) => (
            <div key={`${window.date}-${window.startAt}`} className="group border-l-2 border-purple-500 bg-purple-500/5 px-3 py-2.5 transition hover:bg-purple-500/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-zinc-200">{format(new Date(window.startAt), "EEE, MMM d")}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${window.quality === "prime" ? "bg-purple-500/20 text-purple-200" : "bg-zinc-900 text-zinc-500"}`}>{window.quality}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-zinc-400"><Clock3 className="h-3 w-3" />{format(new Date(window.startAt), "h:mm a")} - {format(new Date(window.endAt), "h:mm a")}</span>
                <span className="font-medium text-purple-300">{duration(window.durationMs)}</span>
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-600">{window.reason}</p>
              <button type="button" onClick={() => onProtectFocus(window)} className="mt-2 flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[10px] text-purple-200 opacity-80 transition hover:bg-purple-500/20 group-hover:opacity-100"><Plus className="h-3 w-3" />Protect</button>
            </div>
          ))}
          {intelligence.focusWindows.length === 0 && <div className="py-10 text-center text-xs text-zinc-600">No future 60-minute focus window in this range</div>}
        </div>
      </section>
    </div>
  );
}
