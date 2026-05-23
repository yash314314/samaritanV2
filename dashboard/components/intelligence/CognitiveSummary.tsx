"use client";

function getTrendColor(value:number){

  if(value > 5) return "text-emerald-400";
  if(value < -5) return "text-red-400";

  return "text-yellow-400";

}

function getTrendIcon(value:number){

  if(value > 0) return "▲";
  if(value < 0) return "▼";

  return "•";

}

export default function CognitiveSummary({intel,compare}:any){

  if(!intel || !compare) return null;

  const drift = intel.driftScore ?? 0;
  const entropy = intel.entropyTrend ?? 0;
  const focusChange = compare.change ?? 0;

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-5">

        <h2 className="text-sm font-semibold text-zinc-300">
          Cognitive Performance
        </h2>

        <span className="text-xs text-zinc-500">
          Behavioral Signals
        </span>

      </div>

      {/* METRICS */}

      <div className="grid grid-cols-3 gap-6">

        <Metric
          label="Drift Score"
          value={drift}
          description="Measures decline in focus between sessions."
        />

        <Metric
          label="Entropy Trend"
          value={entropy}
          description="Indicates cognitive fragmentation patterns."
        />

        <Metric
          label="Focus Change"
          value={focusChange}
          description="Focus score variation compared to yesterday."
          highlight
        />

      </div>

    </div>

  );

}

function Metric({label,value,description,highlight}:any){

  const color = highlight
    ? getTrendColor(value)
    : "text-purple-400";

  const icon = highlight
    ? getTrendIcon(value)
    : null;

  return(

    <div className="flex flex-col space-y-1">

      <span className="text-xs text-zinc-500">
        {label}
      </span>

      <div className="flex items-center gap-2">

        {icon && (
          <span className={`text-xs ${color}`}>
            {icon}
          </span>
        )}

        <span className={`text-2xl font-semibold ${color}`}>
          {Number(value).toFixed(1)}
        </span>

      </div>

      <span className="text-[11px] text-zinc-500 leading-snug">

        {description}

      </span>

    </div>

  );

}