"use client";

/* ---------- PERFORMANCE CLASSIFICATION ---------- */

function getPerformanceLevel(prob:number){

  if(prob >= 80){
    return {
      label:"Elite Performance",
      color:"text-emerald-400",
      description:"Your workflow strongly supports sustained deep focus."
    };
  }

  if(prob >= 60){
    return {
      label:"High Potential",
      color:"text-purple-400",
      description:"Your current work pattern frequently enables deep focus."
    };
  }

  if(prob >= 40){
    return {
      label:"Moderate",
      color:"text-yellow-400",
      description:"Focus potential exists but is disrupted by switching."
    };
  }

  return {
    label:"Low",
    color:"text-red-400",
    description:"Frequent fragmentation reduces deep focus probability."
  };

}

/* ---------- COMPONENT ---------- */

export default function PerformanceProbabilityCard({data}:any){

  if(!data) return null;

  const prob =
    Math.round((data.highPerformanceProbability ?? 0) * 100);

  const level = getPerformanceLevel(prob);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          High Performance Probability
        </h2>

        <span className={`text-xs ${level.color}`}>
          {level.label}
        </span>

      </div>

      {/* MAIN SCORE */}

      <div className={`text-4xl font-bold ${level.color}`}>
        {prob}%
      </div>

      <div className="text-xs text-zinc-500 mt-1">
        Probability of sustained deep focus sessions
      </div>

      {/* PROBABILITY BAR */}

      <div className="mt-5">

        <div className="flex justify-between text-xs text-zinc-500 mb-1">

          <span>Performance Likelihood</span>

          <span>{prob}%</span>

        </div>

        <div className="h-2 bg-zinc-800 rounded">

          <div
            className={`h-2 rounded ${
              prob >= 80
                ? "bg-emerald-500"
                : prob >= 60
                ? "bg-purple-500"
                : prob >= 40
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{width:`${prob}%`}}
          />

        </div>

      </div>

      {/* INTERPRETATION */}

      <div className="mt-4 text-xs text-zinc-500 leading-relaxed">
        {level.description}
      </div>

      {/* RECOMMENDATION */}

      {prob < 60 && (

        <div className="mt-4 pt-4 border-t border-zinc-800">

          <div className="text-xs text-zinc-500 mb-1">
            Recommendation
          </div>

          <div className="text-sm text-zinc-300">

            Reduce context switching and protect longer
            uninterrupted work blocks to increase
            high-performance session probability.

          </div>

        </div>

      )}

    </div>

  );

}