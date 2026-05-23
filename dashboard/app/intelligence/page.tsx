"use client";

import { useEffect, useState, useCallback } from "react";
import { LayoutDashboard, Sparkles, Loader2 } from "lucide-react";

import CognitiveSummary from "../../components/intelligence/CognitiveSummary";
import CognitiveStabilityCard from "../../components/intelligence/CognitiveStabilityCard";
import PeakFocusCard from "../../components/intelligence/PeakFocusCard";
import PerformanceProbabilityCard from "../../components/intelligence/PerformanceProbabilityCard";
import DeepWorkReadinessCard from "../../components/intelligence/DeepWorkReadinessCard";
import PatternDetector from "../../components/intelligence/PatternDetector";
import GrowthTrendChart from "../../components/intelligence/GrowthTrendChart";
import EntropyTrendChart from "../../components/intelligence/EntropyTrendChart";
import IntentHeatmap from "../../components/intelligence/IntentHeatmap";
import BurnoutRiskPanel from "../../components/intelligence/BurnoutRiskPanel";
import AssistantInsights from "../../components/intelligence/AssistantInsights";

import {
  fetchIntelligence,
  fetchDailyComparison,
  fetchGrowthTrend,
  fetchBurnoutRisk,
  fetchIntentHeatmap,
} from "../../lib/api";
import { focusApi } from "../../lib/api";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

// Compute readiness from available data
function computeReadiness(intel: any, burnout: any, compare: any) {
  if (!intel || !burnout) return null;

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  
  // Time of day factor (peak hours 9-11, 14-16)
  const timeFactor = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16) ? 85 :
                     (hour >= 7 && hour <= 18) ? 60 : 30;

  // Recent pattern from comparison
  const recentPattern = compare?.change > 0 ? 75 : compare?.change < -10 ? 35 : 55;

  // Burnout buffer (inverted risk)
  const burnoutScore = burnout.burnoutScore ?? 0;
  const burnoutFactor = burnoutScore > 70 ? 20 : burnoutScore > 40 ? 50 : 85;

  // Last session quality (from deep work ratio)
  const lastSession = intel.deepWorkRatio ?? 0;
  const lastFactor = lastSession > 40 ? 80 : lastSession > 20 ? 55 : 30;

  const score = Math.round((timeFactor + recentPattern + burnoutFactor + lastFactor) / 4);

  return {
    score,
    factors: {
      timeOfDay: timeFactor,
      recentPattern,
      burnoutRisk: burnoutFactor,
      lastSessionQuality: lastFactor,
    },
    recommendedDuration: score >= 75 ? 90 : score >= 50 ? 60 : score >= 25 ? 30 : 0,
    bestWindow: score >= 50 ? { start: 9, end: 12 } : null,
    riskFactors: burnoutScore > 60 ? ["Elevated burnout risk detected"] : 
                 intel.fragmentationScore > 50 ? ["High fragmentation recently"] : [],
  };
}

// Compute patterns from intel data
function computePatterns(intel: any, intents: any[]) {
  if (!intel || !intents?.length) return null;

  const patterns = [];
  
  // Example pattern: communication vs focus correlation
  if (intel.communicationRatio > 30 && intel.focusScore < 70) {
    patterns.push({
      type: "negative" as const,
      metric: "High communication",
      condition: "Focus < 70%",
      impact: -15,
      confidence: 78,
      recommendation: "Batch communications into 2 blocks/day to protect focus.",
    });
  }

  if (intel.deepWorkRatio > 30) {
    patterns.push({
      type: "positive" as const,
      metric: "Deep work blocks",
      condition: "Ratio > 30%",
      impact: 22,
      confidence: 85,
      recommendation: "Maintain current block scheduling. Consider extending by 15 min.",
    });
  }

  const top = intents[0];
  const bottom = intents[intents.length - 1];

  return {
    patterns,
    topPerformer: top ? { intent: top.intent, avgFocus: top.avgFocus ?? 75, hours: Math.round(top.percentage / 10) } : null,
    worstPerformer: bottom ? { intent: bottom.intent, avgFocus: bottom.avgFocus ?? 45, hours: Math.round(bottom.percentage / 10) } : null,
    timeOfDayWinner: intel.peakHour !== null ? { hour: intel.peakHour, avgFocus: intel.peakFocusScore ?? 80 } : null,
  };
}

export default function IntelligencePage() {
  const [intel, setIntel] = useState<any>(null);
  const [compare, setCompare] = useState<any>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [burnout, setBurnout] = useState<any>(null);
  const [intents, setIntents] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [intelData, compareData, growthData, burnoutData, intentData] = await Promise.all([
        fetchIntelligence(USER_ID),
        fetchDailyComparison(USER_ID),
        fetchGrowthTrend(USER_ID),
        fetchBurnoutRisk(USER_ID),
        fetchIntentHeatmap(USER_ID),
      ]);
      setIntel(intelData);
      setCompare(compareData);
      setGrowth(growthData);
      setBurnout(burnoutData);
      setIntents(intentData);
    } catch (e) {
      console.error("Intelligence load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const readiness = computeReadiness(intel, burnout, compare);
  const patterns = computePatterns(intel, intents?.intents || intents);

  const handleStartSession = async (duration: number) => {
    await focusApi.start({
      plannedMinutes: duration,
      enforcement: "warn",
      goal: "Deep work from intelligence dashboard",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading intelligence diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                Intelligence
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">Cognitive analytics & predictive insights</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <LayoutDashboard className="w-4 h-4" />
              <span>Samaritan AI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Header */}
        <CognitiveSummary intel={intel} compare={compare} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6 auto-rows-[minmax(180px,auto)]">
          
          {/* ROW 1: Core Metrics */}
          <div className="xl:col-span-3">
            <DeepWorkReadinessCard data={readiness} onStartSession={handleStartSession} />
          </div>

          <div className="xl:col-span-3">
            <CognitiveStabilityCard data={intel} />
          </div>

          <div className="xl:col-span-3">
            <PeakFocusCard data={intel} />
          </div>

          <div className="xl:col-span-3">
            <PerformanceProbabilityCard data={intel} />
          </div>

          {/* ROW 2: Trends + Patterns */}
          <div className="xl:col-span-8">
            <GrowthTrendChart data={growth} />
          </div>

          <div className="xl:col-span-4">
            <EntropyTrendChart data={growth} />
          </div>

          {/* ROW 3: Intent + Burnout + Patterns */}
          <div className="xl:col-span-4">
            <PatternDetector data={patterns} />
          </div>

          <div className="xl:col-span-4">
            <IntentHeatmap data={intents?.intents || intents} />
          </div>

          <div className="xl:col-span-4">
            <BurnoutRiskPanel data={burnout} />
          </div>

          {/* ROW 4: AI Insights */}
          <div className="xl:col-span-12">
            <AssistantInsights data={{ ...intel, readinessScore: readiness?.score }} />
          </div>
        </div>
      </div>
    </div>
  );
}