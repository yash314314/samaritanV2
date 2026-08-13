import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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

export function parseCalendarDate(value: unknown, timeZone: string, endOfDay = false) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;

  const zone = normalizeCalendarTimezone(timeZone);
  const input = value.trim();
  let parsed: dayjs.Dayjs;

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    parsed = dayjs.tz(input, zone);
    parsed = endOfDay ? parsed.endOf("day") : parsed.startOf("day");
  } else if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)) {
    parsed = dayjs(input);
  } else {
    // datetime-local inputs have no offset, so interpret them in the account timezone.
    parsed = dayjs.tz(input, zone);
  }

  return parsed.isValid() ? parsed.toDate() : undefined;
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
