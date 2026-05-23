"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from "recharts";

/* ---------- DATE FORMAT ---------- */

function formatDate(date: string) {
  const d = new Date(date);

  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric"
  });
}

/* ---------- MOVING AVERAGE ---------- */

function computeMovingAverage(data: any[], key: string, window = 3) {

  return data.map((d, i) => {

    const start = Math.max(0, i - window + 1);

    const slice = data.slice(start, i + 1);

    const avg =
      slice.reduce((s, a) => s + (a[key] ?? 0), 0) / slice.length;

    return {
      ...d,
      entropyMA: avg
    };

  });

}

/* ---------- ENTROPY CLASSIFICATION ---------- */

function classifyEntropy(score: number) {

  if (score > 70)
    return {
      label: "Chaotic",
      color: "text-red-400"
    };

  if (score > 40)
    return {
      label: "Fragmented",
      color: "text-yellow-400"
    };

  return {
    label: "Stable",
    color: "text-emerald-400"
  };

}

/* ---------- TOOLTIP ---------- */

function CustomTooltip({ active, payload, label }: any) {

  if (!active || !payload || payload.length === 0) return null;

  const entropy = payload[0]?.value ?? 0;

  const classification =
    classifyEntropy(entropy);

  return (

    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl">

      <div className="text-zinc-200 font-semibold mb-2">
        {label}
      </div>

      <div className="text-zinc-400">

        Entropy Score:

        <span className="text-purple-400 ml-1">
          {entropy.toFixed(1)}
        </span>

      </div>

      <div className={`mt-1 ${classification.color}`}>
        State: {classification.label}
      </div>

      <div className="text-zinc-500 mt-2">
        Higher entropy indicates fragmented attention.
      </div>

    </div>

  );

}

/* ---------- MAIN COMPONENT ---------- */

export default function EntropyTrendChart({ data }: any) {

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

        <h2 className="text-sm text-zinc-300">
          Entropy Trend
        </h2>

        <p className="text-xs text-zinc-500 mt-3">
          No entropy data available.
        </p>

      </div>
    );
  }

  /* ---------- NORMALIZE DATA ---------- */

  const normalized = data.map((d: any) => ({
    date: d.date,
    averageEntropy: d.entropy ?? 0
  }));

  /* ---------- TREND DATA ---------- */

  const chartData =
    computeMovingAverage(normalized, "averageEntropy");

  const latest =
    chartData[chartData.length - 1];

  const previous =
    chartData[chartData.length - 2];

  let change = 0;

  if (latest && previous) {
    change =
      (latest.averageEntropy ?? 0)
      -
      (previous.averageEntropy ?? 0);
  }

  const isUp = change >= 0;

  const classification =
    classifyEntropy(latest?.averageEntropy ?? 0);

  return (

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <div>

          <h2 className="text-sm font-semibold text-zinc-300">
            Entropy Trend
          </h2>

          <div className={`text-xs ${classification.color}`}>
            {classification.label} Attention Pattern
          </div>

        </div>

        {previous && (

          <div className={`text-xs font-medium ${
            isUp ? "text-red-400" : "text-emerald-400"
          }`}>

            {isUp ? "▲" : "▼"}{" "}
            {Math.abs(change).toFixed(1)}

          </div>

        )}

      </div>

      {/* CHART */}

      <div className="h-64">

        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={chartData}>

            <defs>

              <linearGradient id="entropyGradient" x1="0" y1="0" x2="0" y2="1">

                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />

              </linearGradient>

            </defs>

            <CartesianGrid
              stroke="#27272a"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />

            <Tooltip
              content={<CustomTooltip />}
            />

            {/* ENTROPY AREA */}

            <Area
              type="monotone"
              dataKey="averageEntropy"
              stroke="#a855f7"
              strokeWidth={3}
              fill="url(#entropyGradient)"
              dot={{ r: 4, fill: "#a855f7" }}
              activeDot={{ r: 6 }}
            />

            {/* MOVING AVERAGE */}

            <Line
              type="monotone"
              dataKey="entropyMA"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />

            {/* STABILITY REFERENCE */}

            <ReferenceLine
              y={40}
              stroke="#3f3f46"
              strokeDasharray="4 4"
            />

            <ReferenceLine
              y={70}
              stroke="#ef4444"
              strokeDasharray="4 4"
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

      {/* INSIGHT */}

      <div className="text-[11px] text-zinc-500 mt-3 leading-relaxed">

        Entropy reflects the randomness of task switching.
        Lower entropy indicates more structured focus blocks.

      </div>

    </div>

  );

}