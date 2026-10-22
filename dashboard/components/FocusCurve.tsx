"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { MinuteLog } from "@/app/types";

interface FocusCurveProps {
  data: MinuteLog[];
  plannedMinutes: number;
  height?: number;
}

export function FocusCurve({ data, plannedMinutes, height = 400 }: FocusCurveProps) {
  const chartData = data.map((log) => ({
    minute: log.minute,
    Focus: log.focusScore,
    Productivity: log.productivityScore,
    Status: log.distraction ? "distraction" : log.idle ? "idle" : "focus",
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--sam-grid)" />
          <XAxis 
            dataKey="minute" 
            stroke="var(--sam-dim)" 
            label={{ value: "Minutes", position: "insideBottom", offset: -10 }}
          />
          <YAxis 
            stroke="var(--sam-dim)" 
            domain={[0, 100]} 
            label={{ value: "Score", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--sam-void)",
              border: "1px solid var(--sam-grid)",
              borderRadius: "8px",
            }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(1) : String(value ?? ""),
              name,
            ]}
          />
          <Legend />
          <ReferenceLine 
            x={plannedMinutes} 
            stroke="var(--sam-alert)" 
            strokeDasharray="5 5" 
            label={{ value: "Target", fill: "var(--sam-alert)" }}
          />
          <Line
            type="monotone"
            dataKey="Focus"
            stroke="var(--sam-series-2)"
            strokeWidth={2}
            dot={{ fill: "var(--sam-series-2)", r: 3 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Productivity"
            stroke="var(--sam-series-3)"
            strokeWidth={2}
            dot={{ fill: "var(--sam-series-3)", r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}