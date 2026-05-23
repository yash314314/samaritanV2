"use client";

function getRiskLevel(score:number){

  if(score >= 70) return "High";
  if(score >= 45) return "Moderate";
  return "Low";

}

function getRiskColor(score:number){

  if(score >= 70) return "text-red-400";
  if(score >= 45) return "text-yellow-400";
  return "text-emerald-400";

}

function getBarColor(score:number){

  if(score >= 70) return "bg-red-500";
  if(score >= 45) return "bg-yellow-500";
  return "bg-emerald-500";

}

export default function BurnoutRiskCard({data}:any){

  if(!data) return null;

  const risk = data.averageBurnoutScore ?? 0;

  const level = getRiskLevel(risk);

  const textColor = getRiskColor(risk);

  const barColor = getBarColor(risk);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Burnout Risk
        </h2>

        <span className={`text-xs font-medium ${textColor}`}>
          {level}
        </span>

      </div>

      {/* SCORE */}

      <div className="flex items-end gap-2 mb-3">

        <span className={`text-3xl font-bold ${textColor}`}>
          {risk.toFixed(1)}
        </span>

        <span className="text-xs text-zinc-500 mb-1">
          / 100
        </span>

      </div>

      {/* PROGRESS BAR */}

      <div className="w-full bg-zinc-800 h-2 rounded mb-4">

        <div
          className={`${barColor} h-2 rounded`}
          style={{width:`${Math.min(risk,100)}%`}}
        />

      </div>

      {/* SUPPORTING METRICS */}

      <div className="space-y-2 text-xs">

        <div className="flex justify-between">

          <span className="text-zinc-400">
            Context Switching
          </span>

          <span className="text-zinc-200">
            {data.totalSwitches}
          </span>

        </div>

        <div className="flex justify-between">

          <span className="text-zinc-400">
            Entropy
          </span>

          <span className="text-zinc-200">
            {data.averageEntropyScore?.toFixed(1)}
          </span>

        </div>

        <div className="flex justify-between">

          <span className="text-zinc-400">
            Idle Time
          </span>

          <span className="text-zinc-200">
            {Math.round(data.totalIdleSeconds / 60)}m
          </span>

        </div>

      </div>

      {/* INSIGHT */}

      <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500">

        Burnout risk reflects cognitive load from long sessions,
        excessive context switching and fragmented attention.

      </div>

    </div>

  );

}