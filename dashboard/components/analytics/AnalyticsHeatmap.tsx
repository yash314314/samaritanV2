"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import AppCategoryTags from "@/components/AppCategoryTags";
import { formatCategory, getCategoryColor } from "@/lib/categoryColors";
import {
  HOUR_MS,
  dateKeysBetween,
  formatDayKey,
  formatHMS,
  formatHour,
  formatShortDayKey,
  istHourStart,
} from "@/lib/analyticsTime";
import { SessionList, sessionsInWindow } from "./HourlyBreakdown";
import type { HeatmapBucket, HeatmapResponse, TimelineSession } from "./types";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// Luminance ramp: brightness is the score. The zinc scale is remapped to the
// theme's ink/void mix in globals.css, so it inverts with light themes.
const RAMP = ["bg-zinc-900", "bg-zinc-800", "bg-zinc-700", "bg-zinc-600", "bg-zinc-500", "bg-zinc-400", "bg-zinc-300", "bg-zinc-200", "bg-zinc-100", "bg-zinc-50"];
const TOOLTIP_WIDTH = 340;
const VIEWPORT_MARGIN = 8;

export const EMPTY_HEATMAP_BUCKET: HeatmapBucket = {
  score: 0,
  productivity: 0,
  duration: 0,
  trackedMinutes: 0,
  idleMinutes: 0,
  dominantApp: null,
  dominantCategory: null,
  dominantIntent: null,
  topApps: [],
  categoryBreakdown: [],
  intentBreakdown: [],
};

export interface HeatmapSelection {
  date: string;
  hour: number;
}

const hasActivity = (bucket?: HeatmapBucket) => Boolean(bucket && Number(bucket.duration) > 0);
const round = (value: number, digits = 0) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-void px-3 py-2">
      <p className="sam-key">{label}</p>
      <p className="mt-0.5 truncate text-[13px] tabular-nums text-signal">{value}</p>
    </div>
  );
}

function CategoryRows({ bucket }: { bucket: HeatmapBucket }) {
  return (
    <ul className="space-y-1.5">
      {bucket.categoryBreakdown.map((category) => (
        <li key={category.name} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3rem] items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-trace">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: getCategoryColor(category.name) }} />
            <span className="truncate capitalize">{formatCategory(category.name)}</span>
          </span>
          <span className="h-[3px] bg-track">
            <span className="block h-full" style={{ width: `${Math.min(100, Math.max(0, category.percentage))}%`, backgroundColor: getCategoryColor(category.name) }} />
          </span>
          <span className="text-right text-[11px] tabular-nums text-key">{category.minutes}m</span>
        </li>
      ))}
    </ul>
  );
}

function HourTooltip({ date, hour, bucket }: HeatmapSelection & { bucket: HeatmapBucket }) {
  return (
    <div className="samaritan-card sam-ui p-3" style={{ width: TOOLTIP_WIDTH }}>
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-grid pb-2">
        <div>
          <p className="sam-key">{formatDayKey(date)}</p>
          <p className="sam-head mt-1">
            {formatHour(hour)}–{formatHour(hour + 1)} IST
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] tabular-nums text-signal">{formatHMS(bucket.duration / 1000)}</p>
          <p className="text-[10px] text-key">{bucket.topApps?.length ?? 0} apps</p>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-px border border-grid bg-grid">
        <Readout label="Score" value={String(round(bucket.score, 2))} />
        <Readout label="Productive" value={`${round(bucket.productivity)}%`} />
        <Readout label="Idle" value={`${round(bucket.idleMinutes, 1)}m`} />
      </div>
      {bucket.categoryBreakdown?.length > 0 && (
        <div className="mb-3">
          <p className="sam-key mb-1.5">Categories</p>
          <CategoryRows bucket={bucket} />
        </div>
      )}
      {bucket.topApps?.length > 0 && (
        <div>
          <p className="sam-key mb-1.5">Top apps</p>
          <ul className="space-y-1">
            {bucket.topApps.slice(0, 4).map((app) => (
              <li key={app.name} className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-trace">{app.name}</p>
                  <AppCategoryTags app={app} />
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-key">{app.minutes}m</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 border-t border-grid pt-2 text-[10px] text-key">Select the cell for the full activity log.</p>
    </div>
  );
}

export function HeatmapGrid({
  data,
  from,
  to,
  onSelect,
}: {
  data: HeatmapResponse;
  from: string;
  to: string;
  onSelect: (selection: HeatmapSelection) => void;
}) {
  // Rows run from the first tracked day in the range to its last day, so gaps
  // between tracked days show as empty rows instead of disappearing.
  const dates = useMemo(() => {
    const tracked = Object.keys(data)
      .filter((date) => date >= from && date <= to && HOURS.some((hour) => hasActivity(data[date]?.[hour])))
      .sort();
    return tracked.length ? dateKeysBetween(tracked[0], to) : [];
  }, [data, from, to]);

  const { minScore, maxScore } = useMemo(() => {
    const scores = dates.flatMap((date) =>
      HOURS.map((hour) => data[date]?.[hour]).filter(hasActivity).map((bucket) => bucket!.score)
    );
    if (scores.length === 0) return { minScore: 0, maxScore: 1 };
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    return min === max ? { minScore: Math.min(0, min), maxScore: Math.max(max, 1) } : { minScore: min, maxScore: max };
  }, [data, dates]);

  const [hovered, setHovered] = useState<(HeatmapSelection & { bucket: HeatmapBucket; x: number; y: number }) | null>(null);

  const rampClass = (score: number) => {
    const normalized = maxScore > minScore ? (score - minScore) / (maxScore - minScore) : 0;
    return RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(normalized * (RAMP.length - 1))))];
  };

  if (dates.length === 0) {
    return <p className="py-10 text-center text-[12px] text-key">No tracked activity in this range.</p>;
  }

  // Placed after layout from the tooltip's real size: above the pointer when
  // it fits, otherwise below, and always inside the viewport.
  const placeTooltip = (node: HTMLDivElement | null) => {
    if (!node || !hovered) return;
    const { offsetWidth: width, offsetHeight: height } = node;
    let left = hovered.x + 14;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) left = hovered.x - 14 - width;
    let top = hovered.y - 12 - height;
    if (top < VIEWPORT_MARGIN) top = hovered.y + 16;
    top = Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN);
    node.style.left = `${Math.max(VIEWPORT_MARGIN, left)}px`;
    node.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
    node.style.visibility = "visible";
  };

  return (
    <div className="relative" onMouseLeave={() => setHovered(null)}>
      <div className="overflow-x-auto sam-scroll">
        <div className="min-w-[640px]">
          <div className="flex">
            <div className="w-16 shrink-0" />
            {HOURS.map((hour) => (
              <div key={hour} className="flex-1 py-1 text-center text-[10px] tabular-nums text-key">
                {hour}
              </div>
            ))}
          </div>
          {dates.map((date) => (
            <div key={date} className="flex items-center py-0.5">
              <div className="w-16 shrink-0 pr-2 text-[11px] tabular-nums text-key">{formatShortDayKey(date)}</div>
              {HOURS.map((hour) => {
                const bucket = data[date]?.[hour];
                const active = hasActivity(bucket);
                const show = (x: number, y: number) => {
                  if (active) setHovered({ date, hour, bucket: bucket!, x, y });
                  else setHovered(null);
                };
                return (
                  <div key={hour} className="flex-1 px-0.5">
                    <button
                      type="button"
                      className={`relative block h-6 w-full cursor-pointer transition-shadow hover:ring-1 hover:ring-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                        active ? rampClass(bucket!.score) : "bg-void"
                      }`}
                      // Empty hours: void square with a thin signal-ink border.
                      style={active ? undefined : { boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--sam-signal) 45%, transparent)" }}
                      onMouseEnter={(event) => show(event.clientX, event.clientY)}
                      onMouseMove={(event) => active && setHovered((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current))}
                      onFocus={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        show(rect.right, rect.top);
                      }}
                      onBlur={() => setHovered(null)}
                      onClick={() => {
                        setHovered(null);
                        onSelect({ date, hour });
                      }}
                      aria-label={`${formatDayKey(date)}, ${formatHour(hour)} IST: ${
                        active ? `${formatHMS(bucket!.duration / 1000)} tracked, score ${round(bucket!.score, 2)}` : "no activity"
                      }. Open activity log.`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
          <div className="ml-16 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-key">
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">Score {round(minScore, 2)}</span>
              {RAMP.map((tone) => (
                <span key={tone} aria-hidden className={`h-3 w-3 ${tone}`} />
              ))}
              <span className="tabular-nums">{round(maxScore, 2)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 bg-void" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--sam-signal) 45%, transparent)" }} />
              No activity
            </span>
          </div>
        </div>
      </div>

      {hovered && (
        <div ref={placeTooltip} className="pointer-events-none fixed left-0 top-0 z-50" style={{ visibility: "hidden" }}>
          <HourTooltip date={hovered.date} hour={hovered.hour} bucket={hovered.bucket} />
        </div>
      )}
    </div>
  );
}

export function HeatmapHourModal({
  selection,
  bucket,
  sessions,
  onClose,
}: {
  selection: HeatmapSelection | null;
  bucket: HeatmapBucket | null;
  sessions: TimelineSession[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selection) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      opener?.focus?.();
    };
  }, [onClose, selection]);

  const span = useMemo(() => {
    if (!selection) return null;
    const start = istHourStart(selection.date, selection.hour);
    return { start, end: start + HOUR_MS };
  }, [selection]);

  const entries = useMemo(() => (span ? sessionsInWindow(sessions, span) : []), [sessions, span]);

  if (!selection || !bucket || !span) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-hour-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="samaritan-card sam-ui relative flex max-h-[88vh] w-full max-w-4xl flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-grid px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="sam-key">{formatDayKey(selection.date)}</p>
            <h2 id="analytics-hour-title" className="sam-title mt-1 truncate text-[18px]">
              {formatHour(selection.hour)}–{formatHour(selection.hour + 1)} <span className="text-[12px] text-key">IST</span>
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="sam-button px-2" aria-label="Close hour details">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="sam-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          <section className="grid grid-cols-2 gap-px border border-grid bg-grid sm:grid-cols-4">
            <Readout label="Tracked" value={formatHMS(bucket.duration / 1000)} />
            <Readout label="Score" value={String(round(bucket.score, 2))} />
            <Readout label="Productive" value={`${round(bucket.productivity)}%`} />
            <Readout label="Idle" value={`${round(bucket.idleMinutes, 1)}m`} />
          </section>

          {bucket.categoryBreakdown?.length > 0 && (
            <section>
              <h3 className="sam-head mb-3">Category allocation</h3>
              <CategoryRows bucket={bucket} />
            </section>
          )}

          {bucket.topApps?.length > 0 && (
            <section>
              <h3 className="sam-head mb-3">Apps in this hour</h3>
              <ul className="grid border-l border-t border-grid sm:grid-cols-2">
                {bucket.topApps.map((app) => (
                  <li key={app.name} className="flex min-w-0 items-start justify-between gap-3 border-b border-r border-grid p-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-signal">{app.name}</p>
                      <AppCategoryTags app={app} limit={3} />
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-key">{app.minutes}m</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="sam-head">Activity log</h3>
              <span className="sam-key tabular-nums">{entries.length} sessions</span>
            </div>
            {entries.length > 0 ? (
              <div className="border border-grid">
                <SessionList key={`${selection.date}-${selection.hour}`} entries={entries} span={span} />
              </div>
            ) : (
              <p className="border border-dashed border-grid px-4 py-8 text-center text-[12px] text-key">
                No individual sessions were recorded in this hour.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
