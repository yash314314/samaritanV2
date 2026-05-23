"use client";

function getRiskColor(level:string){

  if(level === "high") return "text-red-400";
  if(level === "moderate") return "text-yellow-400";

  return "text-emerald-400";

}

function getRiskLabel(level:string){

  if(level === "high") return "High Risk";
  if(level === "moderate") return "Moderate Risk";

  return "Low Risk";

}

function getRiskDescription(level:string){

  if(level === "high")
    return "Sustained cognitive load detected. Recovery time recommended.";

  if(level === "moderate")
    return "Workload trending upward. Monitor session intensity.";

  return "Workload currently within sustainable limits.";

}

export default function BurnoutRiskPanel({data}:any){

  if(!data) return null;

  const level = data.burnoutRisk ?? "low";

  const score = data.burnoutScore ?? 0;

  const entropy = data.entropyLoad ?? 0;

  const sessionMinutes = data.avgSessionMinutes ?? 0;

  const color = getRiskColor(level);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Burnout Risk
        </h2>

        <span className={`text-xs font-medium ${color}`}>
          {getRiskLabel(level)}
        </span>

      </div>

      {/* SCORE */}

      <div className={`text-4xl font-bold ${color}`}>
        {score}
      </div>

      {/* DESCRIPTION */}

      <p className="text-xs text-zinc-500 mt-2">

        {getRiskDescription(level)}

      </p>

      {/* METRICS GRID */}

      <div className="grid grid-cols-2 gap-4 mt-5 text-sm">

        <div>

          <div className="text-zinc-500 text-xs">
            Entropy Load
          </div>

          <div className="font-semibold text-zinc-200">
            {entropy}
          </div>

        </div>

        <div>

          <div className="text-zinc-500 text-xs">
            Avg Session Length
          </div>

          <div className="font-semibold text-zinc-200">
            {sessionMinutes}m
          </div>

        </div>

      </div>

      {/* RISK BAR */}

      <div className="mt-5">

        <div className="text-xs text-zinc-500 mb-1">
          Burnout Pressure
        </div>

        <div className="h-2 bg-zinc-800 rounded">

          <div
            className={`h-2 rounded ${
              level==="high"
              ? "bg-red-500"
              : level==="moderate"
              ? "bg-yellow-500"
              : "bg-emerald-500"
            }`}
            style={{width:`${Math.min(score,100)}%`}}
          />

        </div>

      </div>

      {/* RECOMMENDATION */}

      {data.recommendation && (

        <div className="mt-5 pt-4 border-t border-zinc-800">

          <div className="text-xs text-zinc-500 mb-1">
            Recommendation
          </div>

          <div className="text-sm text-zinc-300 leading-relaxed">

            {data.recommendation}

          </div>

        </div>

      )}

    </div>

  );

}