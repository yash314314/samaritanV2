"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface GrowthPoint {
  date: string;
  focus?: number;
  entropy?: number;
  averageEntropy?: number;
  [key: string]: any;
}

interface EntropyTrendChartProps {
  data: GrowthPoint[] | null;
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
}

function computeMovingAverage(data: GrowthPoint[], key: string, window = 3) {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, a) => s + ((a[key as keyof GrowthPoint] as number) ?? 0), 0) / slice.length;
    return { ...d, entropyMA: avg };
  });
}

function classifyEntropy(score: number) {
  if (score > 70) return { label: "Chaotic", color: "text-rose-400", barColor: "#f43f5e" };
  if (score > 40) return { label: "Fragmented", color: "text-amber-400", barColor: "#f59e0b" };
  return { label: "Stable", color: "text-emerald-400", barColor: "#10b981" };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const entropy = payload[0]?.value ?? 0;
  const classification = classifyEntropy(entropy);

  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-xs shadow-2xl w-64">
      <div className="text-zinc-200 font-semibold mb-2">{label}</div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-zinc-400">Entropy Score</span>
        <span className="text-purple-400 font-mono font-bold">{entropy.toFixed(1)}</span>
      </div>
      <div className={`text-xs ${classification.color} mb-2`}>
        State: {classification.label}
      </div>
      <div className="text-zinc-600 text-[11px] leading-relaxed border-t border-zinc-800 pt-2">
        Higher entropy indicates fragmented attention and frequent task switching.
      </div>
    </div>
  );
}

export default function EntropyTrendChart({ data }: EntropyTrendChartProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full">
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-500" />
          Entropy Trend
        </h2>
        <p className="text-xs text-zinc-500 mt-3">No entropy data available.</p>
      </div>
    );
  }

  // Normalize data — handle both {entropy} and {averageEntropy} keys
  const normalized = useMemo(() => {
    return data.map((d) => ({
      date: formatDate(d.date),
      rawDate: d.date,
      averageEntropy: d.entropy ?? d.averageEntropy ?? 0,
      focus: d.focus ?? 0,
    }));
  }, [data]);

  const chartData = useMemo(() => computeMovingAverage(normalized, "averageEntropy"), [normalized]);

  const latest = chartData[chartData.length - 1];
  const previous = chartData[chartData.length - 2];

  const change = latest && previous ? (latest.averageEntropy ?? 0) - (previous.averageEntropy ?? 0) : 0;
  const isUp = change >= 0;
  const classification = classifyEntropy(latest?.averageEntropy ?? 0);

  // Trend over full period
  const periodTrend = useMemo(() => {
    if (chartData.length < 2) return { icon: <Minus className="w-3 h-3" />, color: "text-zinc-500", label: "Flat" };
    const first = chartData[0].averageEntropy ?? 0;
    const last = chartData[chartData.length - 1].averageEntropy ?? 0;
    const delta = last - first;
    if (delta > 10) return { icon: <TrendingUp className="w-3 h-3" />, color: "text-rose-400", label: "Rising" }; // rising entropy = bad
    if (delta < -10) return { icon: <TrendingDown className="w-3 h-3" />, color: "text-emerald-400", label: "Falling" }; // falling = good
    return { icon: <Minus className="w-3 h-3" />, color: "text-zinc-500", label: "Stable" };
  }, [chartData]);

  const avgEntropy = chartData.reduce((s, d) => s + (d.averageEntropy ?? 0), 0) / chartData.length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />
            Entropy Trend
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs ${classification.color}`}>{classification.label} Attention</span>
            <span className="text-zinc-700">•</span>
            <span className={`text-xs flex items-center gap-1 ${periodTrend.color}`}>
              {periodTrend.icon}
              {periodTrend.label}
            </span>
          </div>
        </div>
        {previous && (
          <div className={`text-xs font-medium px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 ${isUp ? "text-rose-400" : "text-emerald-400"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(1)}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-center">
          <p className="text-[10px] text-zinc-600 uppercase">Current</p>
          <p className="text-sm font-bold text-purple-400 font-mono">{(latest?.averageEntropy ?? 0).toFixed(1)}</p>
        </div>
        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-center">
          <p className="text-[10px] text-zinc-600 uppercase">Average</p>
          <p className="text-sm font-bold text-zinc-300 font-mono">{avgEntropy.toFixed(1)}</p>
        </div>
        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-center">
          <p className="text-[10px] text-zinc-600 uppercase">Change</p>
          <p className={`text-sm font-bold font-mono ${change > 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {change > 0 ? "+" : ""}{change.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="entropyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            
            <XAxis
              dataKey="date"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />
            
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />
            
            <Tooltip content={<CustomTooltip />} />

            {/* Stability threshold */}
            <ReferenceLine y={40} stroke="#10b981" strokeDasharray="4 4" />
            {/* Chaos threshold */}
            <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="4 4" />

            {/* Entropy Area */}
            <Area
              type="monotone"
              dataKey="averageEntropy"
              stroke="#a855f7"
              strokeWidth={2.5}
              fill="url(#entropyGradient)"
              dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#a855f7", stroke: "#fff", strokeWidth: 2 }}
            />

            {/* Moving Average Line */}
            <Line
              type="monotone"
              dataKey="entropyMA"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Footnote */}
      <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Entropy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Moving Avg
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-500/70">
            <span className="w-4 border-t border-dashed border-emerald-500/50" />
            Stable
          </span>
          <span className="flex items-center gap-1 text-rose-500/70">
            <span className="w-4 border-t border-dashed border-rose-500/50" />
            Chaotic
          </span>
        </div>
      </div>
    </div>
  );
}