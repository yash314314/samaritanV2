"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

const BUCKET_OPTIONS = [
  { label: "Hour", value: 60 },
  { label: "30m", value: 30 },
  { label: "15m", value: 15 },
  { label: "5m", value: 5 },
  { label: "1m", value: 1 },
];

function clampScore(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function scoreColor(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#38bdf8";
  if (score >= 25) return "#f59e0b";
  return "#fb7185";
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  const focus = clampScore(point?.focus);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 text-xs shadow-xl">
      <div className="mb-2 font-semibold text-zinc-100">
        {point?.label ?? "Unknown"}
      </div>
      <div className="space-y-1 text-zinc-400">
        <div>
          Focus:{" "}
          <span style={{ color: scoreColor(focus) }} className="font-semibold">
            {focus.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone = "text-zinc-100",
}: {
  label: string;
  value: any;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
      <span className="text-zinc-500">{label}</span>{" "}
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

export default function FocusTrendChart({
  data,
  bucketMinutes = 60,
  onBucketMinutesChange,
  isLoading = false,
}: any) {
  const chartData = Array.isArray(data)
    ? data.map((d: any) => ({
        ...d,
        label: d.label || d.time || "Unknown",
        focus: clampScore(d.focus ?? d.averageFocus ?? d.focusScore),
        duration: Number(d.duration ?? 0),
      }))
    : [];

  const activePoints = chartData.filter((point: any) => point.duration > 0);
  const weightedDuration = activePoints.reduce(
    (sum: number, point: any) => sum + point.duration,
    0
  );
  const averageFocus =
    weightedDuration > 0
      ? activePoints.reduce(
          (sum: number, point: any) => sum + point.focus * point.duration,
          0
        ) / weightedDuration
      : 0;
  const peak = activePoints.reduce(
    (best: any, point: any) => (point.focus > (best?.focus ?? -1) ? point : best),
    null
  );
  const deepBuckets = activePoints.filter((point: any) => point.focus >= 75).length;
  const lowBuckets = activePoints.filter((point: any) => point.focus > 0 && point.focus < 35).length;

  const pointWidth =
    bucketMinutes <= 1 ? 14 : bucketMinutes <= 5 ? 22 : bucketMinutes <= 15 ? 32 : 46;
  const chartWidth =
    bucketMinutes < 60 ? Math.max(1200, chartData.length * pointWidth) : "100%";
  const xInterval = bucketMinutes < 60 ? Math.ceil(60 / bucketMinutes) - 1 : 0;

  if (chartData.length === 0) {
    return (
      <div className="samaritan-card p-6">
        <h2 className="text-sm font-semibold text-zinc-200">Focus Trend</h2>
        <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
          {isLoading ? "Loading..." : "No focus data yet"}
        </div>
      </div>
    );
  }

  return (
    <div className="samaritan-card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Focus Trend</h2>
          <div className="mt-1 text-[11px] text-zinc-500">
            {isLoading ? "Updating..." : `${bucketMinutes}-minute buckets`}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1">
          {BUCKET_OPTIONS.map((option) => {
            const active = option.value === bucketMinutes;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onBucketMinutesChange?.(option.value)}
                className={`rounded px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <SummaryChip label="Avg" value={averageFocus.toFixed(1)} tone="text-sky-300" />
        {peak && (
          <SummaryChip
            label="Peak"
            value={`${peak.focus.toFixed(1)} @ ${peak.label}`}
            tone="text-emerald-400"
          />
        )}
        <SummaryChip label="Deep" value={deepBuckets} tone="text-emerald-400" />
        <SummaryChip label="Low" value={lowBuckets} tone="text-rose-300" />
      </div>

      <div className="relative overflow-x-auto">
        {isLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px animate-pulse bg-sky-400/70" />
        )}
        <div className="h-72" style={{ width: chartWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />

              <ReferenceArea y1={75} y2={100} fill="#14532d" fillOpacity={0.14} />
              <ReferenceArea y1={50} y2={75} fill="#075985" fillOpacity={0.12} />
              <ReferenceArea y1={25} y2={50} fill="#713f12" fillOpacity={0.12} />
              <ReferenceArea y1={0} y2={25} fill="#881337" fillOpacity={0.1} />

              <XAxis
                dataKey="label"
                interval={xInterval}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#71717a", strokeDasharray: "4 4" }} />
              <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.45} />
              <ReferenceLine y={50} stroke="#38bdf8" strokeDasharray="4 4" strokeOpacity={0.3} />

              <Line
                type="monotone"
                dataKey="focus"
                stroke="#a855f7"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "#f3e8ff", stroke: "#a855f7", strokeWidth: 2 }}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />

              <Scatter dataKey="focus" isAnimationActive animationDuration={700}>
                {chartData.map((point: any, index: number) => (
                  <Cell
                    key={`focus-dot-${point.label}-${index}`}
                    fill={point.duration > 0 ? scoreColor(point.focus) : "#3f3f46"}
                    fillOpacity={point.duration > 0 ? 0.95 : 0.22}
                  />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
