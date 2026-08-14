"use client";

import { useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { Activity, BriefcaseBusiness, Clock3 } from "lucide-react";
import {
  calendarGridBlock,
  calendarGridClampMinute,
  calendarGridMinuteAt,
  calendarGridRange,
  type CalendarGridMode,
  type CalendarGridRange,
  type CalendarGridWorkHour,
} from "@/lib/calendarGrid";
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
  workHours: CalendarGridWorkHour[];
  onSelectDay: (day: Date) => void;
  onCreateRange: (day: Date, startMinute: number, endMinute: number) => void;
  onEditEvent: (event: TimeGridEvent) => void;
  onMoveEvent: (event: TimeGridEvent, day: Date, startMinute: number) => void;
  onResizeEvent: (event: TimeGridEvent, endDay: Date, endMinute: number) => void;
};

const SNAP_MINUTES = 15;

function snappedMinute(clientY: number, element: HTMLElement, range: CalendarGridRange) {
  const rect = element.getBoundingClientRect();
  return calendarGridMinuteAt(clientY, rect.top, rect.height, range, SNAP_MINUTES);
}

function blockStyle(startMinute: number, endMinute: number, range: CalendarGridRange) {
  const block = calendarGridBlock(startMinute, endMinute, range);
  return {
    top: `${block.top}%`,
    height: `${block.height}%`,
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
  workHours,
  onSelectDay,
  onCreateRange,
  onEditEvent,
  onMoveEvent,
  onResizeEvent,
}: Props) {
  const [selection, setSelection] = useState<DragSelection | null>(null);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizeState | null>(null);
  const [gridMode, setGridMode] = useState<CalendarGridMode>("work");
  const resizeRef = useRef<ResizeState | null>(null);
  const justResizedRef = useRef<string | null>(null);
  const days = useMemo(() => {
    if (view === "day") return [selectedDay];
    const start = startOfWeek(selectedDay);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [selectedDay, view]);
  const range = useMemo(() => calendarGridRange(workHours, gridMode), [gridMode, workHours]);
  const hours = Array.from(
    { length: range.totalMinutes / 60 + 1 },
    (_, index) => range.startMinute / 60 + index
  );

  function beginSelection(event: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (event.button !== 0 || draggedEventId) return;
    const minute = Math.min(
      range.endMinute - SNAP_MINUTES,
      snappedMinute(event.clientY, event.currentTarget, range)
    );
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ dayIndex, startMinute: minute, endMinute: minute + 30 });
  }

  function updateSelection(event: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (!selection || selection.dayIndex !== dayIndex) return;
    setSelection({ ...selection, endMinute: snappedMinute(event.clientY, event.currentTarget, range) });
  }

  function finishSelection(event: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (!selection || selection.dayIndex !== dayIndex) return;
    const pointerMinute = snappedMinute(event.clientY, event.currentTarget, range);
    const start = calendarGridClampMinute(Math.min(selection.startMinute, pointerMinute), range);
    const end = calendarGridClampMinute(Math.max(selection.startMinute, pointerMinute), range);
    setSelection(null);
    onCreateRange(days[dayIndex], start, Math.min(range.endMinute, Math.max(start + 30, end)));
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
      calendarGridMinuteAt(event.clientY, state.gridTop, state.gridHeight, range, SNAP_MINUTES)
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
        <div className="flex items-center justify-center gap-0.5 px-1">
          <button
            type="button"
            aria-label="Show configured workday"
            title="Configured workday"
            onClick={() => setGridMode("work")}
            className={`flex h-6 w-5 items-center justify-center rounded transition ${gridMode === "work" ? "bg-purple-500 text-white" : "text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"}`}
          >
            <BriefcaseBusiness className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Show full 24-hour day"
            title="Full 24-hour day"
            onClick={() => setGridMode("full")}
            className={`flex h-6 w-5 items-center justify-center rounded transition ${gridMode === "full" ? "bg-purple-500 text-white" : "text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"}`}
          >
            <Clock3 className="h-3 w-3" />
          </button>
        </div>
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const today = calendarDateKey(new Date(), timeZone) === dayKey;
          const selected = isSameDay(day, selectedDay);
          const allDayEvents = events.filter((event) => event.allDay && calendarIntervalSegment(event.startAt, event.endAt, dayKey, timeZone));
          const schedule = workHours.find((item) => item.dayOfWeek === day.getDay());
          const offHoursCount = events.filter((event) => {
            if (event.allDay) return false;
            const segment = calendarIntervalSegment(event.startAt, event.endAt, dayKey, timeZone);
            return segment && (segment.startMinute < range.startMinute || segment.endMinute > range.endMinute);
          }).length;
          return (
            <div
              key={day.toISOString()}
              className={`min-w-0 border-l border-zinc-800 px-1 py-1.5 text-center transition ${selected ? "bg-purple-500/8" : "hover:bg-zinc-900"}`}
            >
              <button type="button" onClick={() => onSelectDay(day)} className="w-full min-w-0">
                <div className="text-[10px] font-medium uppercase text-zinc-500">{format(day, "EEE")}</div>
                <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${today ? "bg-purple-500 text-white" : "text-zinc-200"}`}>
                  {format(day, "d")}
                </div>
                {allDayEvents.slice(0, 1).map((event) => (
                  <div key={event.id} className="mt-1 truncate rounded px-1 py-0.5 text-[9px] text-white" style={{ background: event.color ?? "#7c3aed" }}>
                    {event.title}
                  </div>
                ))}
                {allDayEvents.length > 1 && <div className="mt-0.5 truncate text-[9px] text-zinc-500">+{allDayEvents.length - 1} all-day</div>}
              </button>
              <div className="mt-0.5 flex min-h-3 items-center justify-center gap-1 text-[9px]">
                {schedule?.enabled === false && <span className="truncate text-zinc-600">Off</span>}
                {gridMode === "work" && offHoursCount > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setGridMode("full");
                    }}
                    className="max-w-full truncate rounded bg-purple-500/15 px-1 text-purple-300 hover:bg-purple-500/25"
                    title="Show events outside the compact workday"
                  >
                    {offHoursCount} {view === "day" ? "off-hours" : "off"}
                  </button>
                )}
              </div>
            </div>
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
          const dayEvents = events.filter((event) => {
            const segment = eventSegments.get(event.id);
            return segment && segment.endMinute > range.startMinute && segment.startMinute < range.endMinute;
          });
          const positionedEvents = layoutCalendarEvents(dayEvents);
          const sessionSegments = new Map(
            sessions
              .filter((session) => !session.calendarEventId && session.actualStart)
              .map((session) => [
                session.id,
                calendarIntervalSegment(session.actualStart!, session.actualEnd ?? new Date(), dayKey, timeZone),
              ] as const)
              .filter((entry): entry is readonly [string, CalendarDaySegment] => Boolean(entry[1]))
          );
          const unlinkedSessions = sessions.filter((session) => {
            const segment = sessionSegments.get(session.id);
            return !session.calendarEventId && segment && segment.endMinute > range.startMinute && segment.startMinute < range.endMinute;
          });
          const selectedRange = selection?.dayIndex === dayIndex ? {
            start: Math.min(selection.startMinute, selection.endMinute),
            end: Math.max(selection.startMinute, selection.endMinute),
          } : null;
          const isToday = calendarDateKey(new Date(), timeZone) === dayKey;
          const currentMinute = calendarMinuteOfDay(new Date(), timeZone);
          const schedule = workHours.find((item) => item.dayOfWeek === day.getDay());
          const scheduleStart = schedule?.enabled ? Math.max(range.startMinute, schedule.startMinute) : range.startMinute;
          const scheduleEnd = schedule?.enabled ? Math.min(range.endMinute, schedule.endMinute) : range.startMinute;
          const topShade = ((scheduleStart - range.startMinute) / range.totalMinutes) * 100;
          const bottomShade = ((range.endMinute - scheduleEnd) / range.totalMinutes) * 100;

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
                if (calendarEvent) onMoveEvent(calendarEvent, day, snappedMinute(event.clientY, event.currentTarget, range));
              }}
            >
              {schedule?.enabled ? (
                <>
                  {topShade > 0 && <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] bg-zinc-950/75" style={{ height: `${topShade}%` }} />}
                  {scheduleEnd > scheduleStart && <div className="pointer-events-none absolute inset-x-0 z-[1] bg-purple-500/[0.018]" style={{ top: `${topShade}%`, height: `${100 - topShade - bottomShade}%` }} />}
                  {bottomShade > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-zinc-950/75" style={{ height: `${bottomShade}%` }} />}
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 z-[1] bg-zinc-950/80" />
              )}
              {hours.map((hour, index) => (
                <div key={hour} className="pointer-events-none absolute left-0 right-0 z-[2] border-t border-zinc-900" style={{ top: `${(index / (hours.length - 1)) * 100}%` }} />
              ))}

              {selectedRange && (
                <div
                  className="pointer-events-none absolute left-1 right-1 z-30 rounded border border-purple-400 bg-purple-500/20 shadow-[0_0_24px_rgba(168,85,247,0.18)]"
                  style={blockStyle(selectedRange.start, selectedRange.end, range)}
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
                      const nextStart = Math.max(range.startMinute, Math.min(range.endMinute - durationMinutes, startMinute + direction * SNAP_MINUTES));
                      onMoveEvent(calendarEvent, day, nextStart);
                    }}
                    className="absolute z-10 min-w-0 cursor-grab overflow-hidden rounded border px-1.5 py-1 text-left text-white shadow-lg transition-[filter,box-shadow] hover:z-30 hover:brightness-110 active:cursor-grabbing"
                    style={{
                      ...blockStyle(startMinute, endMinute, range),
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
                const segment = sessionSegments.get(session.id)!;
                const colors = sessionColor(session.type);
                return (
                  <div
                    key={session.id}
                    className="pointer-events-none absolute left-[12%] right-1 z-20 overflow-hidden rounded border-l-2 px-1.5 py-1 backdrop-blur-sm"
                    style={{
                      ...blockStyle(segment.startMinute, segment.endMinute, range),
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

              {isToday && currentMinute >= range.startMinute && currentMinute <= range.endMinute && (
                <div className="pointer-events-none absolute left-0 right-0 z-40 flex items-center" style={{ top: `${((currentMinute - range.startMinute) / range.totalMinutes) * 100}%` }}>
                  <span className="-ml-1 h-2 w-2 animate-pulse rounded-full bg-rose-400" />
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
