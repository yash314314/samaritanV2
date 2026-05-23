"use client";

function getDriftLevel(score:number){

  if(score > 65) return "High";
  if(score > 40) return "Moderate";

  return "Low";

}

function getColor(score:number){

  if(score > 65) return "text-red-400";
  if(score > 40) return "text-yellow-400";

  return "text-emerald-400";

}

function getDescription(score:number){

  if(score > 65)
    return "Focus deteriorates significantly between sessions.";

  if(score > 40)
    return "Some cognitive drift detected during workflow.";

  return "Focus remains relatively stable across sessions.";

}

export default function DriftScoreCard({data}:any){

  if(!data) return null;

  const drift = data?.driftScore ?? 0;

  const level = getDriftLevel(drift);

  const color = getColor(drift);

  const description = getDescription(drift);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Cognitive Drift
        </h2>

        <span className={`text-xs font-medium ${color}`}>
          {level}
        </span>

      </div>

      {/* SCORE */}

      <div className={`text-4xl font-bold ${color}`}>
        {drift.toFixed(1)}
      </div>

      {/* DESCRIPTION */}

      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">

        {description}

      </p>

      {/* DRIFT BAR */}

      <div className="mt-5">

        <div className="text-xs text-zinc-500 mb-1">
          Stability Loss
        </div>

        <div className="h-2 bg-zinc-800 rounded">

          <div
            className={`h-2 rounded ${
              drift > 65
                ? "bg-red-500"
                : drift > 40
                ? "bg-yellow-500"
                : "bg-emerald-500"
            }`}
            style={{width:`${Math.min(drift,100)}%`}}
          />

        </div>

      </div>

      {/* RECOMMENDATION */}

      {drift > 50 && (

        <div className="mt-5 pt-4 border-t border-zinc-800">

          <div className="text-xs text-zinc-500 mb-1">
            Recommendation
          </div>

          <div className="text-sm text-zinc-300">

            Frequent focus decline detected. Consider shorter work cycles
            or structured breaks to maintain cognitive stability.

          </div>

        </div>

      )}

    </div>

  );

}