"use client";

import { useState, type InputHTMLAttributes } from "react";

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Round committed values to whole numbers. */
  integer?: boolean;
};

/**
 * A number field that can be cleared and retyped. The text is kept as a
 * draft; any complete in-range number is reported straight away, and leaving
 * the field clamps an out-of-range entry or restores the last good value.
 * Coercing every keystroke with Number() snapped an emptied field to 0 and
 * swallowed half-typed decimals such as "1.".
 */
export default function NumberInput({ value, onValueChange, min, max, integer = false, onBlur, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (Number(draft) !== value) setDraft(String(value));
  }

  const inRange = (n: number) => (min === undefined || n >= min) && (max === undefined || n <= max);
  const normalise = (n: number) => (integer ? Math.round(n) : n);

  return (
    <input
      {...rest}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = Number(text);
        if (text.trim() !== "" && Number.isFinite(parsed) && inRange(parsed)) {
          const next = normalise(parsed);
          setSyncedValue(next);
          if (next !== value) onValueChange(next);
        }
      }}
      onBlur={(event) => {
        const parsed = Number(draft);
        let next = draft.trim() !== "" && Number.isFinite(parsed) ? normalise(parsed) : value;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        setDraft(String(next));
        setSyncedValue(next);
        if (next !== value) onValueChange(next);
        onBlur?.(event);
      }}
    />
  );
}
