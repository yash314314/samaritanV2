"use client";

import { useEffect, useRef, useState } from "react";

import { wsUrl } from "./apiBase";
import { currentUser, getAccessToken, subscribeAuth } from "./auth";

// The access token rides in the subprotocol list: browsers cannot set headers
// on a WebSocket, and a token in the URL would end up in proxy logs.
const WS_PROTOCOL = "samaritan";
// The server closes a socket whose access token lapses unrenewed; refresh it
// in band well inside the 15-minute token lifetime.
const AUTH_RENEW_INTERVAL_MS = 4 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  seq?: number;
}

export type WsListener<T = unknown> = (msg: WsMessage<T>) => void;

export interface WsConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempt: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════

class SamaritanWsClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<WsListener>>();
  private latestMessages = new Map<string, WsMessage>();
  private stateListeners = new Set<(state: WsConnectionState) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private renewTimer: ReturnType<typeof setInterval> | null = null;
  // Replayed on every (re)connect: subscriptions live on the server-side socket.
  private deepWorkSubscriptions = new Set<string>();
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000;
  private baseReconnectDelay = 1000;
  private messageQueue: string[] = [];
  private _state: WsConnectionState = {
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempt: 0,
  };

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this._state.connecting) return;

    this._setState({ connecting: true, error: null });

    const token = await getAccessToken().catch(() => null);
    if (!token) {
      // Signed out: connect again once someone signs in (see subscribeAuth below).
      this._setState({ connecting: false, error: "Signed out" });
      return;
    }
    if (this.ws) {
      this._setState({ connecting: false });
      return;
    }

    this.ws = new WebSocket(`${wsUrl()}?clientType=dashboard`, [WS_PROTOCOL, `bearer.${token}`]);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this._setState({ connected: true, connecting: false, error: null, reconnectAttempt: 0 });
      console.log("[WS] Connected");

      for (const deepWorkId of this.deepWorkSubscriptions) {
        this.sendRaw(JSON.stringify({ type: "session:subscribe", payload: { deepWorkId } }));
      }
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        if (msg) this.ws?.send(msg);
      }

      this.renewTimer = setInterval(() => {
        // The token sent must outlive the next tick, or the server closes the socket first.
        void getAccessToken(AUTH_RENEW_INTERVAL_MS + 60 * 1000).then((fresh) => {
          if (fresh) this.sendRaw(JSON.stringify({ type: "auth:renew", payload: { token: fresh } }));
        });
      }, AUTH_RENEW_INTERVAL_MS);

      this.pingTimer = setInterval(() => {
        this.sendRaw(JSON.stringify({ type: "ping", payload: {} }));
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        this._dispatch(msg);
      } catch {
        console.error("[WS] Failed to parse message:", event.data);
      }
    };

    this.ws.onclose = () => {
      this._cleanup();
      this._setState({ connected: false, connecting: false });
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      this._setState({ error: "Connection failed" });
    };
  }

  disconnect() {
    this._cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    this._setState({ connected: false, connecting: false, error: null, reconnectAttempt: 0 });
  }

  // ─── Subscription API ───

  on<T>(type: string, listener: WsListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    const wrapped = listener as WsListener;
    set.add(wrapped);

    const latest = this.latestMessages.get(type);
    if (latest) {
      queueMicrotask(() => {
        if (!set.has(wrapped)) return;
        try { wrapped(latest); } catch (err) { console.error("[WS] Listener error:", err); }
      });
    }

    return () => set.delete(wrapped);
  }

  onStateChange(listener: (state: WsConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this._state);
    return () => this.stateListeners.delete(listener);
  }

  // ─── Send API ───

  send<T>(type: string, payload: T) {
    const msg = JSON.stringify({ type, payload });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push(msg);
    }
  }

  subscribeToDeepWork(deepWorkId: string) {
    this.deepWorkSubscriptions.add(deepWorkId);
    if (this.ws?.readyState === WebSocket.OPEN) this.sendRaw(JSON.stringify({ type: "session:subscribe", payload: { deepWorkId } }));
  }

  unsubscribeFromDeepWork(deepWorkId: string) {
    this.deepWorkSubscriptions.delete(deepWorkId);
    this.send("session:unsubscribe", { deepWorkId });
  }

  // ─── Internal ───

  private sendRaw(raw: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    }
  }

  private _dispatch(msg: WsMessage) {
    if (msg.type === "activity:current") {
      this.latestMessages.set(msg.type, msg);
    }

    const set = this.listeners.get(msg.type);
    if (set) {
      set.forEach((listener) => {
        try { listener(msg); } catch (err) { console.error("[WS] Listener error:", err); }
      });
    }
    const wild = this.listeners.get("*");
    if (wild) {
      wild.forEach((listener) => {
        try { listener(msg); } catch (err) { console.error("[WS] Wildcard listener error:", err); }
      });
    }
  }

  private _setState(partial: Partial<WsConnectionState>) {
    this._state = { ...this._state, ...partial };
    this.stateListeners.forEach((l) => l(this._state));
  }

  private _cleanup() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay
    );
    this.reconnectAttempt++;
    this._setState({ reconnectAttempt: this.reconnectAttempt });
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════

let clientInstance: SamaritanWsClient | null = null;

export function getWsClient(): SamaritanWsClient {
  if (!clientInstance) {
    const client = new SamaritanWsClient();
    clientInstance = client;
    // Follow the signed-in user: drop the socket on sign-out, reopen it as the new user.
    let socketUser = currentUser()?.id ?? null;
    subscribeAuth(() => {
      const userId = currentUser()?.id ?? null;
      if (userId === socketUser) return;
      socketUser = userId;
      client.disconnect();
      if (userId) void client.connect();
    });
  }
  return clientInstance;
}

// ═══════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════

/** Subscribe to a specific WS message type */
export function useWsMessage<T>(type: string, handler: (payload: T) => void) {
  // Keep the latest handler in a ref so the effect below only re-subscribes
  // when the message *type* changes — NOT on every component render. Freshly-created
  // inline handlers used to cause a churn of on/off resubscriptions on each state update.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const client = getWsClient();
    return client.on<T>(type, (msg) => handlerRef.current(msg.payload));
  }, [type]);
}

/** Subscribe to connection state */
export function useWsState(): WsConnectionState {
  const [state, setState] = useState<WsConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempt: 0,
  });

  useEffect(() => {
    const client = getWsClient();
    return client.onStateChange(setState);
  }, []);

  return state;
}

/** Auto-connect on mount */
export function useWsConnect(autoConnect = true) {
  useEffect(() => {
    if (!autoConnect) return;
    const client = getWsClient();
    client.connect();
    return () => client.disconnect();
  }, [autoConnect]);
}

/** Subscribe to all messages (wildcard) */
export function useWsAll(handler: (msg: WsMessage) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const client = getWsClient();
    return client.on("*", (msg) => handlerRef.current(msg));
  }, []);
}
