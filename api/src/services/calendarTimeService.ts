import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { isValidDateKey } from "../utils/time";

dayjs.extend(utc);
dayjs.extend(timezone);

export function normalizeCalendarTimezone(value: unknown, fallback = "Asia/Kolkata") {
  const zone = typeof value === "string" && value.trim() ? value.trim() : fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    throw new Error(`Invalid calendar timezone: ${zone}`);
  }
}

const DATE_TIME_LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const DATE_TIME_OFFSET_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse a calendar date input in the account timezone. Accepts YYYY-MM-DD
 * (start or end of that local day), ISO datetimes with an offset, and
 * datetime-local strings. Malformed or impossible dates (2026-13-45,
 * 2026-02-30, "abc") return undefined instead of rolling over or throwing.
 */
export function parseCalendarDate(value: unknown, timeZone: string, endOfDay = false) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;

  const zone = normalizeCalendarTimezone(timeZone);
  const input = value.trim();

  try {
    let parsed: dayjs.Dayjs;
    if (isValidDateKey(input)) {
      parsed = dayjs.tz(input, zone);
      parsed = endOfDay ? parsed.endOf("day") : parsed.startOf("day");
    } else if (DATE_TIME_OFFSET_PATTERN.test(input)) {
      if (!isValidDateKey(DATE_TIME_OFFSET_PATTERN.exec(input)![1])) return undefined;
      parsed = dayjs(input);
    } else if (DATE_TIME_LOCAL_PATTERN.test(input)) {
      if (!isValidDateKey(DATE_TIME_LOCAL_PATTERN.exec(input)![1])) return undefined;
      // datetime-local inputs have no offset, so interpret them in the account timezone.
      parsed = dayjs.tz(input, zone);
    } else {
      return undefined;
    }
    return parsed.isValid() ? parsed.toDate() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeAllDayCalendarRange(startValue: unknown, endValue: unknown, timeZone: string) {
  const zone = normalizeCalendarTimezone(timeZone);
  const parsedStart = parseCalendarDate(startValue, zone);
  const parsedEnd = parseCalendarDate(endValue, zone);
  if (!parsedStart || !parsedEnd) return undefined;

  const startAt = dayjs(parsedStart).tz(zone).startOf("day");
  let endAt = dayjs(parsedEnd).tz(zone).startOf("day");
  if (!endAt.isAfter(startAt)) {
    const nextDate = startAt.add(1, "day").format("YYYY-MM-DD");
    endAt = dayjs.tz(nextDate, zone).startOf("day");
  }
  return { startAt: startAt.toDate(), endAt: endAt.toDate() };
}

/**
 * Tracked duration of a calendar session inside [from, to]. Active sessions
 * run until `now`; finished sessions are clipped to the range, scaling the
 * recorded duration by the share of the session span that falls inside it.
 */
export function calendarSessionDurationInRange(
  session: { status: string; actualStart: Date | null; actualEnd: Date | null; actualDurationMs: number },
  from: Date,
  to: Date,
  now = new Date()
) {
  if (session.status === "active" && session.actualStart) {
    return Math.max(0, Math.min(now.getTime(), to.getTime()) - Math.max(session.actualStart.getTime(), from.getTime()));
  }
  if (session.actualStart && session.actualEnd) {
    const spanMs = session.actualEnd.getTime() - session.actualStart.getTime();
    if (spanMs <= 0) return 0;
    const insideMs = Math.max(0, Math.min(session.actualEnd.getTime(), to.getTime()) - Math.max(session.actualStart.getTime(), from.getTime()));
    const recordedMs = session.actualDurationMs > 0 ? Math.min(session.actualDurationMs, spanMs) : spanMs;
    return Math.round(recordedMs * (insideMs / spanMs));
  }
  return Math.max(0, session.actualDurationMs || 0);
}
