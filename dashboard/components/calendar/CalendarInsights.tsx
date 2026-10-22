"use client";

import { useState } from "react";
import { Activity, BrainCircuit, BriefcaseBusiness, CalendarCheck2, ClockArrowUp, Gauge, MoonStar, Target, TimerReset } from "lucide-react";
import { format, parseISO } from "date-fns";
import { CalendarIntelligencePanel, type CalendarIntelligence, type CalendarSlotSuggestion } from "./CalendarIntelligencePanel";

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

export type CalendarWorkHoursUtilization = {
  timezone: string;
  from: string;
  to: string;
  summary: {
    scheduledMs: number;
    elapsedScheduledMs: number;
    trackedMs: number;
    withinWorkHoursMs: number;
    offHoursMs: number;
    utilizationPercent: number;
    adherencePercent: number;
    scheduledDayCount: number;
    elapsedDayCount: number;
    onTargetDayCount: number;
    offHoursDayCount: number;
  };
  days: Array<{
    date: string;
    dayOfWeek: number;
    enabled: boolean;
    startMinute: number;
    endMinute: number;
    scheduledMs: number;
    elapsedScheduledMs: number;
    trackedMs: number;
    withinWorkHoursMs: number;
    offHoursMs: number;
    utilizationPercent: number;
    adherencePercent: number;
    firstActivityAt: string | null;
    lastActivityAt: string | null;
    status: "off" | "future" | "upcoming" | "active" | "complete";
  }>;
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
  tone = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "signal" | "alert";
}) {
  const tones = {
    default: "text-zinc-100 bg-zinc-800 border border-zinc-700",
    signal: "text-white bg-zinc-800 border border-zinc-700",
    alert: "text-red-400 bg-red-500/10 border border-red-500/20",
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

function activityWindow(day: CalendarWorkHoursUtilization["days"][number], timeZone: string) {
  if (!day.firstActivityAt || !day.lastActivityAt) return "No tracked activity";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(day.firstActivityAt))} - ${formatter.format(new Date(day.lastActivityAt))}`;
}

function WorkHoursPanel({ utilization }: { utilization: CalendarWorkHoursUtilization }) {
  const visibleDays = utilization.days.filter((day) => day.enabled || day.trackedMs > 0);
  const maxDayMs = Math.max(1, ...visibleDays.map((day) => Math.max(day.scheduledMs, day.trackedMs)));
  const outsideDays = [...visibleDays]
    .filter((day) => day.offHoursMs > 0)
    .sort((left, right) => right.offHoursMs - left.offHoursMs);
  const peakDay = [...visibleDays].sort((left, right) => right.trackedMs - left.trackedMs)[0];

  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="flex min-h-0 flex-col border-b border-zinc-800 p-4 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Tracked against schedule</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-signal text-void" />Within work hours</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-red-500" />Outside schedule</span>
              <span className="flex items-center gap-1.5"><span className="h-px w-3 bg-zinc-500" />Scheduled capacity</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold text-zinc-200">{durationLabel(utilization.summary.trackedMs)}</div>
            <div className="text-[10px] text-zinc-600">tracked in range</div>
          </div>
        </div>

        <div className="dashboard-scroll-panel flex min-h-0 flex-1 items-end gap-1 overflow-x-auto border-b border-zinc-800 px-1 pb-6 pt-3">
          {visibleDays.map((day, index) => {
            const scheduleHeight = (day.scheduledMs / maxDayMs) * 92;
            const withinHeight = (day.withinWorkHoursMs / maxDayMs) * 92;
            const offHeight = (day.offHoursMs / maxDayMs) * 92;
            const date = parseISO(day.date);
            return (
              <div
                key={day.date}
                className="group relative h-full min-w-5 flex-1"
                title={`${format(date, "EEE, MMM d")}: ${durationLabel(day.trackedMs)} tracked, ${durationLabel(day.scheduledMs)} scheduled, ${day.utilizationPercent}% utilized. ${activityWindow(day, utilization.timezone)}`}
              >
                {day.enabled && (
                  <div className="absolute inset-x-0 border-t border-zinc-600/80" style={{ bottom: `${scheduleHeight}%` }} />
                )}
                <div
                  className="absolute inset-x-[18%] bottom-0 min-h-px origin-bottom bg-white/80 transition-colors duration-300 group-hover:bg-white"
                  style={{ height: `${withinHeight}%`, animation: `calendar-bar-rise 520ms ${Math.min(index, 20) * 24}ms ease-out both` }}
                />
                {offHeight > 0 && (
                  <div
                    className="absolute inset-x-[18%] bg-red-500/80 transition-colors duration-300 group-hover:bg-red-400"
                    style={{ bottom: `${withinHeight}%`, height: `${offHeight}%`, animation: `calendar-bar-rise 520ms ${Math.min(index, 20) * 24 + 80}ms ease-out both` }}
                  />
                )}
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-zinc-700 group-hover:text-zinc-300">
                  {format(date, "d")}
                </span>
              </div>
            );
          })}
          {visibleDays.length === 0 && <div className="m-auto text-xs text-zinc-600">No schedule or activity in this range</div>}
        </div>
      </section>

      <section className="flex min-h-0 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Schedule signals</h2>
          <span className="text-[10px] text-zinc-600">15m threshold</span>
        </div>
        <div className="border-b border-zinc-800 pb-3">
          <div className="text-[10px] uppercase text-zinc-600">Longest tracked day</div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-zinc-300">{peakDay ? format(parseISO(peakDay.date), "EEEE, MMM d") : "--"}</span>
            <span className="shrink-0 font-medium text-white">{durationLabel(peakDay?.trackedMs ?? 0)}</span>
          </div>
        </div>
        <div className="mt-3 min-h-0 flex-1">
          <div className="mb-2 text-[10px] uppercase text-zinc-600">Most outside schedule</div>
          <div className="dashboard-scroll-panel space-y-1.5 pr-1">
            {outsideDays.map((day) => (
              <div key={day.date} className="flex items-center justify-between gap-3 border-b border-zinc-900 py-1.5 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-zinc-300">{format(parseISO(day.date), "EEE, MMM d")}</div>
                  <div className="truncate text-[9px] text-zinc-700">{activityWindow(day, utilization.timezone)}</div>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-red-400">{durationLabel(day.offHoursMs)}</span>
              </div>
            ))}
            {outsideDays.length === 0 && <div className="py-6 text-center text-xs text-zinc-600">All tracked time stayed within your schedule</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CalendarInsights({ insights, intelligence, utilization, onProtectFocus, onFindSlot, onApplySlot }: {
  insights: CalendarMeetingInsights;
  intelligence: CalendarIntelligence;
  utilization: CalendarWorkHoursUtilization;
  onProtectFocus: (window: CalendarIntelligence["focusWindows"][number]) => void;
  onFindSlot: (eventId: string) => Promise<CalendarSlotSuggestion>;
  onApplySlot: (suggestion: CalendarSlotSuggestion) => Promise<void>;
}) {
  const [view, setView] = useState<"outcomes" | "schedule" | "work-hours">("outcomes");
  const maxMeetingMs = Math.max(1, ...insights.daily.map((day) => day.meetingMs));
  const totalProjectMs = Math.max(1, insights.projects.reduce((sum, project) => sum + project.durationMs, 0));
  const variancePrefix = insights.varianceMs > 0 ? "+" : insights.varianceMs < 0 ? "-" : "";
  const focusPrefix = insights.focusDelta != null && insights.focusDelta > 0 ? "+" : "";

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
      {view === "work-hours" ? <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800 border-b border-zinc-800 lg:grid-cols-4 lg:divide-y-0">
        <Metric icon={BriefcaseBusiness} label="Utilization" value={`${utilization.summary.utilizationPercent}%`} detail={`${durationLabel(utilization.summary.withinWorkHoursMs)} / ${durationLabel(utilization.summary.elapsedScheduledMs)} elapsed`} />
        <Metric icon={Target} label="Schedule adherence" value={`${utilization.summary.adherencePercent}%`} detail={`${durationLabel(utilization.summary.offHoursMs)} outside schedule`} tone="signal" />
        <Metric icon={MoonStar} label="Off-hours days" value={`${utilization.summary.offHoursDayCount}`} detail="At least 15 minutes outside" tone="alert" />
        <Metric icon={Gauge} label="On-target days" value={`${utilization.summary.onTargetDayCount}/${utilization.summary.elapsedDayCount}`} detail="At least 80% utilized" tone="default" />
      </div> : <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800 border-b border-zinc-800 lg:grid-cols-4 lg:divide-y-0">
        <Metric
          icon={CalendarCheck2}
          label="Attendance"
          value={insights.attendanceRate == null ? "--" : `${insights.attendanceRate}%`}
          detail={`${insights.confirmedCount} confirmed / ${insights.meetingCount} total`}
          tone="signal"
        />
        <Metric
          icon={ClockArrowUp}
          label="Actual vs planned"
          value={`${variancePrefix}${durationLabel(insights.varianceMs)}`}
          detail={`${durationLabel(insights.actualMs)} actual / ${durationLabel(insights.scheduledMs)} planned`}
          tone="default"
        />
        <Metric
          icon={TimerReset}
          label="Median recovery"
          value={durationLabel(insights.medianRecoveryMs)}
          detail={`${insights.recoverySampleCount} observed transitions`}
          tone="alert"
        />
        <Metric
          icon={Gauge}
          label="Post-meeting focus"
          value={insights.focusDelta == null ? "--" : `${focusPrefix}${insights.focusDelta}`}
          detail={`${insights.focusSampleCount} before / after comparisons`}
        />
      </div>}

      <div className="flex min-w-0 items-center justify-between border-b border-zinc-800 bg-black px-3 py-2 sm:px-4">
        <div className="flex min-w-0 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
          <button type="button" onClick={() => setView("outcomes")} className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] transition ${view === "outcomes" ? "bg-signal text-void" : "text-zinc-500 hover:text-zinc-200"}`}>Meetings</button>
          <button type="button" onClick={() => setView("schedule")} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] transition ${view === "schedule" ? "bg-signal text-void" : "text-zinc-500 hover:text-zinc-200"}`}><BrainCircuit className="h-3 w-3" />Schedule</button>
          <button type="button" onClick={() => setView("work-hours")} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] transition ${view === "work-hours" ? "bg-signal text-void" : "text-zinc-500 hover:text-zinc-200"}`}><BriefcaseBusiness className="h-3 w-3" />Work hours</button>
        </div>
        <span className="hidden text-[9px] uppercase text-zinc-700 lg:block">Explainable schedule analysis</span>
      </div>

      {view === "outcomes" ? <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col border-b border-zinc-800 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Meeting load and focus</h2>
              <div className="mt-1 flex items-center gap-4 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-signal text-void" />Meeting time</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Daily focus</span>
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
                    className="w-full max-w-8 origin-bottom bg-zinc-600 transition-all duration-500 group-hover:bg-white"
                    style={{ height: `${meetingHeight}%`, animation: `calendar-bar-rise 520ms ${Math.min(index, 12) * 35}ms ease-out both` }}
                  />
                  {day.focusScore != null && (
                    <span
                      className="absolute z-10 h-2 w-2 rounded-full border border-black bg-red-500 transition-transform group-hover:scale-150"
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
      </div> : view === "schedule" ? <CalendarIntelligencePanel intelligence={intelligence} onProtectFocus={onProtectFocus} onFindSlot={onFindSlot} onApplySlot={onApplySlot} /> : <WorkHoursPanel utilization={utilization} />}

      {view === "work-hours" ? <div className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-950/55 text-center sm:grid-cols-4">
        <div className="px-3 py-2"><div className="text-sm font-semibold text-white">{durationLabel(utilization.summary.withinWorkHoursMs)}</div><div className="text-[9px] uppercase text-zinc-600">In hours</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-red-400">{durationLabel(utilization.summary.offHoursMs)}</div><div className="text-[9px] uppercase text-zinc-600">Off hours</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-zinc-200">{durationLabel(utilization.summary.elapsedScheduledMs)}</div><div className="text-[9px] uppercase text-zinc-600">Elapsed schedule</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-zinc-200">{utilization.summary.scheduledDayCount}</div><div className="text-[9px] uppercase text-zinc-600">Scheduled days</div></div>
      </div> : <div className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-950/55 text-center sm:grid-cols-4">
        <div className="px-3 py-2"><div className="text-sm font-semibold text-red-400">{insights.tentativeCount}</div><div className="text-[9px] uppercase text-zinc-600">Review</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-red-400">{insights.missedCount}</div><div className="text-[9px] uppercase text-zinc-600">Missed</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-zinc-200">{durationLabel(insights.overrunMs)}</div><div className="text-[9px] uppercase text-zinc-600">Overrun</div></div>
        <div className="px-3 py-2"><div className="text-sm font-semibold text-zinc-200">{insights.meetingCount}</div><div className="text-[9px] uppercase text-zinc-600">Meetings</div></div>
      </div>}
    </div>
  );
}
