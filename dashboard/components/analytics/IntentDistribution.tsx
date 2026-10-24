"use client";

import { useMemo } from "react";
import type { IntentShare } from "./types";

const MAX_ROWS = 8;
const TIME_COLOR = "var(--sam-series-1)";
// Slot 4 stays clearly apart from series 1 (signal ink) in every palette.
const FOCUS_COLOR = "var(--sam-series-4)";

function label(intent: string) {
  const text = intent.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clampPct(value: number) {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function Meter({ value, color, label: name, thin = false }: { value: number; color: string; label: string; thin?: boolean }) {
  return (
    <div
      className={`${thin ? "h-[3px]" : "h-[5px]"} w-full bg-track`}
      role="meter"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <div className="sam-fill h-full" style={{ width: `${clampPct(value)}%`, backgroundColor: color }} />
    </div>
  );
}

/**
 * Where active time went by intent, with the average focus reached in each.
 * Idle is not an intent of work: it is taken out and the shares are
 * re-based on active time, so a long idle stretch cannot flatten the rest.
 */
export default function IntentDistribution({ intents }: { intents: IntentShare[] }) {
  const { rows, idleShare, hidden } = useMemo(() => {
    const idle = intents.find((entry) => entry.intent === "idle");
    const idleShare = idle ? clampPct(idle.percentage) : 0;
    const activeBase = 100 - idleShare;
    const active = intents
      .filter((entry) => entry.intent !== "idle" && entry.percentage > 0)
      .map((entry) => ({
        intent: entry.intent,
        share: activeBase > 0 ? clampPct((entry.percentage / activeBase) * 100) : 0,
        avgFocus: clampPct(entry.avgFocus),
      }))
      .sort((left, right) => right.share - left.share);
    return { rows: active.slice(0, MAX_ROWS), idleShare, hidden: active.slice(MAX_ROWS) };
  }, [intents]);

  if (rows.length === 0) {
    return <p className="flex flex-1 items-center justify-center text-[12px] text-key">No active time with a detected intent in this range.</p>;
  }

  const hiddenShare = hidden.reduce((sum, row) => sum + row.share, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-key">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-[5px] w-3" style={{ backgroundColor: TIME_COLOR }} />
          Share of active time
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-3" style={{ backgroundColor: FOCUS_COLOR }} />
          Average focus
        </span>
      </div>
      <ul className="dashboard-scroll-panel min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {rows.map((row) => (
          <li key={row.intent} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-x-3">
            <span className="truncate text-[12px] text-trace" title={label(row.intent)}>
              {label(row.intent)}
            </span>
            <div className="space-y-1">
              <Meter value={row.share} color={TIME_COLOR} label={`${label(row.intent)}: share of active time`} />
              <Meter value={row.avgFocus} color={FOCUS_COLOR} label={`${label(row.intent)}: average focus`} thin />
            </div>
            <div className="text-right text-[11px] leading-[1.15] tabular-nums">
              <span className="block text-signal">{row.share < 1 ? "<1" : Math.round(row.share)}%</span>
              <span className="block text-key">{Math.round(row.avgFocus)}</span>
            </div>
          </li>
        ))}
      </ul>
      {(idleShare > 0 || hidden.length > 0) && (
        <p className="mt-3 border-t border-grid pt-2 text-[11px] text-key">
          {idleShare > 0 && `Idle ${Math.round(idleShare)}% of tracked time, excluded. `}
          {hidden.length > 0 && `${hidden.length} smaller ${hidden.length === 1 ? "intent" : "intents"} (${Math.max(1, Math.round(hiddenShare))}%) not shown.`}
        </p>
      )}
    </div>
  );
}
