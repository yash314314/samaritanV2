"use client";

import { forwardRef } from "react";

export const ThemedDatePicker = forwardRef<
  HTMLInputElement,
  {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholder?: string;
  }
>(({ selected, onChange, placeholder }, ref) => {
  const value = selected && !isNaN(selected.getTime()) ? selected.toISOString().slice(0, 10) : "";

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
      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-purple-500/50 [color-scheme:dark]"
    />
  );
});

ThemedDatePicker.displayName = "ThemedDatePicker";
