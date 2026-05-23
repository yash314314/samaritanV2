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
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="minute" 
            stroke="#888" 
            label={{ value: "Minutes", position: "insideBottom", offset: -10 }}
          />
          <YAxis 
            stroke="#888" 
            domain={[0, 100]} 
            label={{ value: "Score", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
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
            stroke="#ff4444" 
            strokeDasharray="5 5" 
            label={{ value: "Target", fill: "#ff4444" }}
          />
          <Line
            type="monotone"
            dataKey="Focus"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", r: 3 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Productivity"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}