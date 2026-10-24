"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export default function WeeklyChart({ data, comparison }: any) {

  const chartData = Array.isArray(data) ? data : [];

  if (chartData.length === 0) {
    return (
      <div className="samaritan-card p-6">
        <h2 className="text-sm font-semibold text-zinc-300">
          Weekly Focus Trend
        </h2>
        <p className="text-xs text-zinc-500 mt-3">
          No weekly analytics available yet.
        </p>
      </div>
    );
  }

  const change = comparison?.change ?? 0;
  const isUp = change >= 0;

  return (

    <div className="samaritan-card p-6">

      <h2 className="text-sm font-semibold text-zinc-300 mb-4">
        Weekly Focus Trend
      </h2>

      <div className="h-64">

        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={chartData}>

            <defs>

              <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--sam-series-1)" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="var(--sam-series-1)" stopOpacity={0}/>
              </linearGradient>

            </defs>

            <CartesianGrid
              stroke="var(--sam-grid)"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="date"
              tick={{ fill:"var(--sam-key)", fontSize:12 }}
              axisLine={{ stroke:"var(--sam-grid)" }}
              tickLine={false}
            />

            <YAxis
              domain={[0,100]}
              tick={{ fill:"var(--sam-key)", fontSize:12 }}
              axisLine={{ stroke:"var(--sam-grid)" }}
              tickLine={false}
            />

            <Tooltip
              formatter={(value:any)=>`${value.toFixed(1)} Focus`}
              labelFormatter={(label)=>`Date: ${label}`}
              contentStyle={{
                background:"var(--sam-void)",
                border:"1px solid var(--sam-grid)",
                borderRadius:"8px"
              }}
            />

            <Area
              type="monotone"
              dataKey="averageFocus"
              stroke="var(--sam-series-1)"
              strokeWidth={3}
              fill="url(#focusGradient)"
              dot={{ r:4, fill:"var(--sam-series-1)" }}
              activeDot={{ r:6 }}
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

      {/* Comparison Insight */}

      <div className="mt-5 pt-4 border-t border-zinc-800">

        <div className="flex items-center gap-3 mb-2">

          <div
            className={`text-sm font-semibold ${
              isUp ? "text-zinc-200" : "text-red-500"
            }`}
          >
            {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(1)}
          </div>

          <div className="text-sm text-zinc-400">
            vs yesterday
          </div>

        </div>

        <div className="text-xs text-zinc-500">
          {comparison?.reason ?? "No comparison data available."}
        </div>

      </div>

    </div>

  );

}
