import type { Response } from "express";
import { InvalidRequestError } from "./time";

// Local user ids are UUIDs; verification scripts use readable slugs. Anything
// outside this alphabet is garbage and never reaches Prisma.
const USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const INTEGER_PATTERN = /^[+-]?\d+(\.\d+)?$/;

export function parseUserId(value: unknown): string {
  if (value === undefined || value === null || value === "") throw new InvalidRequestError("Missing userId");
  if (typeof value !== "string" || !USER_ID_PATTERN.test(value)) throw new InvalidRequestError("Invalid userId");
  return value;
}

/**
 * Parse an integer query parameter. Missing values use `fallback`; non-numeric
 * values are rejected; numeric values are floored and clamped to [min, max].
 */
export function parseIntegerParam(
  value: unknown,
  options: { name: string; min: number; max: number; fallback: number }
): number {
  if (value === undefined || value === null || value === "") return options.fallback;
  if (typeof value !== "string" || !INTEGER_PATTERN.test(value.trim())) {
    throw new InvalidRequestError(`Invalid ${options.name}: expected a number`);
  }
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) throw new InvalidRequestError(`Invalid ${options.name}: expected a number`);
  return Math.min(options.max, Math.max(options.min, parsed));
}

/** Parse an optional enum query parameter; unknown values are rejected. */
export function parseEnumParam<T extends string>(
  value: unknown,
  options: { name: string; allowed: readonly T[]; fallback: T }
): T;
export function parseEnumParam<T extends string>(
  value: unknown,
  options: { name: string; allowed: readonly T[]; fallback?: undefined }
): T | undefined;
export function parseEnumParam<T extends string>(
  value: unknown,
  options: { name: string; allowed: readonly T[]; fallback?: T }
): T | undefined {
  if (value === undefined || value === null || value === "") return options.fallback;
  if (typeof value !== "string" || !(options.allowed as readonly string[]).includes(value)) {
    throw new InvalidRequestError(`Invalid ${options.name}: expected one of ${options.allowed.join(", ")}`);
  }
  return value as T;
}

/** Send a JSON error: 400 for invalid input, 500 (logged) for everything else. */
export function sendRouteError(res: Response, error: unknown, fallback: string, logLabel?: string) {
  if (error instanceof InvalidRequestError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(logLabel ?? fallback, error);
  return res.status(500).json({ error: fallback });
}
