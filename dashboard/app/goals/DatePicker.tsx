"use client";

import { forwardRef } from "react";
import { format } from "date-fns";

export const ThemedDatePicker = forwardRef<
  HTMLInputElement,
  {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholder?: string;
  }
>(({ selected, onChange, placeholder }, ref) => {
  // Local date parts: the picker hands back local midnight, which is the
  // previous day in UTC for IST users.
  const value = selected && !isNaN(selected.getTime()) ? format(selected, "yyyy-MM-dd") : "";

  return (
    <input
      type="date"
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const val = e.target.value;
        if (!val) {
          onChange(null);
        } else {
          const [year, month, day] = val.split("-").map(Number);
          onChange(new Date(year, month - 1, day));
        }
      }}
      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-red-500/50 [color-scheme:dark]"
    />
  );
});

ThemedDatePicker.displayName = "ThemedDatePicker";
