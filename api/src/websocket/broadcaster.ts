import {
    broadcastToDashboards,
    broadcastToDesktop,
    broadcastToSession,
  } from "./manager";
  
  // ─── ACTIVITY EVENTS ─────────────────────────────────────────────────
  
  export function emitActivityCreated(userId: string, activity: any) {
    broadcastToDashboards(userId, "activity:new", {
      id: activity.id,
      appName: activity.appName,
      windowTitle: activity.windowTitle,
      category: activity.category,
      intent: activity.intent,
      duration: activity.duration,
      startTime: activity.startTime,
      focusImpact: activity.focusImpact,
      iconUrl: activity.iconUrl,
      domain: activity.domain,
    });
  }
  
  export function emitSessionMetricsUpdated(userId: string, sessionId: string, metrics: {
    focusScore: number;
    productivityScore: number;
    deepWorkScore: number;
    burnoutScore: number;
    entropyScore: number;
    switchCount: number;
    totalDuration: number;
  }) {
    broadcastToDashboards(userId, "session:metrics", {
      sessionId,
      ...metrics,
    });
  }
  
  // ─── DEEP WORK EVENTS ────────────────────────────────────────────────
  
  export function emitDeepWorkStarted(userId: string, session: {
    id: string;
    goal: string | null;
    plannedMinutes: number;
    enforcement: string;
    startedAt: Date;
    allowedApps?: string[];
    allowedDomains?: string[];
    blockedApps?: string[];
    blockedDomains?: string[];
  }) {
    broadcastToDashboards(userId, "deepwork:started", session);
    broadcastToDesktop(userId, "deepwork:started", session);
  }
  
  export function emitDeepWorkEnded(userId: string, sessionId: string, result: any) {
    broadcastToDashboards(userId, "deepwork:ended", { sessionId, result });
    broadcastToDesktop(userId, "deepwork:ended", { sessionId });
  }
  
  export function emitDeepWorkState(userId: string, sessionId: string, state: {
    elapsedMinutes: number;
    remainingMinutes: number;
    focusScore: number;
    productivityScore: number;
    violationCount: number;
    productiveMs: number;
    distractionMs: number;
    idleMs: number;
    interruptionMs?: number;
  }) {
    broadcastToSession(userId, sessionId, "deepwork:state", state);
    broadcastToDesktop(userId, "deepwork:state", { sessionId, ...state });
  }
  
  export function emitDeepWorkMinute(userId: string, sessionId: string, minuteLog: {
    minute: number;
    focusScore: number;
    productivityScore: number;
    distraction: boolean;
    idle: boolean;
    appName: string | null;
  }) {
    broadcastToSession(userId, sessionId, "deepwork:minute", minuteLog);
  }
  
  export function emitDeepWorkExpired(userId: string, sessionId: string) {
    broadcastToSession(userId, sessionId, "deepwork:expired", { sessionId });
    broadcastToDesktop(userId, "deepwork:expired", { sessionId });
  }
  
  // ─── INTERVENTION EVENTS ─────────────────────────────────────────────
  
  export function emitInterventionTriggered(userId: string, intervention: {
    id: string;
    deepWorkId: string;
    appName: string;
    windowTitle: string;
    domain: string | null;
    action: string;
    reason: string | null;
    detectedAt: Date;
  }) {
    broadcastToSession(userId, intervention.deepWorkId, "intervention:triggered", intervention);
    broadcastToDesktop(userId, "intervention:triggered", intervention);
  }
  
  export function emitInterventionResolved(userId: string, interventionId: string, action: string) {
    broadcastToDashboards(userId, "intervention:resolved", { interventionId, action });
  }

  export function emitInterventionCleared(userId: string, deepWorkId: string, activity: {
    appName: string;
    domain: string | null;
    windowTitle: string;
  }) {
    const payload = { deepWorkId, ...activity };
    broadcastToSession(userId, deepWorkId, "intervention:cleared", payload);
    broadcastToDesktop(userId, "intervention:cleared", payload);
  }
  
  // ─── ANALYTICS EVENTS ────────────────────────────────────────────────
  
  export function emitDailySummaryUpdated(userId: string, summary: any) {
    broadcastToDashboards(userId, "analytics:daily", summary);
  }
  
  export function emitBurnoutAlert(userId: string, alert: {
    level: "low" | "moderate" | "high";
    score: number;
    message: string;
  }) {
    broadcastToDashboards(userId, "analytics:burnout", alert);
  }
