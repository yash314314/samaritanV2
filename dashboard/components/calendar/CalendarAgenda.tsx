"use client";

import { useMemo } from "react";
import { Briefcase, CalendarDays, Clock3, MapPin, Repeat2, ShieldCheck, Users } from "lucide-react";
import { calendarDateKey, calendarTimeLabel } from "@/lib/calendarTime";

export type AgendaEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  location?: string | null;
  busy?: boolean;
  eventType?: string;
  attendeeCount?: number;
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
  focusAutoStart?: boolean;
  focusEnforcement?: string;
  project?: { id?: string; name: string; color: string } | null;
};

export type AgendaSession = {
  calendarEventId: string | null;
  status: string;
  actualDurationMs: number;
};

type Props = {
  events: AgendaEvent[];
  sessions: AgendaSession[];
  timeZone: string;
  onEditEvent: (event: AgendaEvent) => void;
};

function dayLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function compactDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim();
}

function statusClass(status: string) {
  if (status === "active") return "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200";
  if (status === "confirmed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (status === "tentative" || status === "detecting") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (status === "missed" || status === "rejected") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

export function CalendarAgenda({ events, sessions, timeZone, onEditEvent }: Props) {
  const groups = useMemo(() => {
    const sorted = [...events].sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
    const grouped = new Map<string, AgendaEvent[]>();
    for (const event of sorted) {
      const key = calendarDateKey(event.startAt, timeZone);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return [...grouped.entries()];
  }, [events, timeZone]);

  const plannedMs = events.reduce((sum, event) => sum + Math.max(0, new Date(event.endAt).getTime() - new Date(event.startAt).getTime()), 0);
  const focusCount = events.filter((event) => event.eventType === "focus").length;
  const meetingCount = events.filter((event) => event.eventType === "meeting").length;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-black">
      <div className="grid grid-cols-2 divide-x divide-zinc-800 border-b border-zinc-800 bg-zinc-950/70 sm:grid-cols-4">
        {[
          ["Events", events.length],
          ["Planned", compactDuration(plannedMs)],
          ["Meetings", meetingCount],
          ["Focus blocks", focusCount],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <div className="text-base font-semibold text-zinc-100">{value}</div>
            <div className="text-[9px] font-medium uppercase text-zinc-600">{label}</div>
          </div>
        ))}
      </div>

      <div className="min-h-0 overflow-y-auto">
        {groups.map(([key, dayEvents]) => (
          <section key={key} className="border-b border-zinc-900 last:border-b-0">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-900 bg-black/95 px-4 py-2 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <CalendarDays className="h-3.5 w-3.5 text-purple-400" />
                {dayLabel(dayEvents[0].startAt, timeZone)}
              </div>
              <span className="text-[10px] text-zinc-600">{dayEvents.length}</span>
            </div>

            <div className="divide-y divide-zinc-900/80">
              {dayEvents.map((event) => {
                const session = sessions.find((item) => item.calendarEventId === event.id);
                const startKey = calendarDateKey(event.startAt, timeZone);
                const endKey = calendarDateKey(event.endAt, timeZone);
                const time = event.allDay
                  ? "All day"
                  : startKey === endKey
                  ? `${calendarTimeLabel(event.startAt, timeZone)} to ${calendarTimeLabel(event.endAt, timeZone)}`
                  : `${calendarTimeLabel(event.startAt, timeZone)} to ${dayLabel(event.endAt, timeZone)}, ${calendarTimeLabel(event.endAt, timeZone)}`;
                const color = event.color || event.project?.color || "#8b5cf6";

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEditEvent(event)}
                    className="group grid w-full grid-cols-[4px_minmax(0,1fr)_auto] items-stretch gap-0 text-left transition hover:bg-zinc-950 focus-visible:bg-zinc-950 focus-visible:outline-none"
                    aria-label={`Edit ${event.title}`}
                  >
                    <span style={{ backgroundColor: color }} />
                    <span className="min-w-0 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-2">
                        {(event.recurrenceRule || event.recurrenceParentId) && <Repeat2 className="h-3 w-3 shrink-0 text-purple-400" />}
                        <span className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">{event.title}</span>
                        {event.eventType && event.eventType !== "event" && (
                          <span className="shrink-0 rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-500">{event.eventType}</span>
                        )}
                        {event.focusAutoStart && <ShieldCheck className="h-3 w-3 shrink-0 text-purple-400" />}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{time}</span>
                        {event.location && <span className="flex max-w-56 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{event.location}</span>}
                        {event.project && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{event.project.name}</span>}
                        {Number(event.attendeeCount ?? 0) > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.attendeeCount}</span>}
                      </span>
                    </span>
                    <span className="flex min-w-24 flex-col items-end justify-center gap-1 px-4 py-3">
                      <span className="text-xs text-zinc-500">{compactDuration(new Date(event.endAt).getTime() - new Date(event.startAt).getTime())}</span>
                      {session && <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${statusClass(session.status)}`}>{session.status}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
            <CalendarDays className="h-6 w-6 text-zinc-700" />
            <div className="mt-3 text-sm font-medium text-zinc-300">No matching events</div>
            <div className="mt-1 text-xs text-zinc-600">Try another date range or filter.</div>
          </div>
        )}
      </div>
    </div>
  );
}
