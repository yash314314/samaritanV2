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

  export function emitActivityReviewed(userId: string, result: {
    reviewedActivities: number;
    reviewedEntries: number;
    activityIds: string[];
  }) {
    broadcastToDashboards(userId, "activity:reviewed", result);
  }

  type CurrentActivityCursor = {
    observedAtMs: number;
    sourceSessionId: string | null;
    sourceSequence: number | null;
  };

  const currentActivityCursors = new Map<string, CurrentActivityCursor>();

  export function emitCurrentActivity(userId: string, context: {
    app: string;
    title: string;
    iconUrl?: string | null;
    url?: string | null;
    domain?: string | null;
    processId?: number | null;
    processPath?: string | null;
    type?: string;
    observedAt?: string;
    sourceDeviceId?: string;
    sourceSessionId?: string;
    sourceSequence?: number;
  }) {
    const parsedObservedAt = context.observedAt
      ? new Date(context.observedAt).getTime()
      : NaN;
    const observedAtMs = Number.isFinite(parsedObservedAt)
      ? parsedObservedAt
      : Date.now();
    const sourceSessionId = context.sourceSessionId ?? null;
    const sourceSequence = Number.isFinite(context.sourceSequence)
      ? Number(context.sourceSequence)
      : null;
    const previous = currentActivityCursors.get(userId);

    if (previous) {
      const sameSourceSession = Boolean(
        sourceSessionId && sourceSessionId === previous.sourceSessionId
      );

      if (
        sameSourceSession &&
        sourceSequence !== null &&
        previous.sourceSequence !== null &&
        sourceSequence <= previous.sourceSequence
      ) {
        return;
      }

      if (observedAtMs < previous.observedAtMs) {
        return;
      }
    }

    currentActivityCursors.set(userId, {
      observedAtMs,
      sourceSessionId,
      sourceSequence,
    });

    broadcastToDashboards(userId, "activity:current", {
      appName: context.app,
      windowTitle: context.title,
      iconUrl: context.iconUrl ?? null,
      url: context.url ?? null,
      domain: context.domain ?? null,
      processId: context.processId ?? null,
      processPath: context.processPath ?? null,
      type: context.type ?? "active",
      observedAt: new Date(observedAtMs).toISOString(),
      sourceDeviceId: context.sourceDeviceId ?? null,
      sourceSessionId,
      sourceSequence,
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
    emitWidgetStateUpdate(userId, {
      focus: {
        id: session.id,
        goal: session.goal,
        plannedMinutes: session.plannedMinutes,
        startedAt: session.startedAt,
        enforcement: session.enforcement,
        remainingSeconds: session.plannedMinutes * 60,
      },
      updatedAt: new Date(),
    });
  }
  
  export function emitDeepWorkEnded(userId: string, sessionId: string, result: any) {
    broadcastToDashboards(userId, "deepwork:ended", { sessionId, result });
    broadcastToDesktop(userId, "deepwork:ended", { sessionId });
    emitWidgetStateUpdate(userId, { focus: null, updatedAt: new Date() });
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
    emitWidgetStateUpdate(userId, {
      focusState: {
        sessionId,
        remainingSeconds: Math.max(0, Math.round(state.remainingMinutes * 60)),
        focusScore: state.focusScore,
        productivityScore: state.productivityScore,
        violationCount: state.violationCount,
      },
      updatedAt: new Date(),
    });
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

  export function emitCalendarChanged(
    userId: string,
    action: "created" | "updated" | "deleted" | "imported",
    payload: any
  ) {
    broadcastToDashboards(userId, `calendar:${action}`, payload);
    broadcastToDashboards(userId, "calendar:changed", { action, ...payload });
  }

  export function emitCalendarSessionChanged(
    userId: string,
    action: "started" | "updated" | "review-required" | "ended",
    payload: any
  ) {
    broadcastToDashboards(userId, `calendar:session.${action}`, payload);
    broadcastToDesktop(userId, `calendar:session.${action}`, payload);
  }

  export function emitCalendarReminderDue(userId: string, payload: any) {
    broadcastToDashboards(userId, "calendar:reminder.due", payload);
    broadcastToDesktop(userId, "calendar:reminder.due", payload);
  }

  export function emitCalendarReminderChanged(
    userId: string,
    action: "snoozed" | "dismissed",
    payload: any
  ) {
    broadcastToDashboards(userId, `calendar:reminder.${action}`, payload);
    broadcastToDesktop(userId, `calendar:reminder.${action}`, payload);
  }

  export function emitCalendarFocusChanged(
    userId: string,
    action: "activated" | "skipped" | "completed",
    payload: any
  ) {
    broadcastToDashboards(userId, `calendar:focus.${action}`, payload);
    broadcastToDesktop(userId, `calendar:focus.${action}`, payload);
  }

  export function emitProjectChanged(
    userId: string,
    action: "created" | "updated" | "deleted" | "rules-updated",
    payload: any
  ) {
    broadcastToDashboards(userId, "project:changed", { action, ...payload });
  }

  export function emitGoalChanged(
    userId: string,
    action: "created" | "updated" | "deleted",
    payload: any
  ) {
    broadcastToDashboards(userId, `goal:${action}`, payload);
    broadcastToDashboards(userId, "goal:changed", { action, ...payload });
  }

  export function emitGoalProgress(userId: string, goals: any[]) {
    broadcastToDashboards(userId, "goal:progress", { goals });
  }

  export function emitSmartBreakChanged(
    userId: string,
    action: "suggested" | "started" | "snoozed" | "skipped" | "completed" | "settings",
    payload: any
  ) {
    broadcastToDashboards(userId, `break:${action}`, payload);
    broadcastToDesktop(userId, `break:${action}`, payload);
    emitWidgetStateUpdate(userId, {
      break: ["completed", "skipped"].includes(action) ? null : payload.break ?? null,
      updatedAt: new Date(),
    });
  }

  export function emitDistractionBlocksChanged(
    userId: string,
    action: "created" | "updated" | "deleted",
    payload: any
  ) {
    const event = { action, ...payload };
    broadcastToDashboards(userId, "distraction-blocks:changed", event);
    broadcastToDesktop(userId, "distraction-blocks:changed", event);
  }

  export function emitDistractionBlockEvent(userId: string, payload: any) {
    broadcastToDashboards(userId, "distraction-block:event", payload);
  }

  export function emitWidgetStateUpdate(userId: string, payload: any) {
    broadcastToDesktop(userId, "widget.state.update", payload);
  }

  export function emitWebhookChanged(
    userId: string,
    action: "created" | "updated" | "deleted",
    payload: any
  ) {
    broadcastToDashboards(userId, "webhook:changed", { action, ...payload });
  }

  export function emitWebhookDelivery(userId: string, payload: any) {
    broadcastToDashboards(userId, "webhook:delivery", payload);
  }
