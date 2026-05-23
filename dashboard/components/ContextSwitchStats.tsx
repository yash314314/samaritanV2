"use client";

function formatDuration(seconds:number){

  if(!seconds || isNaN(seconds)) return "0m";

  const minutes = Math.floor(seconds/60);
  const hours = Math.floor(minutes/60);

  if(hours > 0){
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;

}

function getEntropyLevel(score:number){

  if(score > 70) return "High Fragmentation";
  if(score > 40) return "Moderate";
  return "Stable Focus";

}

function getEntropyColor(score:number){

  if(score > 70) return "text-red-400";
  if(score > 40) return "text-yellow-400";
  return "text-emerald-400";

}

export default function ContextSwitchStats({data}:any){

  if(!data) return null;

  const switches = data.totalSwitches ?? 0;
  const entropy = data.averageEntropyScore ?? 0;
  const idleSeconds = data.totalIdleSeconds ?? 0;
  const activeSeconds = data.totalActiveSeconds ?? 1;

  /* ---------- DERIVED METRICS ---------- */

  const hoursActive = activeSeconds / 3600;

  const switchRate =
    hoursActive > 0
      ? switches / hoursActive
      : 0;

  const entropyLabel = getEntropyLevel(entropy);
  const entropyColor = getEntropyColor(entropy);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Context Switching
        </h2>

        <span className={`text-xs ${entropyColor}`}>
          {entropyLabel}
        </span>

      </div>

      {/* METRICS */}

      <div className="space-y-4 text-sm">

        {/* SWITCH COUNT */}

        <div className="flex justify-between">

          <span className="text-zinc-400">
            Total Switches
          </span>

          <span className="text-zinc-200">
            {switches}
          </span>

        </div>

        {/* SWITCH RATE */}

        <div className="flex justify-between">

          <span className="text-zinc-400">
            Switch Rate
          </span>

          <span className="text-zinc-200">
            {switchRate.toFixed(1)} / hr
          </span>

        </div>

        {/* ENTROPY */}

        <div>

          <div className="flex justify-between mb-1">

            <span className="text-zinc-400">
              Entropy Score
            </span>

            <span className={entropyColor}>
              {entropy.toFixed(1)}
            </span>

          </div>

          <div className="w-full bg-zinc-800 h-2 rounded">

            <div
              className="bg-purple-500 h-2 rounded"
              style={{width:`${Math.min(entropy,100)}%`}}
            />

          </div>

        </div>

        {/* IDLE TIME */}

        <div className="flex justify-between">

          <span className="text-zinc-400">
            Idle Time
          </span>

          <span className="text-zinc-200">
            {formatDuration(idleSeconds)}
          </span>

        </div>

      </div>

      {/* INSIGHT */}

      <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500">

        High switching and entropy indicate fragmented attention.
        Lower values suggest sustained cognitive flow.

      </div>

    </div>

  );

}