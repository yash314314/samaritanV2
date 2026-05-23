"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";

/* ---------- DATE FORMAT ---------- */

function formatDate(date:string){

  const d = new Date(date);

  return d.toLocaleDateString("en-IN",{
    weekday:"short"
  });

}

/* ---------- TOOLTIP ---------- */

function CustomTooltip({ active, payload, label }: any){

    if (!active || !payload || payload.length === 0) return null;
  
    const focusGrowth =
      payload.find((p:any)=>p.dataKey==="focusGrowth");
  
    const entropyChange =
      payload.find((p:any)=>p.dataKey==="entropyChange");
  
    const data = payload[0]?.payload;
  
    return(
  
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-xs shadow-xl min-w-[180px]">
  
        <div className="text-zinc-200 font-semibold mb-3">
          {label}
        </div>
  
        {/* Absolute Values */}
  
        <div className="space-y-1 mb-2">
  
          <div className="flex justify-between text-zinc-300">
            <span>Focus Score</span>
            <span className="text-purple-400">
              {data.focus.toFixed(1)}
            </span>
          </div>
  
          <div className="flex justify-between text-zinc-300">
            <span>Entropy</span>
            <span className="text-cyan-400">
              {data.entropy.toFixed(1)}
            </span>
          </div>
  
        </div>
  
        <div className="border-t border-zinc-700 my-2"/>
  
        {/* Change Values */}
  
        {focusGrowth && (
  
          <div className="flex justify-between text-zinc-400">
  
            <span>Focus Growth</span>
  
            <span className={
              focusGrowth.value >= 0
                ? "text-emerald-400"
                : "text-red-400"
            }>
  
              {focusGrowth.value >= 0 ? "+" : ""}
              {focusGrowth.value.toFixed(1)}
  
            </span>
  
          </div>
  
        )}
  
        {entropyChange && (
  
          <div className="flex justify-between text-zinc-400">
  
            <span>Entropy Change</span>
  
            <span className={
              entropyChange.value <= 0
                ? "text-emerald-400"
                : "text-red-400"
            }>
  
              {entropyChange.value >= 0 ? "+" : ""}
              {entropyChange.value.toFixed(1)}
  
            </span>
  
          </div>
  
        )}
  
        {/* Interpretation */}
  
        <div className="text-zinc-500 mt-3 text-[11px] leading-relaxed">
  
          {focusGrowth?.value > 0
            ? "Improved sustained attention."
            : focusGrowth?.value < 0
            ? "Attention stability declined."
            : "Focus remained stable."}
  
        </div>
  
      </div>
  
    );
  
  }

/* ---------- MAIN COMPONENT ---------- */

export default function GrowthTrendChart({ data }: any){

  if(!Array.isArray(data) || data.length === 0){

    return(

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

        <h2 className="text-sm text-zinc-300">
          Growth Trend
        </h2>

        <p className="text-xs text-zinc-500 mt-3">
          No growth data available.
        </p>

      </div>

    );

  }

  /* ---------- NORMALIZE DATA ---------- */

  const chartData = data.map((d:any,i:number)=>{

    const prev = data[i-1];
  
    const focusGrowth =
      i === 0 ? 0 : d.focus - prev.focus;
  
    const entropyChange =
      i === 0 ? 0 : d.entropy - prev.entropy;
  
    return {
  
      date: formatDate(d.date),
  
      focus: d.focus,
      entropy: d.entropy,
  
      focusGrowth,
      entropyChange
  
    };
  
  });

  /* ---------- TREND CALCULATION ---------- */

  const latest = chartData[chartData.length - 1];
  const previous = chartData[chartData.length - 2];

  let change = 0;

  if(previous){
    change = latest.focusGrowth - previous.focusGrowth;
  }

  const isUp = change >= 0;

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <div>

          <h2 className="text-sm font-semibold text-zinc-300">
            Growth Trend
          </h2>

          <div className="text-xs text-zinc-500">
            Weekly Cognitive Change
          </div>

        </div>

        {previous && (

          <div className={`text-xs font-medium ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}>

            {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(1)}

          </div>

        )}

      </div>

      {/* CHART */}

      <div className="h-72">

        <ResponsiveContainer width="100%" height="100%">

          <LineChart
            data={chartData}
            margin={{ top:10, right:20, left:0, bottom:0 }}
          >

            <CartesianGrid
              stroke="#27272a"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="date"
              tick={{ fill:"#a1a1aa", fontSize:12 }}
              axisLine={{ stroke:"#3f3f46" }}
              tickLine={false}
            />

            <YAxis
              tick={{ fill:"#a1a1aa", fontSize:12 }}
              axisLine={{ stroke:"#3f3f46" }}
              tickLine={false}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke:"#52525b" }}
            />

            <Legend
              wrapperStyle={{
                fontSize:"12px",
                color:"#a1a1aa"
              }}
            />

            {/* Focus Growth */}

            <Line
              type="monotone"
              dataKey="focusGrowth"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ r:4 }}
              activeDot={{ r:7 }}
              name="Focus Growth"
            />

            {/* Entropy Change */}

            <Line
              type="monotone"
              dataKey="entropyChange"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={{ r:3 }}
              name="Entropy Change"
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

      {/* FOOTNOTE */}

      <div className="text-[11px] text-zinc-500 mt-3">

        Tracks cognitive performance change across sessions.
        Focus growth indicates improved sustained attention,
        while entropy change reflects variation in task switching.

      </div>

    </div>

  );

}