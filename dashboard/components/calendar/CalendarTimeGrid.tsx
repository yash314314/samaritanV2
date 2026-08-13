"use client";

import { useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { Activity } from "lucide-react";
import { layoutCalendarEvents } from "@/lib/calendarLayout";
import { calendarDateKey, calendarIntervalSegment, calendarMinuteOfDay, calendarTimeLabel, type CalendarDaySegment } from "@/lib/calendarTime";

export type TimeGridEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  project?: { color: string } | null;
};

export type TimeGridSession = {
  id: string;
  calendarEventId: string | null;
  type: "meeting" | "focus" | "break";
  status: string;
  title: string;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMs: number;
};

type DragSelection = {
  dayIndex: number;
  startMinute: number;
  endMinute: number;
};

type ResizeState = {
  eventId: string;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  gridTop: number;
  gridHeight: number;
};

type Props = {
  view: "day" | "week";
  selectedDay: Date;
  events: TimeGridEvent[];
  sessions: TimeGridSession[];
  timeZone: string;
  onSelectDay: (day: Date) => void;
  onCreateRange: (day: Date, startMinute: number, endMinute: number) => void;
  onEditEvent: (event: TimeGridEvent) => void;
  onMoveEvent: (event: TimeGridEvent, day: Date, startMinute: number) => void;
  onResizeEvent: (event: TimeGridEvent, endDay: Date, endMinute: number) => void;
};

const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const SNAP_MINUTES = 15;

function clampMinute(value: number) {
  return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, value));
}

function snappedMinute(clientY: number, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return snappedMinuteFromRect(clientY, rect.top, rect.height);
}

function snappedMinuteFromRect(clientY: number, top: number, height: number) {
  const relative = Math.max(0, Math.min(height, clientY - top));
  const raw = START_HOUR * 60 + (relative / Math.max(1, height)) * TOTAL_MINUTES;
  return clampMinute(Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES);
}

function blockStyle(startMinute: number, endMinute: number) {
  const start = clampMinute(startMinute);
  const end = clampMinute(endMinute);
  return {
    top: `${((start - START_HOUR * 60) / TOTAL_MINUTES) * 100}%`,
    height: `${Math.max(1.2, ((end - start) / TOTAL_MINUTES) * 100)}%`,
  };
}

function sessionColor(type: TimeGridSession["type"]) {
  if (type === "meeting") return { border: "#22d3ee", background: "rgba(6, 182, 212, 0.14)" };
  if (type === "focus") return { border: "#a855f7", background: "rgba(168, 85, 247, 0.16)" };
  return { border: "#34d399", background: "rgba(16, 185, 129, 0.14)" };
}

function compactDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function CalendarTimeGrid({
  view,
  selectedDay,
  events,
  sessions,
  timeZone,
  onSelectDay,
  onCreateRange,
  onEditEvent,
  onMoveEvent,
  onResizeEvent,
}: Props) {
  const [selection, setSelection] = useState<DragSelection | null>(null);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizeState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const justResizedRef = useRef<string | null>(null);
  const days = useMemo(() => {
    if (view === "day") return [selectedDay];
    const start = startOfWeek(selectedDay);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [selectedDay, view]);
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);

  function beginSelection(event: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (event.button !== 0 || draggedEventId) return;
    const minute = snappedMinute(event.clientY, event.currentTarget);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ dayIndex, startMinute: minute, endMinute: minute + 30 });
  }

  function updateSelection(event: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (!selection || selection.dayIndex !== dayIndex) return;
    setSelection({ ...selection, endMinute: snappedMinute(event.clientY, event.currentTarget) });
  }

  function finishSelection(event: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (!selection || selection.dayIndex !== dayIndex) return;
    const pointerMinute = snappedMinute(event.clientY, event.currentTarget);
    const start = Math.min(selection.startMinute, pointerMinute);
    const end = Math.max(selection.startMinute, pointerMinute);
    setSelection(null);
    onCreateRange(days[dayIndex], start, Math.max(start + 30, end));
  }

  function beginResize(event: React.PointerEvent<HTMLSpanElement>, calendarEvent: TimeGridEvent, segment: CalendarDaySegment, dayIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    const grid = event.currentTarget.closest<HTMLElement>("[data-calendar-day]");
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const state: ResizeState = {
      eventId: calendarEvent.id,
      dayIndex,
      startMinute: segment.startMinute,
      endMinute: segment.endMinute,
      gridTop: rect.top,
      gridHeight: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = state;
    setResizePreview(state);
  }

  function updateResize(event: React.PointerEvent<HTMLSpanElement>) {
    const state = resizeRef.current;
    if (!state) return;
    event.preventDefault();
    event.stopPropagation();
    const endMinute = Math.max(
      state.startMinute + SNAP_MINUTES,
      snappedMinuteFromRect(event.clientY, state.gridTop, state.gridHeight)
    );
    const next = { ...state, endMinute };
    resizeRef.current = next;
    setResizePreview(next);
  }

  function finishResize(event: React.PointerEvent<HTMLSpanElement>, calendarEvent: TimeGridEvent) {
    const state = resizeRef.current;
    if (!state || state.eventId !== calendarEvent.id) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setResizePreview(null);
    justResizedRef.current = calendarEvent.id;
    onResizeEvent(calendarEvent, days[state.dayIndex], state.endMinute);
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <div
        className="grid border-b border-zinc-800 bg-zinc-950/70"
        style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          const selected = isSameDay(day, selectedDay);
          const dayKey = format(day, "yyyy-MM-dd");
          const allDayEvents = events.filter((event) => event.allDay && calendarIntervalSegment(event.startAt, event.endAt, dayKey, timeZone));
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`min-w-0 border-l border-zinc-800 px-2 py-2 text-center transition ${selected ? "bg-purple-500/8" : "hover:bg-zinc-900"}`}
            >
              <div className="text-[10px] font-medium uppercase text-zinc-500">{format(day, "EEE")}</div>
              <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${today ? "bg-purple-500 text-white" : "text-zinc-200"}`}>
                {format(day, "d")}
              </div>
              {allDayEvents.slice(0, 1).map((event) => (
                <div key={event.id} className="mt-1 truncate rounded px-1 py-0.5 text-[9px] text-white" style={{ background: event.color ?? "#7c3aed" }}>
                  {event.title}
                </div>
              ))}
              {allDayEvents.length > 1 && <div className="mt-0.5 text-[9px] text-zinc-500">+{allDayEvents.length - 1} all-day</div>}
            </button>
          );
        })}
      </div>

      <div
        className="relative grid min-h-0 select-none overflow-hidden"
        style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="relative bg-black">
          {hours.slice(0, -1).map((hour, index) => (
            <div key={hour} className="absolute right-2 -translate-y-1/2 text-[9px] text-zinc-600" style={{ top: `${(index / (hours.length - 1)) * 100}%` }}>
              {format(new Date(2020, 0, 1, hour), "ha")}
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const eventSegments = new Map(
            events
              .filter((event) => !event.allDay)
              .map((event) => [event.id, calendarIntervalSegment(event.startAt, event.endAt, dayKey, timeZone)] as const)
              .filter((entry): entry is readonly [string, CalendarDaySegment] => Boolean(entry[1]))
          );
          const dayEvents = events.filter((event) => eventSegments.has(event.id));
          const positionedEvents = layoutCalendarEvents(dayEvents);
          const unlinkedSessions = sessions.filter((session) =>
            !session.calendarEventId && session.actualStart && calendarDateKey(session.actualStart, timeZone) === dayKey
          );
          const selectedRange = selection?.dayIndex === dayIndex ? {
            start: Math.min(selection.startMinute, selection.endMinute),
            end: Math.max(selection.startMinute, selection.endMinute),
          } : null;
          const isToday = calendarDateKey(new Date(), timeZone) === dayKey;
          const currentMinute = calendarMinuteOfDay(new Date(), timeZone);

          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              data-calendar-day
              className={`relative min-h-0 cursor-crosshair border-l border-zinc-800 ${isSameDay(day, selectedDay) ? "bg-purple-500/[0.025]" : "bg-black"}`}
              onPointerDown={(event) => beginSelection(event, dayIndex)}
              onPointerMove={(event) => updateSelection(event, dayIndex)}
              onPointerUp={(event) => finishSelection(event, dayIndex)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const calendarEvent = events.find((item) => item.id === draggedEventId);
                setDraggedEventId(null);
                if (calendarEvent) onMoveEvent(calendarEvent, day, snappedMinute(event.clientY, event.currentTarget));
              }}
            >
              {hours.map((hour, index) => (
                <div key={hour} className="pointer-events-none absolute left-0 right-0 border-t border-zinc-900" style={{ top: `${(index / (hours.length - 1)) * 100}%` }} />
              ))}

              {selectedRange && (
                <div
                  className="pointer-events-none absolute left-1 right-1 z-30 rounded border border-purple-400 bg-purple-500/20 shadow-[0_0_24px_rgba(168,85,247,0.18)]"
                  style={blockStyle(selectedRange.start, selectedRange.end)}
                >
                  <span className="px-1 text-[9px] font-medium text-purple-100">
                    {Math.max(30, selectedRange.end - selectedRange.start)}m
                  </span>
                </div>
              )}

              {positionedEvents.map(({ event: calendarEvent, column, columnCount }) => {
                const start = new Date(calendarEvent.startAt);
                const end = new Date(calendarEvent.endAt);
                const segment = eventSegments.get(calendarEvent.id)!;
                const startMinute = segment.startMinute;
                const endMinute = resizePreview?.eventId === calendarEvent.id
                  ? resizePreview.endMinute
                  : segment.endMinute;
                const originalStartMinute = calendarMinuteOfDay(start, timeZone);
                const visibleStartLabel = segment.startsHere ? calendarTimeLabel(start, timeZone) : "00:00";
                const visibleEndLabel = segment.endMinute === 24 * 60 ? "24:00" : calendarTimeLabel(end, timeZone);
                const tracked = sessions.find((session) => session.calendarEventId === calendarEvent.id);
                const scheduledMs = Math.max(1, end.getTime() - start.getTime());
                const actualPercent = Math.min(100, (Number(tracked?.actualDurationMs ?? 0) / scheduledMs) * 100);
                const color = calendarEvent.color || calendarEvent.project?.color || "#8b5cf6";
                return (
                  <button
                    key={calendarEvent.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      if (resizeRef.current?.eventId === calendarEvent.id) {
                        event.preventDefault();
                        return;
                      }
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedEventId(calendarEvent.id);
                    }}
                    onDragEnd={() => setDraggedEventId(null)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      if (justResizedRef.current === calendarEvent.id) {
                        justResizedRef.current = null;
                        return;
                      }
                      onEditEvent(calendarEvent);
                    }}
                    onKeyDown={(keyEvent) => {
                      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(keyEvent.key)) return;
                      keyEvent.preventDefault();
                      keyEvent.stopPropagation();
                      const direction = keyEvent.key === "ArrowUp" || keyEvent.key === "ArrowLeft" ? -1 : 1;
                      if (keyEvent.shiftKey && (keyEvent.key === "ArrowUp" || keyEvent.key === "ArrowDown")) {
                        if (segment.endsHere) onResizeEvent(calendarEvent, day, Math.max(startMinute + SNAP_MINUTES, endMinute + direction * SNAP_MINUTES));
                        return;
                      }
                      if (keyEvent.key === "ArrowLeft" || keyEvent.key === "ArrowRight") {
                        const [year, month, date] = calendarDateKey(calendarEvent.startAt, timeZone).split("-").map(Number);
                        onMoveEvent(calendarEvent, addDays(new Date(year, month - 1, date), direction), originalStartMinute);
                        return;
                      }
                      if (!segment.startsHere) return;
                      const durationMinutes = Math.max(SNAP_MINUTES, endMinute - startMinute);
                      const nextStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - durationMinutes, startMinute + direction * SNAP_MINUTES));
                      onMoveEvent(calendarEvent, day, nextStart);
                    }}
                    className="absolute z-10 min-w-0 cursor-grab overflow-hidden rounded border px-1.5 py-1 text-left text-white shadow-lg transition-[filter,box-shadow] hover:z-30 hover:brightness-110 active:cursor-grabbing"
                    style={{
                      ...blockStyle(startMinute, endMinute),
                      left: `calc(${(column / columnCount) * 100}% + 3px)`,
                      width: `calc(${100 / columnCount}% - 5px)`,
                      borderColor: color,
                      background: `${color}cc`,
                    }}
                    title={`${calendarTimeLabel(start, timeZone)} - ${calendarTimeLabel(end, timeZone)} ${calendarEvent.title}`}
                    aria-label={`${calendarEvent.title}, ${calendarTimeLabel(start, timeZone)} to ${calendarTimeLabel(end, timeZone)}`}
                  >
                    <div className="truncate text-[10px] font-semibold">{calendarEvent.title}</div>
                    <div className="truncate text-[9px] text-white/70">{visibleStartLabel} - {visibleEndLabel}</div>
                    {tracked && (
                      <>
                        <div className="mt-0.5 truncate text-[8px] text-cyan-100/80">
                          {compactDuration(tracked.actualDurationMs)} / {compactDuration(scheduledMs)}
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 bg-cyan-300 transition-all duration-700" style={{ width: `${actualPercent}%` }} title={`${Math.round(actualPercent)}% attended`} />
                      </>
                    )}
                    {segment.endsHere && (
                      <span
                        role="separator"
                        aria-label={`Resize ${calendarEvent.title}`}
                        className="absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize border-b border-white/40 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
                        onPointerDown={(event) => beginResize(event, calendarEvent, segment, dayIndex)}
                        onPointerMove={updateResize}
                        onPointerUp={(event) => finishResize(event, calendarEvent)}
                        onPointerCancel={(event) => finishResize(event, calendarEvent)}
                      />
                    )}
                  </button>
                );
              })}

              {unlinkedSessions.map((session) => {
                const start = new Date(session.actualStart!);
                const end = session.actualEnd ? new Date(session.actualEnd) : new Date();
                const colors = sessionColor(session.type);
                return (
                  <div
                    key={session.id}
                    className="pointer-events-none absolute left-[12%] right-1 z-20 overflow-hidden rounded border-l-2 px-1.5 py-1 backdrop-blur-sm"
                    style={{
                      ...blockStyle(calendarMinuteOfDay(start, timeZone), calendarMinuteOfDay(end, timeZone)),
                      borderColor: colors.border,
                      background: colors.background,
                    }}
                  >
                    <div className="flex items-center gap-1 truncate text-[9px] font-medium text-zinc-100">
                      <Activity className="h-2.5 w-2.5 shrink-0" style={{ color: colors.border }} />
                      {session.title}
                    </div>
                  </div>
                );
              })}

              {isToday && currentMinute >= START_HOUR * 60 && currentMinute <= END_HOUR * 60 && (
                <div className="pointer-events-none absolute left-0 right-0 z-40 flex items-center" style={{ top: `${((currentMinute - START_HOUR * 60) / TOTAL_MINUTES) * 100}%` }}>
                  <span className="-ml-1 h-2 w-2 rounded-full bg-rose-400" />
                  <span className="h-px flex-1 bg-rose-400/80" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
