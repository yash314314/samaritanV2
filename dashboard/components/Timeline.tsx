"use client";

import { useEffect, useRef, useState } from "react";
import { fetchTimeline, calendarApi } from "../lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  deep_work: "#8b5cf6",
  research: "#533196",
  communication: "#06b6d4",
  productivity: "#22c55e",
  media: "#f59e0b",
  entertainment: "#ec4899",
  development_tools: "#6366f1",
  system: "#71717a",
};

export default function Timeline({ userId, date }: any) {

  const [data,setData] = useState<any[]>([]);
  const [calendarEvents,setCalendarEvents] = useState<any[]>([]);
  const [tooltip,setTooltip] = useState<any>(null);
  const [zoom,setZoom] = useState(1);

  const zoomRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const tooltipPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const baseWidth = 1400;

  /* ---------------- FETCH DATA ---------------- */

  useEffect(()=>{
    fetchTimeline(userId,date).then(setData);
    // Fetch calendar events for the day to overlay on the timeline
    calendarApi.overlay(userId, date, date).then(setCalendarEvents).catch(()=>setCalendarEvents([]));
  },[userId,date]);

  useEffect(()=>{
    zoomRef.current = zoom;
  },[zoom]);

  /* ---------------- TIME CALCULATIONS ---------------- */

  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(date + "T23:59:59.999");

  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();

  const totalRange = endMs - startMs;

  /* ---------------- TOOLTIP POSITIONING (ref-driven, no re-render) ---------------- */

  const updateTooltipPos = () => {
    const el = tooltipElRef.current;
    if (!el) return;
    const { x, y } = tooltipPosRef.current;
    el.style.left = `${Math.min(x + 14, window.innerWidth - 260)}px`;
    el.style.top = `${Math.min(y + 14, window.innerHeight - 140)}px`;
  };

  const scheduleTooltipMove = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateTooltipPos();
    });
  };

  // Position the tooltip as soon as it mounts.
  useEffect(() => {
    if (tooltip) updateTooltipPos();
  }, [tooltip]);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  /* ---------------- CURSOR ZOOM ---------------- */

  function handleWheel(e:WheelEvent){

    if(!containerRef.current) return;

    e.preventDefault();

    const container = containerRef.current;

    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;

    const scrollLeft = container.scrollLeft;

    const oldZoom = zoomRef.current;
    const oldWidth = baseWidth * oldZoom;

    const cursorRatio =
      (scrollLeft + cursorX) / oldWidth;

    const newZoom =
      e.deltaY < 0
        ? Math.min(oldZoom + 0.25,10)
        : Math.max(oldZoom - 0.25,1);

    const newWidth = baseWidth * newZoom;

    setZoom(newZoom);

    requestAnimationFrame(()=>{

      if(!containerRef.current) return;

      const newScroll =
        (cursorRatio * newWidth) - cursorX;

      containerRef.current.scrollLeft = newScroll;

    });

  }

  useEffect(()=>{

    const el = containerRef.current;
    if(!el) return;

    const handler = (e:WheelEvent)=>handleWheel(e);

    el.addEventListener("wheel",handler,{passive:false});

    return ()=>el.removeEventListener("wheel",handler);

  },[]);

  /* ---------------- CLICK FOCUS ---------------- */

  function focusBlock(a:any){

    if(!containerRef.current) return;

    const start = new Date(a.start).getTime();

    const newZoom = Math.min(zoomRef.current + 2,10);
    const newWidth = baseWidth * newZoom;

    setZoom(newZoom);

    requestAnimationFrame(()=>{

      if(!containerRef.current) return;

      const position =
        ((start-startMs)/totalRange) * newWidth;

      const center =
        position - containerRef.current.clientWidth/2;

      containerRef.current.scrollTo({
        left:center,
        behavior:"smooth"
      });

    });

  }

  const timelineWidth = baseWidth * zoom;

  /* ---------------- UI ---------------- */
  function formatDuration(ms:number){

    const seconds = Math.floor(ms/1000);
    const minutes = Math.floor(ms/60000);
    const hours = Math.floor(ms/3600000);
  
    if(seconds < 60){
      return `${seconds}s`;
    }
  
    if(minutes < 60){
      return `${minutes}m`;
    }
  
    return `${hours}h ${minutes%60}m`;
  
  }
  return(

    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

      <h2 className="text-xs text-zinc-400 mb-3 uppercase">
        Timeline
      </h2>

      <div
        ref={containerRef}
        className="overflow-x-auto"
        onMouseMove={(e) => {
          tooltipPosRef.current = { x: e.clientX, y: e.clientY };
          scheduleTooltipMove();
        }}
      >

        <div style={{width:timelineWidth}} className="relative">

          {/* CALENDAR OVERLAY LAYER */}

          {calendarEvents.length > 0 && (
            <div className="relative h-6 mb-1">
              {calendarEvents.map((evt) => {
                const start = new Date(evt.start).getTime();
                const end = new Date(evt.end).getTime();

                const startClamped = Math.max(start, startMs);
                const endClamped = Math.min(end, endMs);

                const left = ((startClamped - startMs) / totalRange) * 100;
                const width = ((endClamped - startClamped) / totalRange) * 100;

                const minBlockWidthPercent = (2 / timelineWidth) * 100;
                const visibleWidth = Math.max(width, minBlockWidthPercent);

                return (
                  <div
                    key={evt.id}
                    onMouseEnter={() => setTooltip({ appName: "Calendar", items: [{ title: evt.title, duration: end - start }], category: "calendar", start: evt.start, end: evt.end, project: evt.project?.name })}
                    onMouseLeave={() => setTooltip(null)}
                    className="absolute h-full cursor-pointer rounded-sm flex items-center overflow-hidden"
                    style={{
                      left: `${left}%`,
                      width: `${visibleWidth}%`,
                      background: evt.color || "#8b5cf6",
                      opacity: 0.7,
                    }}
                  >
                    {zoom > 3 && visibleWidth > 3 && (
                      <span className="text-[9px] text-white px-1 truncate font-medium">
                        {evt.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ACTIVITY LAYER */}

          <div className="relative h-14 border border-zinc-700">

            {/* GRID */}

            <div className="absolute inset-0 flex pointer-events-none">

              {Array.from({length:24}).map((_,i)=>(
                <div
                  key={i}
                  className="flex-1 border-l border-zinc-700/20"
                />
              ))}

            </div>

            {/* BLOCKS */}

            {data.map((a,i)=>{

              const start = new Date(a.start).getTime();
              const end = new Date(a.end).getTime();

              const startClamped = Math.max(start,startMs);
              const endClamped = Math.min(end,endMs);

              const left =
                ((startClamped-startMs)/totalRange)*100;

              const width =
                ((endClamped-startClamped)/totalRange)*100;

                const minBlockWidthPercent = (2 / timelineWidth) * 100;
                const visibleWidth = Math.max(width, minBlockWidthPercent);

              const color =
                CATEGORY_COLORS[a.category] ?? "#6b7280";

              return(

                <div
                  key={i}
                  onMouseEnter={()=>setTooltip(a)}
                  onMouseLeave={()=>setTooltip(null)}
                  onClick={()=>focusBlock(a)}
                  className="absolute h-full cursor-pointer flex items-center"
                  style={{
                    left:`${left}%`,
                    width:`${visibleWidth}%`,
                    background:color,
                    opacity:0.85
                  }}
                >

                  {zoom > 3 && visibleWidth > 3 && (
                    <span className="text-[10px] text-white px-1 truncate">
                      {a.appName}
                    </span>
                  )}

                </div>

              )

            })}

          </div>

          {/* CATEGORY STRIP */}

          <div className="relative h-3 mt-2">

            {data.map((a,i)=>{

              const start=new Date(a.start).getTime();
              const end=new Date(a.end).getTime();

              const startClamped = Math.max(start,startMs);
              const endClamped = Math.min(end,endMs);

              const left =
                ((startClamped-startMs)/totalRange)*100;

              const width =
                ((endClamped-startClamped)/totalRange)*100;

              return(

                <div
                  key={i}
                  className="absolute h-full"
                  style={{
                    left:`${left}%`,
                    width: `${width}%`,
                    minWidth: width > 0 ? 1 : 0,
                    background:
                      CATEGORY_COLORS[a.category] ?? "#6b7280"
                  }}
                />

              )

            })}

          </div>

          {/* HOURS */}

          <div className="relative h-5 mt-2 text-[11px] text-zinc-500">

            {Array.from({length:24}).map((_,i)=>{

              const left = (i/24)*100;

              return(
                <span
                  key={i}
                  style={{
                    position:"absolute",
                    left:`${left}%`,
                    transform:"translateX(-50%)"
                  }}
                >
                  {i}:00
                </span>
              )

            })}

          </div>

        </div>

      </div>

      {/* TOOLTIP */}

      {tooltip && (

        <div
          ref={tooltipElRef}
          className="fixed bg-zinc-900 border border-zinc-700 text-xs p-3 rounded shadow-xl w-60 z-[9999]"
          style={{ left: 0, top: 0 }}
        >

          <div className="font-semibold mb-2">
            {tooltip.appName}
          </div>

          {tooltip.items?.map((item:any,i:number)=>(
            <div
              key={i}
              className="flex justify-between text-zinc-400"
            >
              <span>{item.title}</span>
              <span>{formatDuration(item.duration)}</span>
            </div>
          ))}

          <div className="mt-2 pt-2 border-t border-zinc-700 text-zinc-500">

            {tooltip.category && <div>Category: {tooltip.category}</div>}

            {tooltip.project && <div>Project: {tooltip.project}</div>}

            <div>
              Start: {new Date(tooltip.start).toLocaleTimeString()}
            </div>

            <div>
              End: {new Date(tooltip.end).toLocaleTimeString()}
            </div>

          </div>

        </div>

      )}

      {/* CATEGORY LEGEND */}

      <div className="flex flex-wrap gap-4 mt-4 text-xs text-zinc-400">

        {Object.entries(CATEGORY_COLORS).map(([key,color])=>(
          <div key={key} className="flex items-center gap-2">

            <div
              className="w-3 h-3"
              style={{background:color as string}}
            />

            <span>{key}</span>

          </div>
        ))}

      </div>

    </div>

  );

}