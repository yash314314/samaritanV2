import { WebSocket } from "ws";
import { WsMessage, ClientMeta, registerHandler } from "./manager";
import { createActivityFromTracker } from "../services/sessionService";
import { startDeepWorkSession, endDeepWorkSession } from "../services/deepWorkService";
import { emitCurrentActivity } from "./broadcaster";
import { recordDistractionBlockEvent } from "../services/distractionBlockService";
import {
  getWidgetState,
  quickTagWidgetActivity,
  updateWidgetCurrentContext,
} from "../services/widgetStateService";
import { sendToSocket } from "./manager";
import { snoozeSmartBreak, startSmartBreak } from "../services/smartBreakService";

// Register handlers for client-sent messages

registerHandler(async (ws: WebSocket, msg: WsMessage, meta: ClientMeta) => {
  if (msg.type === "activity:stream") {
    try {
      const data = msg.payload as {
        id?: string;
        userId: string;
        app: string;
        title: string;
        iconUrl?: string | null;
        domain?: string | null;
        url?: string | null;
        startTime: string;
        endTime: string;
        duration: number;
        type: string;
      };

      await createActivityFromTracker({
        id: data.id,
        userId: data.userId,
        app: data.app,
        title: data.title,
        iconUrl: data.iconUrl,
        domain: data.domain,
        url: data.url,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        duration: data.duration,
        type: data.type,
      });
    } catch (err) {
      console.error("[WS Handler] activity:stream error:", err);
    }
  }

  // NOTE: deepwork:start is DISABLED — use POST /focus/start HTTP endpoint instead.
  // The WebSocket handler was a duplicate trigger that caused confusion.
  // All deep work sessions must be started via the "New Session" button in the UI.

  if (msg.type === "activity:current") {
    try {
      const data = msg.payload as {
        app: string;
        title: string;
        iconUrl?: string | null;
        domain?: string | null;
        url?: string | null;
        processId?: number | null;
        processPath?: string | null;
        observedAt?: string;
        type?: string;
        sourceDeviceId?: string;
        sourceSessionId?: string;
        sourceSequence?: number;
      };

      if (!data?.app || !data?.title) return;

      emitCurrentActivity(meta.userId, {
        app: data.app,
        title: data.title,
        iconUrl: data.iconUrl,
        domain: data.domain,
        url: data.url,
        processId: data.processId,
        processPath: data.processPath,
        observedAt: data.observedAt,
        type: data.type,
        sourceDeviceId: meta.deviceId ?? data.sourceDeviceId,
        sourceSessionId: data.sourceSessionId,
        sourceSequence: data.sourceSequence,
      });
      updateWidgetCurrentContext(meta.userId, data).catch((error) => {
        console.error("[WidgetState] Current activity update failed", error);
      });
    } catch (err) {
      console.error("[WS Handler] activity:current error:", err);
    }
  }

  if (msg.type === "deepwork:end") {
    try {
      const { sessionId, status } = msg.payload as { sessionId: string; status?: string };
      await endDeepWorkSession(meta.userId, sessionId, status || "completed");
    } catch (err) {
      console.error("[WS Handler] deepwork:end error:", err);
    }
  }

  if (msg.type === "distraction-block:event") {
    try {
      await recordDistractionBlockEvent(meta.userId, {
        ...(msg.payload as object),
        deviceId: meta.deviceId,
      });
    } catch (err) {
      console.error("[WS Handler] distraction-block:event error:", err);
    }
  }

  if (msg.type === "widget.subscribe") {
    try {
      sendToSocket(ws, "widget.state.update", await getWidgetState(meta.userId));
    } catch (err) {
      console.error("[WS Handler] widget.subscribe error:", err);
      sendToSocket(ws, "widget.action.result", { action: "subscribe", ok: false, error: "Widget state unavailable" });
    }
  }

  if (msg.type === "widget.startFocus") {
    try {
      const payload = msg.payload as { targetMinutes?: number; goal?: string };
      const targetMinutes = Math.max(5, Math.min(180, Math.round(Number(payload?.targetMinutes) || 25)));
      const session = await startDeepWorkSession({
        userId: meta.userId,
        goal: payload?.goal?.trim() || "Widget focus session",
        plannedMinutes: targetMinutes,
        enforcement: "warn",
      });
      sendToSocket(ws, "widget.action.result", { action: "startFocus", ok: true, sessionId: session.id });
    } catch (err) {
      sendToSocket(ws, "widget.action.result", { action: "startFocus", ok: false, error: err instanceof Error ? err.message : "Could not start focus" });
    }
  }

  if (msg.type === "widget.endFocus") {
    try {
      const payload = msg.payload as { sessionId?: string };
      if (!payload?.sessionId) throw new Error("No active focus session");
      await endDeepWorkSession(meta.userId, payload.sessionId, "completed");
      sendToSocket(ws, "widget.action.result", { action: "endFocus", ok: true });
    } catch (err) {
      sendToSocket(ws, "widget.action.result", { action: "endFocus", ok: false, error: err instanceof Error ? err.message : "Could not end focus" });
    }
  }

  if (msg.type === "widget.quickTag") {
    try {
      const payload = msg.payload as { projectId?: string; activityId?: string };
      if (!payload?.projectId) throw new Error("Choose a project");
      const result = await quickTagWidgetActivity(meta.userId, payload.projectId, payload.activityId);
      sendToSocket(ws, "widget.action.result", { action: "quickTag", ok: true, ...result });
    } catch (err) {
      sendToSocket(ws, "widget.action.result", { action: "quickTag", ok: false, error: err instanceof Error ? err.message : "Could not tag activity" });
    }
  }

  if (msg.type === "widget.snoozeBreak") {
    try {
      const payload = msg.payload as { breakId?: string; minutes?: number };
      if (!payload?.breakId) throw new Error("No break suggestion to snooze");
      await snoozeSmartBreak(meta.userId, payload.breakId, payload.minutes);
      sendToSocket(ws, "widget.action.result", { action: "snoozeBreak", ok: true });
    } catch (err) {
      sendToSocket(ws, "widget.action.result", { action: "snoozeBreak", ok: false, error: err instanceof Error ? err.message : "Could not snooze break" });
    }
  }

  if (msg.type === "widget.startBreak") {
    try {
      const payload = msg.payload as { breakId?: string };
      await startSmartBreak(meta.userId, { breakId: payload?.breakId });
      sendToSocket(ws, "widget.action.result", { action: "startBreak", ok: true });
    } catch (err) {
      sendToSocket(ws, "widget.action.result", { action: "startBreak", ok: false, error: err instanceof Error ? err.message : "Could not start break" });
    }
  }
});
