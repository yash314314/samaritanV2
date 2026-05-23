"use client";

import { useState } from "react";
import {
  Code,
  BookOpen,
  MessageCircle,
  Brain,
  Video,
  Gamepad2,
  Search
} from "lucide-react";

/* ---------- INTENT ICON MAP ---------- */

const intentIcons:any = {
  coding: Code,
  debugging: Code,
  documentation: BookOpen,
  research: Search,
  reading: BookOpen,
  ai_assistance: Brain,
  chat: MessageCircle,
  social_media: MessageCircle,
  streaming: Video,
  video: Video,
  gaming: Gamepad2
};

/* ---------- COLOR SCALE ---------- */

function getColor(percent:number){

  if(percent > 70) return "bg-purple-600";
  if(percent > 50) return "bg-purple-500";
  if(percent > 30) return "bg-purple-400";
  if(percent > 15) return "bg-purple-300";
  return "bg-zinc-700";

}

/* ---------- TOOLTIP ---------- */

function Tooltip({intent,value,x,y}:any){

  return(

    <div
      className="fixed bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl w-56 z-[9999]"
      style={{top:y+12,left:x+12}}
    >

      <div className="flex items-center gap-2 mb-2">

        <div className="text-zinc-200 font-semibold capitalize">
          {intent.replace("_"," ")}
        </div>

      </div>

      <div className="text-zinc-400">
        Activity Share
      </div>

      <div className="text-purple-400 text-sm font-semibold">
        {value.toFixed(2)}%
      </div>

      <div className="text-zinc-500 mt-2 text-[11px]">
        Portion of total time spent in this cognitive intent.
      </div>

    </div>

  );

}

/* ---------- COMPONENT ---------- */

export default function IntentHeatmap({data}:any){

  const [tooltip,setTooltip] = useState<any>(null);

  if(!data) return null;

  /* ---------- NORMALIZE ---------- */

  let intents:any[]=[];

  if(Array.isArray(data)){
    intents=data;
  }else{
    intents=Object.entries(data).map(([intent,value]:any)=>({
      intent,
      percentage:value
    }));
  }

  intents.sort((a,b)=>b.percentage-a.percentage);

  const dominant=intents[0];

  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-6">

        <div>

          <h2 className="text-sm font-semibold text-zinc-300">
            Work Intent Heatmap
          </h2>

          <div className="text-xs text-zinc-500">
            Cognitive activity distribution
          </div>

        </div>

        {dominant &&(

          <div className="text-xs text-purple-400 capitalize">

            Dominant: {dominant.intent.replace("_"," ")}

          </div>

        )}

      </div>

      {/* HEATMAP */}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

        {intents.map((item:any)=>{

const percent = parseFloat(item.percentage ?? 0);

          const Icon =
            intentIcons[item.intent] || Brain;

          const color=getColor(percent);

          return(

            <div
              key={item.intent}

              className={`p-4 rounded-lg border border-zinc-800
              transition transform hover:scale-[1.04] hover:border-purple-500
              cursor-default ${color}`}

              onMouseEnter={(e)=>{

                setTooltip({
                  intent:item.intent,
                  value:percent,
                  x:e.clientX,
                  y:e.clientY
                });

              }}

              onMouseLeave={()=>setTooltip(null)}
            >

              <div className="flex items-center justify-between">

                <Icon size={16} className="text-white/80"/>

                <div className="text-xs text-white/70">
                  {percent.toFixed(2)}%
                </div>

              </div>

              <div className="text-sm font-medium text-white mt-3 capitalize">

                {item.intent.replace("_"," ")}

              </div>

              {/* progress */}

              <div className="mt-3 h-1 bg-black/30 rounded">

                <div
                  className="h-1 bg-white/60 rounded"
                  style={{width:`${percent}%`}}
                />

              </div>

            </div>

          );

        })}

      </div>

      {/* TOOLTIP */}

      {tooltip && <Tooltip {...tooltip}/>}

      {/* FOOTNOTE */}

      <div className="text-[11px] text-zinc-500 mt-5">

        Visualizes distribution of cognitive effort across work intents.

      </div>

    </div>

  );

}