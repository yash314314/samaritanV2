"use client";

import { forwardRef, useState } from "react";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
// Bounds keep the year segment at four digits while typing.
const EARLIEST = "2000-01-01";
const LATEST = "2100-12-31";

/**
 * Native date field that speaks `yyyy-MM-dd` strings in and out.
 *
 * It keeps its own draft while the user types: a half-typed year such as
 * "0002" is already a valid date to the browser, and echoing it back through
 * the parent (or through `new Date`, which maps years below 100 to 19xx)
 * would reset the field under the cursor. Only complete dates inside the
 * bounds reach the parent; clearing the field reports "".
 */
export const ThemedDatePicker = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    min?: string;
    max?: string;
  }
>(({ value, onChange, placeholder, min, max }, ref) => {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  // A new value from the parent (form reset, edit dialog) replaces the draft.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  return (
    <input
      type="date"
      ref={ref}
      value={draft}
      min={min || EARLIEST}
      max={max || LATEST}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (next === "") onChange("");
        else if (DATE_KEY.test(next) && next >= EARLIEST && next <= LATEST) onChange(next);
      }}
      className="h-10 w-full rounded-none border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-red-500/50 [color-scheme:dark]"
    />
  );
});

ThemedDatePicker.displayName = "ThemedDatePicker";
