"use client";

import { useEffect, useState, useCallback } from "react";
import { getWsClient, useWsMessage, useWsState, useWsConnect } from "@/lib/ws";

// ═══════════════════════════════════════════════════════════════════════
// DEEP WORK LIVE SESSION HOOK (replaces useActiveSession polling)
// ═══════════════════════════════════════════════════════════════════════

export interface LiveDeepWorkState {
  active: boolean;
  sessionId: string | null;
  goal: string | null;
  startedAt: string | null;
  plannedMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  enforcement: string;
  focusScore: number;
  productivityScore: number;
  violationCount: number;
  productiveMs: number;
  distractionMs: number;
  idleMs: number;
  interruptionMs: number;
  minuteLogs: Array<{
    minute: number;
    focusScore: number;
    productivityScore: number;
    distraction: boolean;
    idle: boolean;
    appName: string | null;
  }>;
}

export function useLiveDeepWork() {
  const [state, setState] = useState<LiveDeepWorkState>({
    active: false,
    sessionId: null,
    goal: null,
    startedAt: null,
    plannedMinutes: 0,
    elapsedMinutes: 0,
    remainingMinutes: 0,
    enforcement: "warn",
    focusScore: 0,
    productivityScore: 0,
    violationCount: 0,
    productiveMs: 0,
    distractionMs: 0,
    idleMs: 0,
    interruptionMs: 0,
    minuteLogs: [],
  });

  const client = getWsClient();

  useWsMessage("deepwork:started", (payload: {
    id: string;
    goal: string | null;
    startedAt?: string;
    plannedMinutes: number;
    enforcement: string;
  }) => {
    setState((prev) => ({
      ...prev,
      active: true,
      sessionId: payload.id,
      goal: payload.goal,
      startedAt: payload.startedAt ?? new Date().toISOString(),
      plannedMinutes: payload.plannedMinutes,
      enforcement: payload.enforcement,
      elapsedMinutes: 0,
      remainingMinutes: payload.plannedMinutes,
      minuteLogs: [],
    }));
    client.subscribeToDeepWork(payload.id);
  });

  useWsMessage("deepwork:state", (payload: {
    elapsedMinutes: number;
    remainingMinutes: number;
    focusScore: number;
    productivityScore: number;
    violationCount: number;
    productiveMs: number;
    distractionMs: number;
    idleMs: number;
    interruptionMs?: number;
  }) => {
    setState((prev) => ({
      ...prev,
      ...payload,
    }));
  });

  useWsMessage("deepwork:minute", (payload: {
    minute: number;
    focusScore: number;
    productivityScore: number;
    distraction: boolean;
    idle: boolean;
    appName: string | null;
  }) => {
    setState((prev) => ({
      ...prev,
      minuteLogs: [...prev.minuteLogs, payload],
    }));
  });

  useWsMessage("deepwork:ended", () => {
    setState((prev) => ({
      ...prev,
      active: false,
      sessionId: null,
    }));
  });

  useWsMessage("deepwork:expired", () => {
    setState((prev) => ({
      ...prev,
      active: false,
      sessionId: null,
    }));
  });

  return state;
}

// ═══════════════════════════════════════════════════════════════════════
// LIVE ACTIVITY FEED HOOK
// ═══════════════════════════════════════════════════════════════════════

export interface LiveActivity {
  id: string;
  appName: string;
  windowTitle: string;
  category: string;
  intent: string;
  duration: number;
  startTime: string;
  focusImpact: number;
  iconUrl: string | null;
  domain: string | null;
}

export function useLiveActivityFeed() {
  const [activities, setActivities] = useState<LiveActivity[]>([]);

  useWsMessage("activity:new", (payload: LiveActivity) => {
    setActivities((prev) => [payload, ...prev].slice(0, 50));
  });

  return activities;
}

// ═══════════════════════════════════════════════════════════════════════
// LIVE SESSION METRICS HOOK
// ═══════════════════════════════════════════════════════════════════════

export interface LiveSessionMetrics {
  sessionId: string;
  focusScore: number;
  productivityScore: number;
  deepWorkScore: number;
  burnoutScore: number;
  entropyScore: number;
  switchCount: number;
  totalDuration: number;
}

export function useLiveSessionMetrics() {
  const [metrics, setMetrics] = useState<LiveSessionMetrics | null>(null);

  useWsMessage("session:metrics", (payload: LiveSessionMetrics) => {
    setMetrics(payload);
  });

  return metrics;
}

// ═══════════════════════════════════════════════════════════════════════
// INTERVENTION ALERT HOOK
// ═══════════════════════════════════════════════════════════════════════

export interface InterventionAlert {
  id: string;
  deepWorkId: string;
  appName: string;
  windowTitle: string;
  domain: string | null;
  action: string;
  reason: string | null;
  detectedAt: string;
}

export function useInterventionAlerts() {
  const [alerts, setAlerts] = useState<InterventionAlert[]>([]);

  useWsMessage("intervention:triggered", (payload: InterventionAlert) => {
    setAlerts((prev) => [payload, ...prev]);
  });

  useWsMessage("intervention:resolved", (payload: { interventionId: string }) => {
    setAlerts((prev) => prev.filter((a) => a.id !== payload.interventionId));
  });

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, dismiss };
}

// ═══════════════════════════════════════════════════════════════════════
// BURNOUT ALERT HOOK
// ═══════════════════════════════════════════════════════════════════════

export interface BurnoutAlert {
  level: "low" | "moderate" | "high";
  score: number;
  message: string;
}

export function useBurnoutAlerts() {
  const [alert, setAlert] = useState<BurnoutAlert | null>(null);

  useWsMessage("analytics:burnout", (payload: BurnoutAlert) => {
    setAlert(payload);
  });

  return { alert, clear: () => setAlert(null) };
}

// ═══════════════════════════════════════════════════════════════════════
// COMBINED HOOK (auto-connects + exposes all live data)
// ═══════════════════════════════════════════════════════════════════════

export function useSamaritanLive() {
  useWsConnect(true);

  const connection = useWsState();
  const deepWork = useLiveDeepWork();
  const activities = useLiveActivityFeed();
  const metrics = useLiveSessionMetrics();
  const interventions = useInterventionAlerts();
  const burnout = useBurnoutAlerts();

  return {
    connection,
    deepWork,
    activities,
    metrics,
    interventions,
    burnout,
  };
}
