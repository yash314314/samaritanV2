/**
 * Shared IST (Asia/Kolkata, UTC+05:30) date helpers.
 *
 * Every day/hour boundary used by the analytics endpoints is computed here
 * explicitly in IST so results never depend on the host TZ of the API process.
 * IST has no DST, so a fixed offset is exact.
 */

export const IST_TIMEZONE = "Asia/Kolkata";
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const MAX_RANGE_DAYS = 366;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Raised for malformed client input; routes map it to HTTP 400. */
export class InvalidRequestError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

export type ISTDateRange = {
  /** Inclusive start instant (IST midnight of `from`). */
  start: Date;
  /** Exclusive end instant (IST midnight after `to`). */
  end: Date;
  /** First IST calendar day, YYYY-MM-DD. */
  from: string;
  /** Last IST calendar day (inclusive), YYYY-MM-DD. */
  to: string;
  days: number;
};

/** True when the value is a real calendar date written as YYYY-MM-DD. */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function parseDateKey(value: unknown, name = "date"): string {
  if (!isValidDateKey(value)) {
    throw new InvalidRequestError(`Invalid ${name}: expected a real calendar date as YYYY-MM-DD`);
  }
  return value;
}

/** IST calendar day (YYYY-MM-DD) that contains the instant. */
export function toISTDateKey(date: Date | number): string {
  const ms = typeof date === "number" ? date : date.getTime();
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant of IST midnight that starts the given day. */
export function istDayStart(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  return toISTDateKey(istDayStart(dateKey).getTime() + days * DAY_MS);
}

/** Whole IST days from `fromKey` to `toKey` (0 when equal, negative when reversed). */
export function dateKeyDiffDays(fromKey: string, toKey: string): number {
  return Math.round((istDayStart(toKey).getTime() - istDayStart(fromKey).getTime()) / DAY_MS);
}

/** Hour of day (0-23) in IST. */
export function getISTHour(date: Date | number): number {
  const ms = typeof date === "number" ? date : date.getTime();
  return new Date(ms + IST_OFFSET_MS).getUTCHours();
}

/** Hour of day in IST including the minute fraction, e.g. 21.5 for 21:30. */
export function getISTHourFraction(date: Date | number): number {
  const ms = typeof date === "number" ? date : date.getTime();
  const ist = new Date(ms + IST_OFFSET_MS);
  return ist.getUTCHours() + ist.getUTCMinutes() / 60;
}

/** First instant of the IST hour after `ms`. */
export function nextISTHourBoundary(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / HOUR_MS) * HOUR_MS + HOUR_MS - IST_OFFSET_MS;
}

/** IST day that contains `date` (default: now) as a half-open [start, end) range. */
export function getISTDayRange(date?: Date) {
  const base = date ? new Date(date) : new Date();
  if (Number.isNaN(base.getTime())) throw new InvalidRequestError("Invalid date");
  const start = istDayStart(toISTDateKey(base));
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

export function buildISTDateRange(fromKey: string, toKey: string): ISTDateRange {
  const start = istDayStart(fromKey);
  const end = istDayStart(addDaysToDateKey(toKey, 1));
  return { start, end, from: fromKey, to: toKey, days: dateKeyDiffDays(fromKey, toKey) + 1 };
}

/** The `days` IST calendar days ending on `toKey` (default: today in IST), inclusive. */
export function lastISTDays(days: number, toKey = toISTDateKey(new Date())): ISTDateRange {
  const safeDays = Math.max(1, Math.floor(days));
  return buildISTDateRange(addDaysToDateKey(toKey, -(safeDays - 1)), toKey);
}

function singleQueryValue(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new InvalidRequestError(`Invalid ${name}: pass a single value`);
  return value.trim() || undefined;
}

/**
 * Resolve the `date` or inclusive `from`/`to` query parameters (IST calendar days)
 * into a half-open instant range. `from`/`to` win over `date`; a lone `from` or `to`
 * means that single day. Without any of them the range is today (IST) unless
 * `required` is set.
 */
export function resolveISTDateRange(
  query: { date?: unknown; from?: unknown; to?: unknown },
  options: { maxDays?: number; required?: boolean; now?: Date } = {}
): ISTDateRange {
  const maxDays = options.maxDays ?? MAX_RANGE_DAYS;
  const date = singleQueryValue(query.date, "date");
  const from = singleQueryValue(query.from, "from");
  const to = singleQueryValue(query.to, "to");

  let fromKey: string;
  let toKey: string;
  if (from || to) {
    fromKey = parseDateKey(from ?? to, from ? "from" : "to");
    toKey = parseDateKey(to ?? from, to ? "to" : "from");
  } else if (date) {
    fromKey = toKey = parseDateKey(date, "date");
  } else if (options.required) {
    throw new InvalidRequestError("Missing date (YYYY-MM-DD) or from/to range");
  } else {
    fromKey = toKey = toISTDateKey(options.now ?? new Date());
  }

  if (fromKey > toKey) throw new InvalidRequestError("Invalid range: from must not be after to");
  const range = buildISTDateRange(fromKey, toKey);
  if (range.days > maxDays) {
    throw new InvalidRequestError(`Range too large: ${range.days} days requested, maximum is ${maxDays}`);
  }
  return range;
}

/** Milliseconds of [start, end) that fall inside [rangeStart, rangeEnd). */
export function overlapMs(startMs: number, endMs: number, rangeStartMs: number, rangeEndMs: number): number {
  return Math.max(0, Math.min(endMs, rangeEndMs) - Math.max(startMs, rangeStartMs));
}
