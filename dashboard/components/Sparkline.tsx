"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import { SparklineData } from "@/app/types";

interface SparklineProps {
  data: SparklineData;
  height?: number;
}

export function Sparkline({ data, height = 60 }: SparklineProps) {
  const chartData = data.focus.map((score, i) => ({
    index: i,
    focus: score,
    productivity: data.productivity[i],
    status: data.status[i],
  }));

  const getStrokeColor = () => {
    const lastStatus = data.status[data.status.length - 1];
    if (lastStatus === "distraction") return "var(--sam-alert)";
    if (lastStatus === "idle") return "var(--sam-warn)";
    return "var(--sam-series-2)";
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="focus"
          stroke={getStrokeColor()}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}