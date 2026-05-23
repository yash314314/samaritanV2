"use client";

function getDriftState(score:number){

  if(score > 65){
    return {
      label:"High Decline",
      color:"text-red-400",
      description:
        "Focus deteriorates significantly between sessions."
    };
  }

  if(score > 40){
    return {
      label:"Moderate Drift",
      color:"text-yellow-400",
      description:
        "Some decline in attention stability detected."
    };
  }

  return {
    label:"Stable",
    color:"text-emerald-400",
    description:
      "Focus remains consistent across work sessions."
  };

}

export default function FocusDriftCard({intel}:any){

  if(!intel) return null;

  const drift = intel.driftScore ?? 0;

  const state = getDriftState(drift);

  const entropy = intel.entropyTrend ?? 0;

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Focus Drift
        </h2>

        <span className={`text-xs font-medium ${state.color}`}>
          {state.label}
        </span>

      </div>

      {/* MAIN SCORE */}

      <div className={`text-4xl font-bold ${state.color}`}>
        {drift.toFixed(1)}
      </div>

      {/* DESCRIPTION */}

      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
        {state.description}
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

      {/* SUPPORTING SIGNALS */}

      <div className="grid grid-cols-2 gap-4 mt-5 text-sm">

        <div>

          <div className="text-zinc-500 text-xs">
            Entropy Trend
          </div>

          <div className="text-zinc-200 font-semibold">
            {entropy.toFixed(1)}
          </div>

        </div>

        <div>

          <div className="text-zinc-500 text-xs">
            Stability Index
          </div>

          <div className="text-zinc-200 font-semibold">
            {(100-drift).toFixed(1)}
          </div>

        </div>

      </div>

      {/* RECOMMENDATION */}

      {drift > 50 && (

        <div className="mt-5 pt-4 border-t border-zinc-800">

          <div className="text-xs text-zinc-500 mb-1">
            Recommendation
          </div>

          <div className="text-sm text-zinc-300 leading-relaxed">

            Focus decline detected between sessions. Consider shorter
            work cycles or structured breaks to stabilize attention.

          </div>

        </div>

      )}

    </div>

  );

}