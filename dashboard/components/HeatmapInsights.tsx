"use client";

function analyzeHeatmap(data:any){

  let bestHour = null;
  let bestScore = 0;

  let dayScores:Record<string,number> = {};

  Object.entries(data).forEach(([date,hours]:any)=>{

    let total = 0;

    Object.entries(hours).forEach(([hour,value]:any)=>{

      if(value > bestScore){

        bestScore = value;
        bestHour = hour;

      }

      total += value;

    });

    dayScores[date] = total;

  });

  const bestDay =
    Object.entries(dayScores)
      .sort((a:any,b:any)=>b[1]-a[1])[0]?.[0];

  return {bestHour,bestDay};

}

export default function HeatmapInsights({data}:any){

  const {bestHour,bestDay} = analyzeHeatmap(data);

  return(

    <div className="grid grid-cols-2 gap-6">

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

        <h2 className="text-sm text-zinc-300 mb-2">
          Peak Productivity Hour
        </h2>

        <div className="text-2xl text-purple-400 font-semibold">
          {bestHour}:00
        </div>

      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

        <h2 className="text-sm text-zinc-300 mb-2">
          Most Productive Day
        </h2>

        <div className="text-2xl text-purple-400 font-semibold">
          {new Date(bestDay).toLocaleDateString("en-IN",{weekday:"long"})}
        </div>

      </div>

    </div>

  );

}