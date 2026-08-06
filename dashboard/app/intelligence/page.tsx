"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, Loader2, Sparkles } from "lucide-react";

import AssistantInsights from "../../components/intelligence/AssistantInsights";
import BurnoutRiskPanel from "../../components/intelligence/BurnoutRiskPanel";
import CognitiveStabilityCard from "../../components/intelligence/CognitiveStabilityCard";
import CognitiveSummary from "../../components/intelligence/CognitiveSummary";
import EntropyTrendChart from "../../components/intelligence/EntropyTrendChart";
import GrowthTrendChart from "../../components/intelligence/GrowthTrendChart";
import IntentHeatmap from "../../components/intelligence/IntentHeatmap";
import PatternDetector from "../../components/intelligence/PatternDetector";
import PeakFocusCard from "../../components/intelligence/PeakFocusCard";
import PerformanceProbabilityCard from "../../components/intelligence/PerformanceProbabilityCard";
import {
  fetchBurnoutRisk,
  fetchDailyComparison,
  fetchGrowthTrend,
  fetchIntelligence,
  fetchIntentHeatmap,
} from "../../lib/api";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

function computePatterns(intel: any, intents: any[]) {
  if (!intel || !intents?.length) return null;

  const patterns = [];

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

  if (intel.fragmentationScore > 50) {
    patterns.push({
      type: "negative" as const,
      metric: "Fragmentation",
      condition: "Frequent context switches",
      impact: -18,
      confidence: 82,
      recommendation: "Group similar work together and reduce task switching.",
    });
  }

  if (intel.cognitiveStability > 70) {
    patterns.push({
      type: "positive" as const,
      metric: "Cognitive stability",
      condition: `${intel.cognitiveStability.toFixed(0)} stability`,
      impact: 16,
      confidence: 84,
      recommendation: "Use this window for demanding work.",
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
    } catch (error) {
      console.error("Intelligence load failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patterns = computePatterns(intel, intents?.intents || intents);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading intelligence diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
                <Sparkles className="h-6 w-6 text-purple-500" />
                Intelligence
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">Cognitive analytics and predictive insights</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <LayoutDashboard className="h-4 w-4" />
              <span>Samaritan AI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <CognitiveSummary intel={intel} compare={compare} />

        <div className="grid grid-cols-1 gap-6 auto-rows-[minmax(180px,auto)] md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <CognitiveStabilityCard data={intel} />
          </div>
          <div className="xl:col-span-4">
            <PeakFocusCard data={intel} />
          </div>
          <div className="xl:col-span-4">
            <PerformanceProbabilityCard data={intel} />
          </div>

          <div className="xl:col-span-8">
            <GrowthTrendChart data={growth} />
          </div>
          <div className="xl:col-span-4">
            <EntropyTrendChart data={growth} />
          </div>

          <div className="xl:col-span-4">
            <PatternDetector data={patterns} />
          </div>
          <div className="xl:col-span-4">
            <IntentHeatmap data={intents?.intents || intents} />
          </div>
          <div className="xl:col-span-4">
            <BurnoutRiskPanel data={burnout} />
          </div>

          <div className="xl:col-span-12">
            <AssistantInsights data={intel} />
          </div>
        </div>
      </div>
    </div>
  );
}
