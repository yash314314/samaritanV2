"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  fetchDaily,
  fetchHeatmap,
  fetchDailyFocusTrend,
  fetchTimeline
} from "../lib/api";

import { useAppContext } from "../context/AppContext";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";
import RizeHomeDashboard from "@/components/RizeHomeDashboard";
import { getUserId } from "@/lib/auth";

const MemoRizeHomeDashboard = memo(RizeHomeDashboard);

export default function Home() {
  const { selectedDate } = useAppContext();

  const dateString = useMemo(
    () => selectedDate.toLocaleDateString("en-CA"),
    [selectedDate]
  );

  const [daily, setDaily] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [dailyFocusTrend, setDailyFocusTrend] = useState<any>(null);
  const [focusBucketMinutes, setFocusBucketMinutes] = useState(60);
  const [focusTrendLoading, setFocusTrendLoading] = useState(false);
  const hasLoadedFocusTrendRef = useRef(false);
  const focusTrendRequestIdRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    const [dailyData, heatmapData, timelineData] = await Promise.all([
      fetchDaily(getUserId(), dateString),
      fetchHeatmap(getUserId(), dateString),
      fetchTimeline(getUserId(), undefined, undefined, dateString)
    ]);

    setDaily(dailyData);
    setHeatmap(heatmapData);
    setTimeline(timelineData);
    setIsFirstLoad(false);
  }, [dateString]);

  const loadFocusTrend = useCallback(async () => {
    const requestId = ++focusTrendRequestIdRef.current;
    if (!hasLoadedFocusTrendRef.current) {
      setFocusTrendLoading(true);
    }
    try {
      const trend = await fetchDailyFocusTrend(
        getUserId(),
        dateString,
        focusBucketMinutes
      );

      if (requestId === focusTrendRequestIdRef.current) {
        setDailyFocusTrend(trend);
        hasLoadedFocusTrendRef.current = true;
      }
    } finally {
      if (requestId === focusTrendRequestIdRef.current) {
        setFocusTrendLoading(false);
      }
    }
  }, [dateString, focusBucketMinutes]);

  useEffect(() => {
    loadDashboard().catch((err) => console.error("Dashboard fetch failed:", err));
  }, [loadDashboard]);

  useEffect(() => {
    loadFocusTrend().catch((err) => console.error("Focus trend fetch failed:", err));
  }, [loadFocusTrend]);

  useRealtimeRefresh(
    () => Promise.all([loadDashboard(), loadFocusTrend()]).then(() => undefined),
    { debounceMs: 750 }
  );

  // Only block the whole view on the very first paint. On later date changes
  // we keep the previous data on screen and simply swap it in when ready —
  // this avoids unmounting/re-mounting every widget (and its chart) each time.
  const nothingLoadedYet = !daily && !heatmap;

  if (isFirstLoad && nothingLoadedYet) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading dashboard...
      </div>
    );
  }

  return (
    <MemoRizeHomeDashboard
      userId={getUserId()}
      date={dateString}
      daily={daily}
      heatmap={heatmap}
      timeline={timeline || []}
      focusTrend={dailyFocusTrend || []}
      focusBucketMinutes={focusBucketMinutes}
      onFocusBucketMinutesChange={setFocusBucketMinutes}
      focusTrendLoading={focusTrendLoading}
    />
  );
}
