type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

function zonedParts(value: string | Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

export function calendarDateKey(value: string | Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function calendarMinuteOfDay(value: string | Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function calendarInputDateTime(value: string | Date | null, timeZone: string) {
  if (!value) return "";
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function calendarTimeLabel(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function floatingCalendarDateTime(day: Date, minute: number) {
  const base = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  const value = new Date(base + minute * 60_000);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const date = String(value.getUTCDate()).padStart(2, "0");
  const hour = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${date}T${hour}:${minutes}`;
}

export type CalendarDaySegment = {
  startMinute: number;
  endMinute: number;
  startsHere: boolean;
  endsHere: boolean;
};

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function calendarIntervalSegment(
  startAt: string | Date,
  endAt: string | Date,
  dayKey: string,
  timeZone: string
): CalendarDaySegment | null {
  const startKey = calendarDateKey(startAt, timeZone);
  const endKey = calendarDateKey(endAt, timeZone);
  const startMinute = calendarMinuteOfDay(startAt, timeZone);
  const endMinute = calendarMinuteOfDay(endAt, timeZone);
  const endsAtMidnight = endMinute === 0;

  if (dayKey < startKey || dayKey > endKey) return null;
  if (dayKey === endKey && endsAtMidnight && dayKey !== startKey) return null;

  const segmentStart = dayKey === startKey ? startMinute : 0;
  const segmentEnd = dayKey === endKey ? endMinute : 24 * 60;
  if (segmentEnd <= segmentStart) return null;

  return {
    startMinute: segmentStart,
    endMinute: segmentEnd,
    startsHere: dayKey === startKey,
    endsHere: dayKey === endKey || (endsAtMidnight && nextDateKey(dayKey) === endKey),
  };
}
