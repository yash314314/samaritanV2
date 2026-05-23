"use client";

function buildInsights(data:any){

  const insights:string[] = [];

  if(data.productivityScore > 80)
    insights.push("High productivity pattern detected today.");

  if(data.deepWorkRatio < 25)
    insights.push("Deep work ratio is low. Consider scheduling uninterrupted work blocks.");

  if(data.fragmentationScore > 60)
    insights.push("Frequent context switching detected. Batch similar tasks.");

  if(data.communicationRatio > 40)
    insights.push("Communication tasks are dominating your workflow.");

  if(data.energyScore < -0.3)
    insights.push("Energy drain detected. A short recovery break may improve performance.");

  if(data.avgFocusBlockMinutes > 0)
    insights.push(`Average deep work block: ${data.avgFocusBlockMinutes} minutes.`);

  return insights.slice(0,5);

}

export default function AssistantInsights({data}:any){

  if(!data) return null;

  const insights = buildInsights(data);

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-sm font-semibold text-zinc-300">
          Samaritan Insights
        </h2>

        <span className="text-xs text-zinc-500">
          AI Analysis
        </span>

      </div>

      {/* INSIGHT LIST */}

      <ul className="space-y-3 text-sm">

        {insights.map((insight,i)=>(
          
          <li
            key={i}
            className="flex items-start gap-2 text-zinc-400"
          >

            <span className="text-purple-400 mt-[2px]">
              ●
            </span>

            <span>{insight}</span>

          </li>

        ))}

      </ul>

      {/* SUGGESTION */}

      {data.suggestion && (

        <div className="mt-4 pt-4 border-t border-zinc-800">

          <div className="text-xs text-zinc-500 mb-1">
            Recommendation
          </div>

          <div className="text-sm text-zinc-300">
            {data.suggestion}
          </div>

        </div>

      )}

    </div>

  );

}