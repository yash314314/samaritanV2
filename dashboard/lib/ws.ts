"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws";
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

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

  connect(userId: string = USER_ID) {
    if (this.ws?.readyState === WebSocket.OPEN || this._state.connecting) return;

    this._setState({ connecting: true, error: null });

    const url = `${WS_URL}?userId=${userId}&clientType=dashboard`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this._setState({ connected: true, connecting: false, error: null, reconnectAttempt: 0 });
      console.log("[WS] Connected");

      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        if (msg) this.ws?.send(msg);
      }

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
      this._scheduleReconnect(userId);
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
    this.send("session:subscribe", { deepWorkId });
  }

  unsubscribeFromDeepWork(deepWorkId: string) {
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

  private _scheduleReconnect(userId: string) {
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
      this.connect(userId);
    }, delay);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════

let clientInstance: SamaritanWsClient | null = null;

export function getWsClient(): SamaritanWsClient {
  if (!clientInstance) {
    clientInstance = new SamaritanWsClient();
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
