"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";

/* ---------- FORMAT TIME ---------- */

function formatDuration(ms:number){

  if(!ms || isNaN(ms)) return "0m";

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  if(hours > 0){
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;

}

/* ---------- TOOLTIP ---------- */

function CustomTooltip({active,payload}:any){

  if(!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return(

    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl">

      <div className="text-zinc-200 font-semibold mb-1">
        {data.app}
      </div>

      <div className="text-zinc-400">
        Time: {formatDuration(data.duration)}
      </div>

      <div className="text-zinc-500">
        Usage Share: {data.percent}%
      </div>

    </div>

  );

}

export default function AppUsageChart({data}:any){

  if(!data) return null;

  /* ---------- TRANSFORM DATA ---------- */

  const entries = Object
    .entries(data as Record<string, number>)
    .map(([app, count]) => ({
      app,
      duration: count * 60000
    }));

  /* ---------- SORT ---------- */

  entries.sort((a:any,b:any)=>b.duration-a.duration);

  /* ---------- TOP APPS ---------- */

  const topApps = entries.slice(0,8);

  /* ---------- TOTAL ---------- */

  const total =
    topApps.reduce((sum:any,a:any)=>sum+a.duration,0);

  const chartData = topApps.map(a=>({

    ...a,

    percent: total > 0
      ? ((a.duration/total)*100).toFixed(1)
      : 0

  }));

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-6">

        <h2 className="text-sm font-semibold text-zinc-300">
          App Usage
        </h2>

        <span className="text-xs text-zinc-500">
          Top Applications
        </span>

      </div>

      {/* CHART */}

      <div className="h-80">

        <ResponsiveContainer width="100%" height="100%">

          <BarChart
            data={chartData}
            layout="vertical"
            margin={{top:10,right:20,left:40,bottom:10}}
            barCategoryGap={18}
          >

            <CartesianGrid
              stroke="#27272a"
              strokeDasharray="3 3"
              horizontal={false}
            />

            <XAxis
              type="number"
              tick={{fill:"#a1a1aa",fontSize:12}}
              axisLine={{stroke:"#3f3f46"}}
              tickLine={false}
              tickFormatter={(value)=>formatDuration(value)}
            />

            <YAxis
              dataKey="app"
              type="category"
              tick={{fill:"#a1a1aa",fontSize:12}}
              axisLine={false}
              tickLine={false}
              width={140}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(24,24,27,0.6)" }}
            />

            <Bar
              dataKey="duration"
              radius={[6,6,6,6]}
              barSize={18}
            >

              {chartData.map((entry,index)=>(

                <Cell
                  key={index}
                  fill="#8b5cf6"
                  className="transition-all duration-200 hover:brightness-125"
                  style={{
                    filter:"drop-shadow(0 0 0px rgba(139,92,246,0))"
                  }}
                />

              ))}

            </Bar>

          </BarChart>

        </ResponsiveContainer>

      </div>

      {/* FOOTNOTE */}

      <div className="text-[11px] text-zinc-500 mt-4">

        Shows distribution of time spent across applications.

      </div>

    </div>

  );

}