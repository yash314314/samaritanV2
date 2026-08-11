"use client";

import { useEffect, useMemo, useState, memo } from "react";
import {
  fetchDaily,
  fetchHeatmap,
  fetchDailyFocusTrend,
  fetchTimeline
} from "../lib/api";

import { useAppContext } from "../context/AppContext";

import MetricsPanel from "../components/MetricsPanel";
import HeatmapGrid from "../components/HeatmapGrid";
import Timeline from "../components/Timeline";
import FocusTrendChart from "@/components/FocusTrendChart";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

// Memoize heavy children so unrelated state changes (e.g. the focus-trend
// "loading" flag that toggles a couple of times a second during a refetch)
// don't re-render the expensive charts/grid.
const MemoMetricsPanel = memo(MetricsPanel);
const MemoHeatmapGrid = memo(HeatmapGrid);
const MemoFocusTrendChart = memo(FocusTrendChart);
const MemoTimeline = memo(Timeline);

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

  useEffect(() => {
    let alive = true;

    async function load() {
            const [dailyData, heatmapData, timelineData] = await Promise.all([
        fetchDaily(USER_ID, dateString),
        fetchHeatmap(USER_ID, dateString),
        fetchTimeline(USER_ID, dateString)
      ]);

      if (!alive) return;

      setDaily(dailyData);
      setHeatmap(heatmapData);
      setTimeline(timelineData);
      setIsFirstLoad(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [dateString]);

  useEffect(() => {
    let alive = true;

    async function loadFocusTrend() {
      setFocusTrendLoading(true);

      const trend = await fetchDailyFocusTrend(
        USER_ID,
        dateString,
        focusBucketMinutes
      );

      if (alive) {
        setDailyFocusTrend(trend);
        setFocusTrendLoading(false);
      }
    }

    loadFocusTrend();

    return () => {
      alive = false;
    };
  }, [dateString, focusBucketMinutes]);

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
    <div className="space-y-6">

      {/* TOP TIMELINE */}
      <MemoTimeline
        userId={USER_ID}
        date={dateString}
      />

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="col-span-3 space-y-6">

                    <MemoMetricsPanel daily={daily} timeline={timeline} />

        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-9 space-y-6 min-w-0">

          <MemoFocusTrendChart
            data={dailyFocusTrend || []}
            bucketMinutes={focusBucketMinutes}
            onBucketMinutesChange={setFocusBucketMinutes}
            isLoading={focusTrendLoading}
          />

          <MemoHeatmapGrid data={heatmap} />

        </div>

      </div>

    </div>
  );
}