"use client";

import { useState, useCallback } from "react";
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
  elapsedSeconds: number;
  phaseElapsedSeconds: number;
  phaseRemainingSeconds: number;
  enforcement: string;
  enforcementActive: boolean;
  timerMode: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  currentPhase: string;
  currentRound: number;
  totalRounds: number;
  paused: boolean;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  ambientSound: string;
  ambientVolume: number;
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
    elapsedSeconds: 0,
    phaseElapsedSeconds: 0,
    phaseRemainingSeconds: 0,
    enforcement: "warn",
    enforcementActive: false,
    timerMode: "countdown",
    focusMinutes: 0,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    currentPhase: "focus",
    currentRound: 1,
    totalRounds: 1,
    paused: false,
    phaseStartedAt: null,
    phaseEndsAt: null,
    ambientSound: "none",
    ambientVolume: 0.35,
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
    timerMode?: string;
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    currentPhase?: string;
    currentRound?: number;
    totalRounds?: number;
    phaseStartedAt?: string;
    phaseEndsAt?: string | null;
    pausedAt?: string | null;
    ambientSound?: string;
    ambientVolume?: number;
  }) => {
    setState((prev) => ({
      ...prev,
      active: true,
      sessionId: payload.id,
      goal: payload.goal,
      startedAt: payload.startedAt ?? new Date().toISOString(),
      plannedMinutes: payload.plannedMinutes,
      enforcement: payload.enforcement,
      enforcementActive: !payload.pausedAt && (payload.currentPhase ?? "focus") === "focus",
      timerMode: payload.timerMode ?? "countdown",
      focusMinutes: payload.focusMinutes ?? payload.plannedMinutes,
      shortBreakMinutes: payload.shortBreakMinutes ?? 5,
      longBreakMinutes: payload.longBreakMinutes ?? 15,
      currentPhase: payload.currentPhase ?? "focus",
      currentRound: payload.currentRound ?? 1,
      totalRounds: payload.totalRounds ?? 1,
      paused: Boolean(payload.pausedAt),
      phaseStartedAt: payload.phaseStartedAt ?? payload.startedAt ?? new Date().toISOString(),
      phaseEndsAt: payload.phaseEndsAt ?? null,
      phaseElapsedSeconds: 0,
      phaseRemainingSeconds: (payload.focusMinutes ?? payload.plannedMinutes) * 60,
      elapsedSeconds: 0,
      ambientSound: payload.ambientSound ?? "none",
      ambientVolume: payload.ambientVolume ?? 0.35,
      elapsedMinutes: 0,
      remainingMinutes: payload.focusMinutes ?? payload.plannedMinutes,
      minuteLogs: [],
    }));
    client.subscribeToDeepWork(payload.id);
  });

  useWsMessage("deepwork:state", (payload: {
    sessionId: string;
    elapsedMinutes: number;
    remainingMinutes: number;
    focusScore: number;
    productivityScore: number;
    violationCount: number;
    productiveMs: number;
    distractionMs: number;
    idleMs: number;
    interruptionMs?: number;
    elapsedSeconds: number;
    phaseElapsedSeconds: number;
    phaseRemainingSeconds: number;
    timerMode: string;
    currentPhase: string;
    currentRound: number;
    totalRounds: number;
    paused: boolean;
    phaseStartedAt: string;
    phaseEndsAt: string | null;
    enforcementActive: boolean;
  }) => {
    setState((prev) => ({
      ...prev,
      ...payload,
      active: true,
      sessionId: payload.sessionId,
    }));
  });

  useWsMessage("deepwork:minute", (payload: {
    sessionId: string;
    minute: number;
    focusScore: number;
    productivityScore: number;
    distraction: boolean;
    idle: boolean;
    appName: string | null;
  }) => {
    setState((prev) => prev.sessionId && prev.sessionId !== payload.sessionId ? prev : ({
      ...prev,
      sessionId: payload.sessionId,
      minuteLogs: [...prev.minuteLogs.filter((item) => item.minute !== payload.minute), payload]
        .sort((left, right) => left.minute - right.minute)
        .slice(-120),
    }));
  });

  useWsMessage("deepwork:ended", (payload: { sessionId: string }) => {
    setState((prev) => ({
      ...prev,
      active: false,
      sessionId: payload.sessionId,
    }));
  });

  useWsMessage("deepwork:expired", (payload: { sessionId: string }) => {
    setState((prev) => ({
      ...prev,
      active: false,
      sessionId: payload.sessionId,
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

export interface CurrentActivity {
  appName: string;
  windowTitle: string;
  iconUrl: string | null;
  url: string | null;
  domain: string | null;
  processId: number | null;
  processPath: string | null;
  type: string;
  observedAt: string;
  sourceDeviceId?: string | null;
  sourceSessionId?: string | null;
  sourceSequence?: number | null;
}

export function useCurrentActivity() {
  const [activity, setActivity] = useState<CurrentActivity | null>(null);

  useWsMessage("activity:current", (payload: CurrentActivity) => {
    setActivity((prev) => {
      const sameSourceSession = Boolean(
        prev?.sourceSessionId &&
        payload.sourceSessionId === prev.sourceSessionId
      );

      if (
        sameSourceSession &&
        prev?.sourceSequence != null &&
        payload.sourceSequence != null &&
        payload.sourceSequence <= prev.sourceSequence
      ) {
        return prev;
      }

      if (
        prev?.observedAt &&
        payload.observedAt &&
        new Date(payload.observedAt).getTime() < new Date(prev.observedAt).getTime()
      ) {
        return prev;
      }

      return payload;
    });
  });

  return activity;
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
