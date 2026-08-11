import { WebSocket } from "ws";
import { WsMessage, ClientMeta, registerHandler } from "./manager";
import { createActivityFromTracker } from "../services/sessionService";
import { startDeepWorkSession, endDeepWorkSession } from "../services/deepWorkService";
import { emitCurrentActivity } from "./broadcaster";

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
});
