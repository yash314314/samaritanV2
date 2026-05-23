"use client";

/* ---------- FORMAT HOUR ---------- */

function formatHour(hour:number){

  if(hour === null || hour === undefined) return "N/A";

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;

  return `${normalized} ${suffix}`;

}

/* ---------- CLASSIFICATION ---------- */

function getFocusLevel(score:number){

  if(score > 85){
    return {
      label:"Elite Focus",
      color:"text-emerald-400",
      description:"Exceptional sustained concentration window."
    };
  }

  if(score > 70){
    return {
      label:"High Focus",
      color:"text-purple-400",
      description:"Strong cognitive stability and deep work potential."
    };
  }

  if(score > 50){
    return {
      label:"Moderate",
      color:"text-yellow-400",
      description:"Reasonable attention stability."
    };
  }

  return {
    label:"Low",
    color:"text-red-400",
    description:"Attention instability during this period."
  };

}

/* ---------- COMPONENT ---------- */

export default function PeakFocusCard({data}:any){

  if(!data) return null;

  const hour = data?.peakHour;
  const score = data?.peakFocusScore ?? 0;

  const level = getFocusLevel(score);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Peak Focus Window
        </h2>

        <span className={`text-xs ${level.color}`}>
          {level.label}
        </span>

      </div>

      {/* MAIN TIME */}

      <div className="text-4xl font-bold text-purple-400">

        {hour !== null ? formatHour(hour) : "N/A"}

      </div>

      <div className="text-xs text-zinc-500 mt-1">

        Highest sustained attention period

      </div>

      {/* FOCUS SCORE */}

      <div className="mt-5">

        <div className="flex justify-between text-xs text-zinc-500 mb-1">

          <span>Focus Strength</span>

          <span>{score.toFixed(1)}</span>

        </div>

        <div className="h-2 bg-zinc-800 rounded">

          <div
            className="h-2 bg-purple-500 rounded"
            style={{width:`${Math.min(score,100)}%`}}
          />

        </div>

      </div>

      {/* INTERPRETATION */}

      <div className="mt-4 text-xs text-zinc-500 leading-relaxed">

        {level.description}

      </div>

      {/* RECOMMENDATION */}

      {hour !== null && (

        <div className="mt-4 pt-4 border-t border-zinc-800">

          <div className="text-xs text-zinc-500 mb-1">
            Recommendation
          </div>

          <div className="text-sm text-zinc-300">

            Schedule deep work tasks around {formatHour(hour)} 
            to leverage your peak cognitive performance.

          </div>

        </div>

      )}

    </div>

  );

}