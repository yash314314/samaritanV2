export type CalendarGridMode = "work" | "full";

export type CalendarGridWorkHour = {
  dayOfWeek: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

export type CalendarGridRange = {
  startMinute: number;
  endMinute: number;
  totalMinutes: number;
};

const DAY_MINUTES = 24 * 60;
const DEFAULT_START_MINUTE = 8 * 60;
const DEFAULT_END_MINUTE = 19 * 60;

export function calendarGridRange(workHours: CalendarGridWorkHour[], mode: CalendarGridMode): CalendarGridRange {
  if (mode === "full") {
    return { startMinute: 0, endMinute: DAY_MINUTES, totalMinutes: DAY_MINUTES };
  }

  const enabled = workHours.filter((item) => item.enabled && item.endMinute > item.startMinute);
  if (!enabled.length) {
    return {
      startMinute: DEFAULT_START_MINUTE,
      endMinute: DEFAULT_END_MINUTE,
      totalMinutes: DEFAULT_END_MINUTE - DEFAULT_START_MINUTE,
    };
  }

  const earliestStart = Math.min(...enabled.map((item) => item.startMinute));
  const latestEnd = Math.max(...enabled.map((item) => item.endMinute));
  const startMinute = Math.max(0, Math.floor((earliestStart - 60) / 60) * 60);
  const endMinute = Math.min(DAY_MINUTES, Math.ceil((latestEnd + 60) / 60) * 60);
  return { startMinute, endMinute, totalMinutes: endMinute - startMinute };
}

export function calendarGridClampMinute(minute: number, range: CalendarGridRange) {
  return Math.max(range.startMinute, Math.min(range.endMinute, minute));
}

export function calendarGridMinuteAt(
  clientY: number,
  top: number,
  height: number,
  range: CalendarGridRange,
  snapMinutes = 15
) {
  const relative = Math.max(0, Math.min(height, clientY - top));
  const raw = range.startMinute + (relative / Math.max(1, height)) * range.totalMinutes;
  return calendarGridClampMinute(Math.round(raw / snapMinutes) * snapMinutes, range);
}

export function calendarGridBlock(startMinute: number, endMinute: number, range: CalendarGridRange) {
  const start = calendarGridClampMinute(startMinute, range);
  const end = calendarGridClampMinute(endMinute, range);
  return {
    visible: endMinute > range.startMinute && startMinute < range.endMinute,
    top: ((start - range.startMinute) / range.totalMinutes) * 100,
    height: Math.max(1.2, ((end - start) / range.totalMinutes) * 100),
  };
}

