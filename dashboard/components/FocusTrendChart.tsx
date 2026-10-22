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
  ReferenceLine,
} from "recharts";
import { ALERT_THRESHOLD, SAM, scoreLuminance } from "../lib/samaritanTheme";

const BUCKET_OPTIONS = [
  { label: "Hour", value: 60 },
  { label: "30m", value: 30 },
  { label: "15m", value: 15 },
  { label: "5m", value: 5 },
  { label: "1m", value: 1 },
];

const DEEP_THRESHOLD = 75;

function clampScore(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function pointColor(point: any) {
  return point.focus < ALERT_THRESHOLD ? SAM.alert : scoreLuminance(Math.max(40, point.focus));
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  const focus = clampScore(point?.focus);
  const tracked = Number(point?.duration ?? 0) > 0;

  return (
    <div className="sam-ui border border-grid bg-void px-3 py-2 text-[11px]">
      <div className="mb-1 tabular-nums text-signal">{point?.label ?? "--"}</div>
      {tracked ? (
        <div className="flex gap-3">
          <span className="sam-key">Focus</span>
          <span className={`tabular-nums ${focus < ALERT_THRESHOLD ? "text-alert" : "text-signal"}`}>
            {focus.toFixed(1)}
          </span>
        </div>
      ) : (
        <div className="text-key">No activity</div>
      )}
    </div>
  );
}

function Header({
  bucketMinutes,
  onBucketMinutesChange,
  isLoading,
}: {
  bucketMinutes: number;
  onBucketMinutesChange?: (minutes: number) => void;
  isLoading: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
      <div className="flex items-baseline gap-4">
        <h2 className="sam-head">Focus trend</h2>
        <span className="sam-key">{isLoading ? "Updating" : `${bucketMinutes}-minute buckets`}</span>
      </div>

      <div className="flex items-center gap-4" role="group" aria-label="Bucket size">
        {BUCKET_OPTIONS.map((option) => {
          const active = option.value === bucketMinutes;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onBucketMinutesChange?.(option.value)}
              aria-pressed={active}
              className={`text-[11px] uppercase tracking-[0.08em] underline-offset-[6px] transition-colors ${
                active ? "text-signal underline" : "text-key hover:text-trace"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FocusTrendChart({
  data,
  bucketMinutes = 60,
  onBucketMinutesChange,
  isLoading = false,
}: any) {
  const rawData = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.trend)
    ? data.trend
    : [];

  const chartData = rawData
    .map((d: any) => ({
        ...d,
        label: d.label || d.time || "Unknown",
        focus: clampScore(d.focus ?? d.averageFocus ?? d.focusScore),
        duration: Number(d.duration ?? d.trackedMs ?? d.activeMs ?? 0),
      }))
    .filter((d: any) => d.label !== "Unknown" || d.duration > 0 || d.focus > 0)
    // Untracked buckets are gaps, not zero focus: plotting them at 0 would
    // draw a fake "no focus" reading across every empty hour.
    .map((d: any) => ({ ...d, plotted: d.duration > 0 ? d.focus : null }));

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
  const deepBuckets = activePoints.filter((point: any) => point.focus >= DEEP_THRESHOLD).length;
  const lowBuckets = activePoints.filter((point: any) => point.focus > 0 && point.focus < ALERT_THRESHOLD).length;

  const pointWidth =
    bucketMinutes <= 1 ? 14 : bucketMinutes <= 5 ? 22 : bucketMinutes <= 15 ? 32 : 46;
  const chartWidth =
    bucketMinutes < 60 ? Math.max(1200, chartData.length * pointWidth) : "100%";
  const xInterval = bucketMinutes < 60 ? Math.ceil(60 / bucketMinutes) - 1 : 0;

  if (chartData.length === 0) {
    return (
      <section className="w-full max-w-full">
        <Header bucketMinutes={bucketMinutes} onBucketMinutesChange={onBucketMinutesChange} isLoading={isLoading} />
        <p className="text-[12px] text-key">
          {isLoading ? "Loading focus readings." : "No focus readings for this day yet."}
        </p>
      </section>
    );
  }

  const summary = [
    { key: "Average", value: averageFocus.toFixed(1), alert: activePoints.length > 0 && averageFocus < ALERT_THRESHOLD },
    { key: "Peak", value: peak ? `${peak.focus.toFixed(1)} at ${peak.label}` : "--" },
    { key: "Deep buckets", value: deepBuckets },
    { key: "Low buckets", value: lowBuckets, alert: lowBuckets > 0 },
  ];

  return (
    <section className="w-full max-w-full">
      <Header bucketMinutes={bucketMinutes} onBucketMinutesChange={onBucketMinutesChange} isLoading={isLoading} />

      <dl className="mb-5 flex flex-wrap gap-x-10 gap-y-2">
        {summary.map((item) => (
          <div key={item.key} className="flex items-baseline gap-3">
            <dt className="sam-key">{item.key}</dt>
            <dd className={`sam-value ${item.alert ? "text-alert" : ""}`}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="sam-scroll relative w-full max-w-full overflow-x-auto">
        {isLoading && (
          <div className="sam-pulse pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-signal text-void" />
        )}
        <div className="h-[240px] sm:h-[270px]" style={{ width: chartWidth }}>
          <ResponsiveContainer key={`${bucketMinutes}-${chartData.length}`} width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--sam-track)" vertical={false} />

              <XAxis
                dataKey="label"
                interval={bucketMinutes < 60 ? xInterval : "preserveStartEnd"}
                minTickGap={8}
                // Hour buckets read "00".."23", like the timeline and heatmap.
                tickFormatter={(value) => (bucketMinutes === 60 ? String(value).replace(/:00$/, "") : value)}
                tick={{ fill: SAM.key, fontSize: 11 }}
                axisLine={{ stroke: SAM.grid }}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: SAM.key, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: SAM.dim, strokeWidth: 1 }} />
              <ReferenceLine
                y={DEEP_THRESHOLD}
                stroke={SAM.dim}
                strokeDasharray="2 4"
                label={{ value: "DEEP", position: "insideTopRight", fill: SAM.key, fontSize: 10 }}
              />
              <ReferenceLine
                y={ALERT_THRESHOLD}
                stroke={SAM.alert}
                strokeOpacity={0.6}
                strokeDasharray="2 4"
                label={{ value: "LOW", position: "insideTopRight", fill: SAM.alert, fontSize: 10 }}
              />

              <Line
                type="linear"
                dataKey="plotted"
                connectNulls={false}
                stroke={SAM.signal}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: SAM.void, stroke: SAM.signal, strokeWidth: 1.5 }}
                isAnimationActive={false}
              />

              <Scatter dataKey="plotted" isAnimationActive={false}>
                {chartData.map((point: any, index: number) => (
                  <Cell key={`focus-dot-${point.label}-${index}`} fill={pointColor(point)} />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
