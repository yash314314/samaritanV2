"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Shield, Timer, Zap } from "lucide-react";

import DeepWorkActiveOverlay from "@/components/focus/DeepWorkActiveOverlay";
import DeepWorkConfigModal from "@/components/focus/DeepWorkConfigModal";
import DeepWorkExtensionPrompt from "@/components/focus/DeepWorkExtensionPrompt";
import DeepWorkHistoryCard from "@/components/focus/DeepWorkHistoryCard";
import DeepWorkReadinessCard from "@/components/focus/DeepWorkReadinessCard";
import DeepWorkResultPanel from "@/components/focus/DeepWorkResultPanel";
import { focusApi } from "@/lib/api";
import { getWsClient } from "@/lib/ws";
import { useInterventionAlerts, useLiveDeepWork } from "@/lib/useWs";

type FocusConfig = {
  goal?: string;
  plannedMinutes: number;
  enforcement: "observe" | "warn" | "block" | "require_reason";
  allowedApps?: string[];
  allowedDomains?: string[];
  blockedApps?: string[];
  blockedDomains?: string[];
};

type ModalFocusConfig = Omit<FocusConfig, "enforcement"> & {
  enforcement: string;
};

function normalizeEnforcement(value: string): FocusConfig["enforcement"] {
  if (value === "observe" || value === "warn" || value === "block" || value === "require_reason") {
    return value;
  }
  return "warn";
}

function computeProtocolReadiness(activeSession: any, history: any[]) {
  if (activeSession) {
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(activeSession.startedAt).getTime()) / 60000
    );
    return {
      score: 0,
      factors: {
        timeOfDay: 0,
        recentPattern: 0,
        burnoutRisk: 0,
        lastSessionQuality: 0,
      },
      recommendedDuration: activeSession.plannedMinutes || 60,
      bestWindow: null,
      riskFactors: [],
      activeDeepWork: {
        goal: activeSession.goal,
        plannedMinutes: activeSession.plannedMinutes,
        remainingMinutes: Math.max(0, (activeSession.plannedMinutes || 0) - elapsedMinutes),
      },
    };
  }

  const recent = history.filter((session) => session.status !== "active").slice(0, 5);
  const completionRate = recent.length
    ? (recent.filter((session) => session.status === "completed").length / recent.length) * 100
    : 0;
  const avgFocus = recent.length
    ? recent.reduce((sum, session) => sum + (session.finalFocusScore ?? session.focusScore ?? 0), 0) / recent.length
    : 0;

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour >= 9 && hour <= 11 ? 85 : hour >= 14 && hour <= 17 ? 75 : hour >= 7 && hour <= 21 ? 60 : 30;
  const recentPattern = Math.round((completionRate + avgFocus) / 2);
  const score = recent.length
    ? Math.round((timeOfDay + recentPattern + 75 + avgFocus) / 4)
    : 0;

  const riskFactors: string[] = [];
  if (completionRate < 50 && recent.length >= 3) riskFactors.push("Recent sessions were often abandoned");
  if (avgFocus < 50 && recent.length > 0) riskFactors.push("Recent focus scores are low");
  if (hour < 7 || hour > 22) riskFactors.push("Off-hours focus block");

  return {
    score,
    factors: {
      timeOfDay,
      recentPattern,
      burnoutRisk: 75,
      lastSessionQuality: Math.round(avgFocus),
    },
    recommendedDuration: score >= 75 ? 90 : score >= 50 ? 60 : 30,
    bestWindow: score >= 50 ? { start: 9, end: 12 } : null,
    riskFactors,
    activeDeepWork: null,
  };
}

export default function FocusPage() {
  const liveDeepWork = useLiveDeepWork();
  const interventionAlerts = useInterventionAlerts();

  const [configOpen, setConfigOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingConfig, setPendingConfig] = useState<FocusConfig | null>(null);
  const [extensionPrompt, setExtensionPrompt] = useState<{ sessionId: string; planned: number; actual: number; goal: string } | null>(null);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        focusApi.getActive(),
        focusApi.getHistory(),
      ]);
      setActiveSession(activeRes.data || null);
      setHistory(historyRes.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeSession?.id) return;
    const client = getWsClient();
    client.subscribeToDeepWork(activeSession.id);
    return () => client.unsubscribeFromDeepWork(activeSession.id);
  }, [activeSession?.id]);

  useEffect(() => {
    if (liveDeepWork.active && liveDeepWork.sessionId) {
      setActiveSession((prev: any) => ({
        ...(prev || {}),
        id: liveDeepWork.sessionId,
        goal: liveDeepWork.goal,
        startedAt: liveDeepWork.startedAt ?? prev?.startedAt ?? new Date().toISOString(),
        plannedMinutes: liveDeepWork.plannedMinutes,
        enforcement: liveDeepWork.enforcement,
        focusScore: liveDeepWork.focusScore,
        productivityScore: liveDeepWork.productivityScore,
        violationCount: liveDeepWork.violationCount,
        productiveMs: liveDeepWork.productiveMs,
        distractionMs: liveDeepWork.distractionMs,
        idleMs: liveDeepWork.idleMs,
        interruptionMs: liveDeepWork.interruptionMs,
      }));
      return;
    }

    if (liveDeepWork.sessionId && !liveDeepWork.active) {
      setActiveSession((prev: any) => prev?.id === liveDeepWork.sessionId ? null : prev);
      load();
    }
  }, [
    liveDeepWork.active,
    liveDeepWork.sessionId,
    liveDeepWork.goal,
    liveDeepWork.startedAt,
    liveDeepWork.plannedMinutes,
    liveDeepWork.enforcement,
    liveDeepWork.focusScore,
    liveDeepWork.productivityScore,
    liveDeepWork.violationCount,
    liveDeepWork.productiveMs,
    liveDeepWork.distractionMs,
    liveDeepWork.idleMs,
    liveDeepWork.interruptionMs,
    load,
  ]);

  useEffect(() => {
    if (!activeSession) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const res = await focusApi.getActiveStatus();
      if (res.data?.active && res.data.session) {
        setActiveSession((prev: any) => ({ ...(prev || {}), ...res.data.session }));
      } else {
        setActiveSession(null);
        load();
      }
    }, 15000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeSession?.id, load]);

  const handleStartConfig = async (config: ModalFocusConfig) => {
    try {
      const payload: FocusConfig = {
        ...config,
        enforcement: normalizeEnforcement(config.enforcement),
      };
      const res = await focusApi.start(payload);
      setPendingConfig(payload);
      setActiveSession(res.data);
      setConfigOpen(false);
      await load();
    } catch (err) {
      console.error("Failed to start deep work session:", err);
    }
  };

  const finishSession = async (id: string, status: "completed" | "abandoned") => {
    // The session may have already auto-completed/expired on the backend
    // (timer or external end). End it if possible, but never let that block the
    // rest of the flow — otherwise the overlay can get stuck.
    try {
      await focusApi.end(id, status);
    } catch (err) {
      console.warn("Session end failed (may have already ended):", err);
    }

    setActiveSession(null);
    await load();

    // Fetch the result; fall back to the history item if the result endpoint
    // isn't available (e.g. it was already cleaned up).
    let session: any = null;
    try {
      const res = await focusApi.getResult(id);
      session = res.data?.session || res.data || null;
    } catch (err) {
      console.warn("Session result unavailable, falling back to history:", err);
      const ended = history.find((h) => h.id === id);
      session = ended || null;
    }

    if (!session) {
      setResultSessionId(id);
      return;
    }

    const actualMin = session.endedAt
      ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
      : 0;

    if (status === "abandoned" || actualMin < session.plannedMinutes * 0.8) {
      setExtensionPrompt({
        sessionId: id,
        planned: session.plannedMinutes,
        actual: actualMin,
        goal: session.goal || "Deep work session",
      });
    } else {
      setResultSessionId(id);
    }
  };

  const handleExtend = async (extraMinutes: number) => {
    try {
      const baseConfig = pendingConfig || {
        goal: extensionPrompt?.goal || "Extended session",
        enforcement: "warn",
        allowedApps: [],
        allowedDomains: [],
        blockedApps: [],
        blockedDomains: [],
      };

      const res = await focusApi.start({
        ...baseConfig,
        goal: baseConfig.goal || extensionPrompt?.goal || "Extended session",
        plannedMinutes: extraMinutes,
      } as FocusConfig);

      setActiveSession(res.data);
      setExtensionPrompt(null);
      await load();
    } catch (err) {
      console.error("Failed to extend session:", err);
    }
  };

  const readiness = computeProtocolReadiness(activeSession, history);

  const hasAnything = !!(activeSession || history.length > 0);

  // Only block the very first paint before anything has loaded. Once some data
  // exists we keep showing the last content while refreshes happen in the
  // background (via websocket + the 15s status poll) — no more blank flashes.
  if (loading && !hasAnything) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading focus protocol...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10">
            <Timer className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Focus Protocol</h1>
            <p className="text-sm text-zinc-500">
              Configure, enforce, and review protected deep-work sessions
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfigOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/15 px-4 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-500/25"
        >
          <Zap className="h-4 w-4" />
          New Session
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <DeepWorkReadinessCard data={readiness} onOpenConfig={() => setConfigOpen(true)} />
        </div>
        <div className="xl:col-span-4">
          <EnforcementGuide />
        </div>
        <div className="xl:col-span-4">
          <DeepWorkHistoryCard sessions={history} onViewResult={setResultSessionId} />
        </div>
      </div>

      <DeepWorkConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onStart={handleStartConfig}
        defaultDuration={readiness.recommendedDuration || 60}
      />

      {activeSession && (
        <DeepWorkActiveOverlay
          session={activeSession}
          liveState={liveDeepWork}
          interventions={interventionAlerts.alerts}
          onDismissIntervention={interventionAlerts.dismiss}
          onComplete={(id) => finishSession(id, "completed")}
          onAbandon={(id) => finishSession(id, "abandoned")}
        />
      )}

      {extensionPrompt && (
        <DeepWorkExtensionPrompt
          plannedMinutes={extensionPrompt.planned}
          actualMinutes={extensionPrompt.actual}
          goal={extensionPrompt.goal}
          onExtend={handleExtend}
          onBreak={() => {
            setResultSessionId(extensionPrompt.sessionId);
            setExtensionPrompt(null);
          }}
        />
      )}

      {resultSessionId && (
        <DeepWorkResultPanel
          sessionId={resultSessionId}
          onClose={() => setResultSessionId(null)}
          onStartAnother={() => {
            setResultSessionId(null);
            setConfigOpen(true);
          }}
        />
      )}
    </div>
  );
}

function EnforcementGuide() {
  const levels = [
    { label: "Observe", value: "observe", detail: "Log distractions without interrupting you." },
    { label: "Warn", value: "warn", detail: "Show a warning notification and dashboard alert." },
    { label: "Require Reason", value: "require_reason", detail: "Ask for justification and record the reason without killing apps." },
    { label: "Block", value: "block", detail: "Terminate violating apps after the desktop tracker confirms the active process." },
  ];

  return (
    <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-rose-400" />
        <h2 className="text-sm font-semibold text-zinc-300">Enforcement Levels</h2>
      </div>
      <div className="space-y-3">
        {levels.map((level) => (
          <div key={level.value} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs font-semibold text-zinc-200">{level.label}</div>
            <div className="mt-1 text-xs text-zinc-500">{level.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
