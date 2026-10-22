"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface RangeOption<T extends string> {
  value: T;
  label: string;
}

/** Single-choice dropdown in the Samaritan button style. */
export default function RangeMenu<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: RangeOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-[110]">
      <button
        type="button"
        className="sam-button min-w-[11rem] justify-between"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label}: ${selected.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className="samaritan-card sam-ui absolute right-0 z-[120] mt-1 w-full min-w-[11rem] py-1">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-raised ${
                  active ? "text-signal" : "text-key hover:text-trace"
                }`}
              >
                <span aria-hidden className={active ? "sam-triangle-right" : "inline-block w-[6px]"} />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
