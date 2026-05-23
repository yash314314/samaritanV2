"use client";

import { useState } from "react";

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
    const suffix = hour >= 12 ? "PM" : "AM";
    const normalized = hour % 12 || 12;

    return `${normalized} ${suffix}`;
  }

  function getProductivityLabel(value: number) {
    if (value >= 85) return "Deep Work";
    if (value >= 70) return "Productive";
    if (value >= 55) return "Focused";
    if (value >= 35) return "Mixed";
    if (value > 0) return "Low";
    return "Idle";
  }

  function getColor(value: number, trackedMinutes?: number | null) {
    if (!trackedMinutes || value === 0) return "#18181b";

    if (value < 20) return "#27272a";
    if (value < 35) return "#312e81";
    if (value < 55) return "#4c1d95";
    if (value < 70) return "#6d28d9";
    if (value < 85) return "#8b5cf6";

    return "#c084fc";
  }

  function getOpacity(trackedMinutes?: number | null) {
    if (!trackedMinutes) return 0.45;
    return Math.min(1, Math.max(0.45, trackedMinutes / 60));
  }

  function formatDay(date: string) {
    const d = new Date(date + "T00:00:00");

    return {
      weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", {
        day: "numeric",
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
    <div
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
      onClick={() => {
        if (pinnedTooltip) closePinnedTooltip();
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">
            Productivity Heatmap
          </h2>

          <div className="text-[11px] text-zinc-500 mt-1">
            Activity-weighted productivity by hour
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>Low</span>
          <div className="flex gap-1">
            {[15, 35, 55, 70, 85].map(value => (
              <div
                key={value}
                className="h-3 w-3 rounded-sm border border-zinc-800"
                style={{ backgroundColor: getColor(value, 60) }}
              />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <div className="min-w-max">
          <div className="grid grid-cols-[90px_repeat(24,30px)] gap-2 mb-4 text-[11px] text-zinc-500">
            <div />

            {hours.map(hour => (
              <div key={hour} className="text-center">
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {days.map((date: string) => {
            const hoursData = data[date] || {};
            const formatted = formatDay(date);

            return (
              <div
                key={date}
                className="grid grid-cols-[90px_repeat(24,30px)] gap-2 mb-2 items-center"
              >
                <div className="text-sm text-zinc-400 leading-tight">
                  <div>{formatted.weekday}</div>

                  <div className="text-[11px] text-zinc-500">
                    {formatted.date}
                  </div>
                </div>

                {hours.map(hour => {
                  const cell = hoursData[hour] ?? 0;
                  const value = getCellScore(cell);
                  const trackedMinutes = getCellTrackedMinutes(cell);
                  const idleMinutes = getCellIdleMinutes(cell);
                  const key = `${date}-${hour}`;

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
                    <div
                      key={hour}
                      className="w-7 h-7 rounded-sm border border-zinc-800 transition-all hover:scale-110 hover:border-purple-400 hover:shadow-[0_0_6px_rgba(139,92,246,0.6)] cursor-pointer"
                      style={{
                        backgroundColor: getColor(value, trackedMinutes),
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
            className="fixed bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl w-72 max-h-[260px] overflow-y-auto z-[9999]"
            style={getTooltipPosition()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="font-semibold text-zinc-200">
                {new Date(tooltip.date + "T00:00:00").toDateString()}
              </div>

              {pinnedTooltip && (
                <button
                  type="button"
                  onClick={closePinnedTooltip}
                  className="text-zinc-500 hover:text-zinc-200 text-sm leading-none"
                  aria-label="Close tooltip"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-1 text-zinc-400">
              <div>Hour: {formatHour(tooltip.hour)}</div>

              <div>
                Productivity:{" "}
                <span className="text-purple-400">
                  {tooltip.value.toFixed(1)}
                </span>
              </div>

              <div>
                State:{" "}
                <span className="text-zinc-200">
                  {tooltip.label}
                </span>
              </div>

              <div>
                Tracked: {formatMinutes(tooltip.trackedMinutes)}
              </div>

              <div>
                Idle: {formatMinutes(tooltip.idleMinutes)}
              </div>

              {typeof tooltip.cell !== "number" && (
                <>
                  {tooltip.cell?.dominantApp && (
                    <div>
                      Dominant app:{" "}
                      <span className="text-zinc-200">
                        {tooltip.cell.dominantApp}
                      </span>
                    </div>
                  )}

                  {tooltip.cell?.dominantCategory && (
                    <div>
                      Category:{" "}
                      <span className="text-zinc-200">
                        {tooltip.cell.dominantCategory}
                      </span>
                    </div>
                  )}

                  {tooltip.cell?.dominantIntent && (
                    <div>
                      Intent:{" "}
                      <span className="text-zinc-200">
                        {tooltip.cell.dominantIntent}
                      </span>
                    </div>
                  )}

                  {tooltip.cell?.topApps?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <div className="text-zinc-500 mb-1">
                        Top apps
                      </div>

                      <div className="space-y-1">
                        {tooltip.cell.topApps.map((app: any) => (
                          <div
                            key={app.name}
                            className="flex justify-between gap-3"
                          >
                            <span className="truncate text-zinc-400">
                              {app.name}
                            </span>

                            <span className="text-zinc-500 shrink-0">
                              {app.minutes}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-zinc-700 text-zinc-500">
              Score is weighted by activity category, intent, focus impact,
              confidence, and duration.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}