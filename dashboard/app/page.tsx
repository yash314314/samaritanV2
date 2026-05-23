"use client";

import { useEffect, useState } from "react";
import {
  fetchDaily,
  fetchWeekly,
  fetchHeatmap,
  fetchIntelligence,
  fetchDailyComparison,
  fetchDailyFocusTrend,
  fetchTimeline
} from "../lib/api";

import { useAppContext } from "../context/AppContext";

import MetricsPanel from "../components/MetricsPanel";
import PeakWindow from "../components/PeakWindow";
import WeeklyChart from "../components/WeeklyChart";
import HeatmapGrid from "../components/HeatmapGrid";
import Timeline from "../components/Timeline";
import FocusTrendChart from "@/components/FocusTrendChart";
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

export default function Home() {
  const { selectedDate } = useAppContext();

  const [daily, setDaily] = useState<any>(null);
  const [weekly, setWeekly] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comparison,setComparison] = useState<any>(null);
  const [timeline,setTimeline] = useState(null);
  const [dailyFocusTrend,setDailyFocusTrend] = useState<any>(null);
  const [focusBucketMinutes, setFocusBucketMinutes] = useState(60);
  const [focusTrendLoading, setFocusTrendLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const dateString =
      selectedDate.toLocaleDateString("en-CA");
      
        const [dailyData ,weeklyData, heatmapData, intelData, comparisonData,timelineData] =
        await Promise.all([
          fetchDaily(USER_ID,dateString),
          fetchWeekly(USER_ID,dateString),
          fetchHeatmap(USER_ID,dateString),
          fetchIntelligence(USER_ID),
          fetchDailyComparison(USER_ID),fetchTimeline(USER_ID,dateString)
        ]);
     
      setDaily(dailyData);
      setWeekly(weeklyData);
      setHeatmap(heatmapData);
      setIntelligence(intelData);
      setComparison(comparisonData);
      setLoading(false);setTimeline(timelineData);
    }

    load();
  }, [selectedDate]);
  useEffect(() => {
    let alive = true;
  
    async function loadFocusTrend() {
      setFocusTrendLoading(true);
  
      const dateString =
        selectedDate.toLocaleDateString("en-CA");
  
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
  }, [selectedDate, focusBucketMinutes]);

  if (loading || !daily || !weekly || !heatmap || !intelligence || focusTrendLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
  
      {/* TOP TIMELINE */}
      <Timeline
        userId={USER_ID}
        date={selectedDate.toLocaleDateString("en-CA")}
      />
  
      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-6">
  
        {/* LEFT COLUMN */}
        <div className="col-span-3 space-y-6">
  
          <MetricsPanel
            daily={daily}
            intelligence={intelligence}
            timeline ={timeline}
          />
  
        </div>
  
        {/* RIGHT COLUMN */}
        <div className="col-span-9 space-y-6 min-w-0">
  
        <FocusTrendChart
  data={dailyFocusTrend || []}
  bucketMinutes={focusBucketMinutes}
  onBucketMinutesChange={setFocusBucketMinutes}
  isLoading={focusTrendLoading}
/>
  
          <HeatmapGrid data={heatmap} />
  
        </div>
  
      </div>
  
    </div>
  );
}