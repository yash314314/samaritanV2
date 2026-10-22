"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTimeline, calendarApi } from "../lib/api";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";
import { categoryTone, SAM_CATEGORY_ORDER } from "../lib/samaritanTheme";

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

  // Zoom 1 fits the container exactly; the ref serves the wheel handler,
  // which is registered once and would otherwise read a stale width.
  const [baseWidth, setBaseWidth] = useState(1400);
  const baseWidthRef = useRef(1400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      if (width > 0) {
        baseWidthRef.current = width;
        setBaseWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ---------------- FETCH DATA ---------------- */

  const loadTimeline = useCallback(async () => {
    const [timelineData, overlayData] = await Promise.all([
      fetchTimeline(userId, undefined, undefined, date),
      calendarApi.overlay(userId, date, date).catch(() => []),
    ]);

    setData(Array.isArray(timelineData) ? timelineData : []);
    setCalendarEvents(Array.isArray(overlayData) ? overlayData : []);
  }, [userId, date]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const [timelineData, overlayData] = await Promise.all([
        fetchTimeline(userId, undefined, undefined, date),
        calendarApi.overlay(userId, date, date).catch(() => []),
      ]);
      if (isMounted) {
        setData(Array.isArray(timelineData) ? timelineData : []);
        setCalendarEvents(Array.isArray(overlayData) ? overlayData : []);
      }
    };
    load().catch((err) => console.error("Timeline fetch failed:", err));
    return () => {
      isMounted = false;
    };
  }, [userId, date]);

  useRealtimeRefresh(loadTimeline, {
    events: [
      "activity:new",
      "session:metrics",
      "analytics:daily",
      "calendar:changed",
      "deepwork:started",
      "deepwork:ended",
      "deepwork:state",
    ],
    debounceMs: 500,
  });

  useEffect(()=>{
    zoomRef.current = zoom;
  },[zoom]);

  /* ---------------- TIME CALCULATIONS ---------------- */

  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();

  const totalRange = endMs - startMs;

  function visiblePosition(startValue: string | Date, endValue: string | Date) {
    const rawStart = new Date(startValue).getTime();
    const rawEnd = new Date(endValue).getTime();
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
    const start = Math.max(rawStart, startMs);
    const end = Math.min(rawEnd, endMs);
    if (end <= start) return null;
    const left = Math.max(0, Math.min(100, ((start - startMs) / totalRange) * 100));
    const width = Math.max(0, Math.min(100 - left, ((end - start) / totalRange) * 100));
    return { left, width, rawStart, rawEnd };
  }

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

    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();

    const container = containerRef.current;

    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;

    const scrollLeft = container.scrollLeft;

    const oldZoom = zoomRef.current;
    const oldWidth = baseWidthRef.current * oldZoom;

    const cursorRatio =
      (scrollLeft + cursorX) / oldWidth;

    const newZoom =
      e.deltaY < 0
        ? Math.min(oldZoom + 0.25,10)
        : Math.max(oldZoom - 0.25,1);

    const newWidth = baseWidthRef.current * newZoom;

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

    const start = Math.max(startMs, Math.min(endMs, new Date(a.start).getTime()));

    const newZoom = Math.min(zoomRef.current + 2,10);
    const newWidth = baseWidthRef.current * newZoom;

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
  // Thin the hour labels when an hour is narrower than a label.
  const hourWidth = timelineWidth / 24;
  const hourLabelStep = hourWidth >= 30 ? 1 : hourWidth >= 16 ? 2 : 3;

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
  const clock = (value: string) =>
    new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  return(

    <section className="flex w-full max-w-full flex-col">

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="sam-head">Timeline</h2>
        <span className="sam-key">Click a block or press Ctrl and scroll to zoom</span>
      </div>

      <div
        ref={containerRef}
        className="sam-scroll w-full max-w-full overflow-x-auto"
        onMouseMove={(e) => {
          tooltipPosRef.current = { x: e.clientX, y: e.clientY };
          scheduleTooltipMove();
        }}
      >

        <div style={{width:timelineWidth}} className="relative">

          {/* CALENDAR OVERLAY LAYER */}

          {calendarEvents.length > 0 && (
            <div className="relative mb-1 h-5 overflow-hidden">
              {calendarEvents.map((evt) => {
                const position = visiblePosition(evt.start, evt.end);
                if (!position) return null;

                const minBlockWidthPercent = (2 / timelineWidth) * 100;
                const visibleWidth = Math.min(100 - position.left, Math.max(position.width, minBlockWidthPercent));

                return (
                  <div
                    key={evt.id}
                    onMouseEnter={() => setTooltip({ appName: "Calendar", items: [{ title: evt.title, duration: position.rawEnd - position.rawStart }], category: "calendar", start: evt.start, end: evt.end, project: evt.project?.name })}
                    onMouseLeave={() => setTooltip(null)}
                    className="absolute flex h-full cursor-pointer items-center overflow-hidden border border-key"
                    style={{
                      left: `${position.left}%`,
                      width: `${visibleWidth}%`,
                    }}
                  >
                    {zoom > 3 && visibleWidth > 3 && (
                      <span className="truncate px-1 text-[10px] text-trace">
                        {evt.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ACTIVITY LAYER */}

          <div className="relative h-12 overflow-hidden border border-grid">

            {/* GRID */}

            <div className="pointer-events-none absolute inset-0 flex">

              {Array.from({length:24}).map((_,i)=>(
                <div
                  key={i}
                  className="flex-1 border-l border-track first:border-l-0"
                />
              ))}

            </div>

            {/* BLOCKS */}

            {data.map((a,i)=>{

              const position = visiblePosition(a.start, a.end);
              if (!position) return null;

              const minBlockWidthPercent = (2 / timelineWidth) * 100;
              const visibleWidth = Math.min(100 - position.left, Math.max(position.width, minBlockWidthPercent));
              const tone = categoryTone(a.category);

              return(

                <div
                  key={i}
                  onMouseEnter={()=>setTooltip(a)}
                  onMouseLeave={()=>setTooltip(null)}
                  onClick={()=>focusBlock(a)}
                  className="absolute flex h-full cursor-pointer items-center"
                  style={{
                    left:`${position.left}%`,
                    width:`${visibleWidth}%`,
                    background:tone,
                    // A void seam keeps adjacent blocks of similar colour apart.
                    boxShadow: "inset -1px 0 0 var(--sam-void)",
                  }}
                >

                  {zoom > 3 && visibleWidth > 3 && (
                    <span className="mx-1 truncate bg-void px-1 text-[10px] text-signal">
                      {a.appName}
                    </span>
                  )}

                </div>

              )

            })}

          </div>

          {/* HOURS */}

          <div className="relative mt-2 h-5 text-[11px] text-key">

            {Array.from({length:24}).map((_,i)=>{

              const left = (i/24)*100;
              if (i % hourLabelStep !== 0) return null;

              return(
                <span
                  key={i}
                  className="tabular-nums"
                  style={{
                    position:"absolute",
                    left:`${left}%`,
                    transform: i === 0 ? "none" : "translateX(-50%)"
                  }}
                >
                  {String(i).padStart(2, "0")}
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
          className="fixed z-[9999] w-64 border border-grid bg-void p-3 text-[11px]"
          style={{ left: 0, top: 0 }}
        >

          <div className="mb-2 truncate text-signal">
            [{tooltip.appName}]
          </div>

          {tooltip.items?.map((item:any,i:number)=>(
            <div
              key={i}
              className="flex justify-between gap-3 text-trace"
            >
              <span className="truncate">{item.title}</span>
              <span className="shrink-0 tabular-nums">{formatDuration(item.duration)}</span>
            </div>
          ))}

          <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 border-t border-grid pt-2">
            {tooltip.category && (<><dt className="sam-key">Category</dt><dd className="truncate text-trace">{String(tooltip.category).replaceAll("_", " ")}</dd></>)}
            {tooltip.project && (<><dt className="sam-key">Project</dt><dd className="truncate text-trace">{tooltip.project}</dd></>)}
            <dt className="sam-key">Time</dt>
            <dd className="tabular-nums text-trace">{clock(tooltip.start)}–{clock(tooltip.end)}</dd>
          </dl>

        </div>

      )}

      {/* CATEGORY LEGEND */}

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">

        {SAM_CATEGORY_ORDER.map((key)=>(
          <li key={key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5" style={{ background: categoryTone(key) }} />
            <span className="sam-key">{key.replaceAll("_", " ")}</span>
          </li>
        ))}

      </ul>

    </section>

  );

}
