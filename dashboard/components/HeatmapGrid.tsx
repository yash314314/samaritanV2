"use client";

import { useState } from "react";
import { ALERT_THRESHOLD, scoreLuminance } from "../lib/samaritanTheme";

const TOOLTIP_WIDTH = 288;
const TOOLTIP_HEIGHT = 260;
const TOOLTIP_OFFSET = 12;

function getCellScore(cell: any) {
  if (typeof cell === "number") return cell;
  return cell?.productivity ?? cell?.score ?? 0;
}

function getCellTrackedMinutes(cell: any) {
  if (typeof cell === "number") return null;
  return cell?.trackedMinutes ?? 0;
}

function getCellIdleMinutes(cell: any) {
  if (typeof cell === "number") return null;
  return cell?.idleMinutes ?? 0;
}

export default function HeatmapGrid({ data }: any) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = Object.keys(data || {}).slice(-7);

  const [tooltip, setTooltip] = useState<any>(null);
  const [pinnedTooltip, setPinnedTooltip] = useState(false);

  function formatHour(hour: number) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function getProductivityLabel(value: number) {
    if (value >= 85) return "Deep Work";
    if (value >= 70) return "Productive";
    if (value >= 55) return "Focused";
    if (value >= 35) return "Mixed";
    if (value > 0) return "Low";
    return "Idle";
  }

  function isEmpty(value: number, trackedMinutes?: number | null) {
    return !trackedMinutes || value === 0;
  }

  // Brightness is productivity. Empty hours are void squares with a thin
  // signal-ink border, so "no activity" never reads as "low productivity".
  function getColor(value: number, trackedMinutes?: number | null) {
    if (isEmpty(value, trackedMinutes)) return "var(--sam-void)";
    return scoreLuminance(Math.max(8, value));
  }

  const EMPTY_BORDER = "inset 0 0 0 1px color-mix(in srgb, var(--sam-signal) 45%, transparent)";

  function getOpacity(trackedMinutes?: number | null) {
    if (!trackedMinutes) return 1;
    return Math.min(1, Math.max(0.45, trackedMinutes / 60));
  }

  function formatDay(date: string) {
    const d = new Date(date + "T00:00:00");

    return {
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      date: d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short"
      })
    };
  }

  function formatMinutes(value: number | null) {
    if (value === null || value === undefined) return "n/a";
    if (value < 1 && value > 0) return "<1m";
    return `${Math.round(value)}m`;
  }

  function getTooltipPosition() {
    if (!tooltip) return { left: 0, top: 0 };

    return {
      left: Math.max(
        8,
        Math.min(
          tooltip.x + TOOLTIP_OFFSET,
          window.innerWidth - TOOLTIP_WIDTH - 8
        )
      ),
      top: Math.max(
        8,
        Math.min(
          tooltip.y + TOOLTIP_OFFSET,
          window.innerHeight - TOOLTIP_HEIGHT - 8
        )
      )
    };
  }

  function closePinnedTooltip() {
    setPinnedTooltip(false);
    setTooltip(null);
  }

  return (
    <section
      className="flex w-full max-w-full flex-col"
      onClick={() => {
        if (pinnedTooltip) closePinnedTooltip();
      }}
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-4">
          <h2 className="sam-head">Heatmap</h2>
          <span className="sam-key">Productivity by hour, click a cell to pin</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5" style={{ backgroundColor: "var(--sam-void)", boxShadow: EMPTY_BORDER }} />
            <span className="sam-key">No activity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="sam-key">Low</span>
            <div className="flex gap-px">
              {[15, 35, 55, 75, 95].map(value => (
                <div key={value} className="h-2.5 w-2.5" style={{ backgroundColor: getColor(value, 60) }} />
              ))}
            </div>
            <span className="sam-key">High</span>
          </div>
        </div>
      </div>

      <div className="sam-scroll relative w-full max-w-full overflow-x-auto">
        <div className="min-w-max">
          <div className="mb-2 grid grid-cols-[72px_repeat(24,28px)] gap-[3px] text-[10px] text-key">
            <div />

            {hours.map(hour => (
              <div key={hour} className="text-center tabular-nums">
                {String(hour).padStart(2, "0")}
              </div>
            ))}
          </div>

          {days.map((date: string) => {
            const hoursData = data[date] || {};
            const formatted = formatDay(date);

            return (
              <div
                key={date}
                className="mb-[3px] grid grid-cols-[72px_repeat(24,28px)] items-center gap-[3px]"
              >
                <div className="leading-tight">
                  <div className="sam-key">{formatted.weekday}</div>
                  <div className="text-[10px] tabular-nums text-dim">{formatted.date}</div>
                </div>

                {hours.map(hour => {
                  const cell = hoursData[hour] ?? 0;
                  const value = getCellScore(cell);
                  const trackedMinutes = getCellTrackedMinutes(cell);
                  const idleMinutes = getCellIdleMinutes(cell);
                  const key = `${date}-${hour}`;
                  const selected = tooltip?.key === key;

                  const payload = {
                    x: 0,
                    y: 0,
                    key,
                    date,
                    hour,
                    cell,
                    value,
                    trackedMinutes,
                    idleMinutes,
                    label: getProductivityLabel(value)
                  };

                  return (
                    <button
                      type="button"
                      key={hour}
                      aria-label={`${formatted.weekday} ${formatHour(hour)}, productivity ${value.toFixed(0)}`}
                      className={`h-7 w-7 cursor-pointer outline-offset-1 hover:outline hover:outline-1 hover:outline-signal ${selected ? "outline outline-1 outline-signal" : ""}`}
                      style={{
                        backgroundColor: getColor(value, trackedMinutes),
                        boxShadow: isEmpty(value, trackedMinutes) ? EMPTY_BORDER : undefined,
                        opacity: getOpacity(trackedMinutes)
                      }}
                      onMouseEnter={(e) => {
                        if (pinnedTooltip) return;

                        setTooltip({
                          ...payload,
                          x: e.clientX,
                          y: e.clientY
                        });
                      }}
                      onMouseLeave={() => {
                        if (pinnedTooltip) return;
                        setTooltip(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();

                        if (pinnedTooltip && tooltip?.key === key) {
                          closePinnedTooltip();
                          return;
                        }

                        setPinnedTooltip(true);
                        setTooltip({
                          ...payload,
                          x: e.clientX,
                          y: e.clientY
                        });
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {tooltip && (
          <div
            className="sam-scroll fixed z-[9999] max-h-[260px] w-72 overflow-y-auto border border-grid bg-void p-3 text-[11px]"
            style={getTooltipPosition()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="tabular-nums text-signal">
                {formatDay(tooltip.date).weekday} {formatDay(tooltip.date).date}, {formatHour(tooltip.hour)}
              </div>

              {pinnedTooltip && (
                <button
                  type="button"
                  onClick={closePinnedTooltip}
                  className="sam-key hover:text-signal"
                  aria-label="Close details"
                >
                  Close
                </button>
              )}
            </div>

            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5">
              <dt className="sam-key">Productivity</dt>
              <dd className={`tabular-nums ${tooltip.value < ALERT_THRESHOLD && tooltip.trackedMinutes ? "text-alert" : "text-signal"}`}>
                {tooltip.value.toFixed(1)}
              </dd>
              <dt className="sam-key">State</dt>
              <dd className="text-trace">{tooltip.label}</dd>
              <dt className="sam-key">Tracked</dt>
              <dd className="tabular-nums text-trace">{formatMinutes(tooltip.trackedMinutes)}</dd>
              <dt className="sam-key">Idle</dt>
              <dd className="tabular-nums text-trace">{formatMinutes(tooltip.idleMinutes)}</dd>
              {typeof tooltip.cell !== "number" && tooltip.cell?.dominantApp && (
                <><dt className="sam-key">Dominant</dt><dd className="truncate text-trace">[{tooltip.cell.dominantApp}]</dd></>
              )}
              {typeof tooltip.cell !== "number" && tooltip.cell?.dominantCategory && (
                <><dt className="sam-key">Category</dt><dd className="truncate text-trace">{String(tooltip.cell.dominantCategory).replaceAll("_", " ")}</dd></>
              )}
              {typeof tooltip.cell !== "number" && tooltip.cell?.dominantIntent && (
                <><dt className="sam-key">Intent</dt><dd className="truncate text-trace">{String(tooltip.cell.dominantIntent).replaceAll("_", " ")}</dd></>
              )}
            </dl>

            {typeof tooltip.cell !== "number" && tooltip.cell?.topApps?.length > 0 && (
              <div className="mt-2 border-t border-grid pt-2">
                <div className="sam-key mb-1">Top apps</div>
                <ul className="space-y-1">
                  {tooltip.cell.topApps.map((app: any) => (
                    <li key={app.name} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-trace">[{app.name}]</div>
                        <div className="truncate text-[10px] text-dim">
                          {(app.categories?.length ? app.categories.map((c: any) => c.name) : [app.category ?? "unknown"])
                            .slice(0, 2)
                            .map((name: string) => name.replaceAll("_", " "))
                            .join(", ")}
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-key">{app.minutes}m</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-2 border-t border-grid pt-2 text-dim">
              Weighted by category, intent, focus impact, confidence and duration.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
