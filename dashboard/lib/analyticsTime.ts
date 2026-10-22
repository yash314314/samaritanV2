// Time helpers for the analytics views. Samaritan reports in IST (UTC+05:30,
// no daylight saving), so hour and day boundaries are computed with a fixed
// offset rather than the browser's zone.

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of the IST calendar day containing `date`. */
export function istDateKey(date: Date | string | number = new Date()): string {
  const time = new Date(date).getTime();
  return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hour of day (0-23) in IST. */
export function istHour(date: Date | string | number): number {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).getUTCHours();
}

/** Shift a YYYY-MM-DD key by whole days. */
export function addDaysToKey(key: string, days: number): string {
  const base = new Date(`${key}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Every YYYY-MM-DD key from `from` to `to`, inclusive. */
export function dateKeysBetween(from: string, to: string): string[] {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) return [];
  const keys: string[] = [];
  for (let key = from; key <= to && keys.length < 400; key = addDaysToKey(key, 1)) keys.push(key);
  return keys;
}

/** Epoch ms at which the IST hour `hour` of day `key` starts. */
export function istHourStart(key: string, hour: number): number {
  return new Date(`${key}T00:00:00Z`).getTime() - IST_OFFSET_MS + hour * HOUR_MS;
}

/** "Thu 22 Oct" for a YYYY-MM-DD key. */
export function formatDayKey(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "22 Oct" for a YYYY-MM-DD key. */
export function formatShortDayKey(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

/** HH:MM:SS in IST. */
export function formatTimeIST(date: Date | string): string {
  const ist = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(11, 19);
}

/** "HH:00" for an hour of day. */
export function formatHour(hour: number): string {
  return `${String(((hour % 24) + 24) % 24).padStart(2, "0")}:00`;
}

/** "1h 05m 09s" / "05m 09s". */
export function formatHMS(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts = h > 0 ? [`${h}h`] : [];
  parts.push(`${String(m).padStart(2, "0")}m`, `${String(s).padStart(2, "0")}s`);
  return parts.join(" ");
}

/** "6h 41m" / "41m" / "<1m". */
export function formatShortDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  if (totalSeconds > 0 && totalSeconds < 60) return "<1m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
