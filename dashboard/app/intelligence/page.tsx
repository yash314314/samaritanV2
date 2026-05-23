"use client";

import { useEffect, useState } from "react";

import CognitiveSummary from "../../components/intelligence/CognitiveSummary";
import DriftScoreCard from "../../components/intelligence/DriftScoreCard";
import FocusDriftCard from "../../components/intelligence/FocusDriftCard";
import PeakFocusCard from "../../components/intelligence/PeakFocusCard";
import PerformanceProbabilityCard from "../../components/intelligence/PerformanceProbability";
import IntentHeatmap from "../../components/intelligence/IntentHeatmap";
import GrowthTrendChart from "../../components/intelligence/GrowthTrendChart";
import EntropyTrendChart from "../../components/intelligence/EntropyTrendCard";
import BurnoutRiskPanel from "../../components/intelligence/BurnoutRiskPanel";
import AssistantInsights from "../../components/intelligence/AssistantInsights";

import {
fetchIntelligence,
fetchDailyComparison,
fetchGrowthTrend,
fetchBurnoutRisk,
fetchIntentHeatmap
} from "../../lib/api";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

export default function IntelligencePage(){

const [intel,setIntel] = useState<any>(null);
const [compare,setCompare] = useState<any>(null);
const [growth,setGrowth] = useState<any>(null);
const [burnout,setBurnout] = useState<any>(null);
const [intents,setIntents] = useState<any>(null);

const [loading,setLoading] = useState(true);

useEffect(()=>{


async function load(){

  setLoading(true);

  const [
    intelData,
    compareData,
    growthData,
    burnoutData,
    intentData
  ] = await Promise.all([

    fetchIntelligence(USER_ID),
    fetchDailyComparison(USER_ID),
    fetchGrowthTrend(USER_ID),
    fetchBurnoutRisk(USER_ID),
    fetchIntentHeatmap(USER_ID)

  ]);

  setIntel(intelData);
  setCompare(compareData);
  setGrowth(growthData);
  setBurnout(burnoutData);
  setIntents(intentData);

  setLoading(false);

}

load();


},[]);

if(loading){


return(

  <div className="flex items-center justify-center h-64 text-zinc-500">
    Loading intelligence diagnostics...
  </div>

);


}
return (

  <div className="space-y-6">
  
    {/* SUMMARY */}
  
    <CognitiveSummary
      intel={intel}
      compare={compare}
    />
  
    {/* INTELLIGENCE GRID */}
  
    <div className="
      grid
      grid-cols-1
      md:grid-cols-2
      xl:grid-cols-12
      gap-6
      auto-rows-[minmax(180px,auto)]
      grid-flow-dense
    ">
  
      {/* PRIMARY METRICS */}
  
      <div className="xl:col-span-3">
        <DriftScoreCard data={intel}/>
      </div>
  
      <div className="xl:col-span-3">
        <FocusDriftCard intel={intel}/>
      </div>
  
      <div className="xl:col-span-3">
        <PeakFocusCard data={intel}/>
      </div>
  
      <div className="xl:col-span-3">
        <PerformanceProbabilityCard data={intel}/>
      </div>
  
      {/* GROWTH TREND */}
  
      <div className="xl:col-span-8">
        <GrowthTrendChart data={growth}/>
      </div>
  
      {/* ENTROPY */}
  
      <div className="xl:col-span-4">
        <EntropyTrendChart data={growth}/>
      </div>
  
      {/* INTENT HEATMAP */}
  
      <div className="xl:col-span-7">
        <IntentHeatmap data={intents}/>
      </div>
  
      {/* BURNOUT */}
  
      <div className="xl:col-span-5">
        <BurnoutRiskPanel data={burnout}/>
      </div>
  
      {/* AI INSIGHTS */}
  
      <div className="xl:col-span-12">
        <AssistantInsights/>
      </div>
  
    </div>
  
  </div>
  
  );
}
