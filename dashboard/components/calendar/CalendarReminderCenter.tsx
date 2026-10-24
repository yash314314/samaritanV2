"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Bell, Clock3, MapPin, X } from "lucide-react";

export interface CalendarReminder {
  id: string;
  status: "scheduled" | "delivered" | "snoozed" | "dismissed" | "expired";
  remindAt: string;
  effectiveAt: string;
  deliveredAt?: string | null;
  snoozedUntil?: string | null;
  calendarEvent: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    allDay: boolean;
    location?: string | null;
    color?: string | null;
    eventType?: string;
  };
}

interface ReminderActions {
  onSnooze: (id: string, minutes: number) => void;
  onDismiss: (id: string) => void;
}

function ReminderRow({ reminder, onSnooze, onDismiss }: { reminder: CalendarReminder } & ReminderActions) {
  const start = new Date(reminder.calendarEvent.startAt);
  const due = reminder.status === "delivered";
  return (
    <div className={`border-l-2 px-3 py-3 ${due ? "bg-red-500/10" : "bg-zinc-950/60"}`} style={{ borderLeftColor: reminder.calendarEvent.color || "var(--sam-series-1)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">{reminder.calendarEvent.title}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Clock3 className="h-3 w-3" />
            {reminder.calendarEvent.allDay ? format(start, "MMM d, 'all day'") : format(start, "MMM d, h:mm a")}
          </div>
          {reminder.calendarEvent.location && (
            <div className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-zinc-600">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{reminder.calendarEvent.location}</span>
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${due ? "bg-red-500/20 text-red-300" : "bg-zinc-900 text-zinc-500"}`}>
          {due ? "Now" : formatDistanceToNow(new Date(reminder.effectiveAt), { addSuffix: true })}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => onSnooze(reminder.id, 10)} className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 transition hover:bg-zinc-700">
          Snooze 10m
        </button>
        <button type="button" onClick={() => onDismiss(reminder.id)} className="px-2 py-1 text-[11px] text-zinc-500 transition hover:text-zinc-200">
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function CalendarReminderBell({
  reminders,
  open,
  onToggle,
  onSnooze,
  onDismiss,
}: { reminders: CalendarReminder[]; open: boolean; onToggle: () => void } & ReminderActions) {
  const activeCount = reminders.filter((item) => item.status === "delivered" || item.status === "snoozed").length;
  return (
    <div className="relative">
      <button type="button" onClick={onToggle} className={`relative rounded-lg border p-2 transition ${open ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100"}`} title="Calendar reminders">
        <Bell className={`h-4 w-4 ${activeCount > 0 ? "animate-[calendar-bell_1.8s_ease-in-out_infinite]" : ""}`} />
        {activeCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[9px] font-semibold text-void">{activeCount}</span>}
      </button>
      {open && (
        <div className="calendar-reminder-enter absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-red-500/30 border-t-red-500 bg-black">
          <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Reminders</div>
              <div className="text-[10px] text-zinc-600">Live schedule notifications</div>
            </div>
            <span className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">{reminders.length} items</span>
          </div>
          <div className="max-h-80 space-y-px overflow-y-auto p-2">
            {reminders.length > 0 ? reminders.map((reminder) => <ReminderRow key={reminder.id} reminder={reminder} onSnooze={onSnooze} onDismiss={onDismiss} />) : (
              <div className="px-4 py-10 text-center text-xs text-zinc-600">No upcoming reminders</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CalendarReminderToast({ reminder, onSnooze, onDismiss }: { reminder: CalendarReminder | null } & ReminderActions) {
  if (!reminder) return null;
  const start = new Date(reminder.calendarEvent.startAt);
  return (
    <div className="calendar-reminder-enter fixed right-5 top-5 z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-red-500/40 border-t-red-500 bg-black">
      <div className="sam-pulse h-0.5 w-full bg-accent" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-500/15 p-2 text-red-400"><Bell className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase text-red-500">Starting soon</div>
            <div className="mt-1 truncate text-base font-semibold text-zinc-100">{reminder.calendarEvent.title}</div>
            <div className="mt-1 text-xs text-zinc-500">{format(start, "h:mm a")} · {formatDistanceToNow(start, { addSuffix: true })}</div>
          </div>
          <button type="button" onClick={() => onDismiss(reminder.id)} className="rounded p-1 text-zinc-600 hover:text-zinc-200" title="Dismiss reminder"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onSnooze(reminder.id, 10)} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700">Snooze 10m</button>
          <button type="button" onClick={() => onDismiss(reminder.id)} className="sam-button">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
