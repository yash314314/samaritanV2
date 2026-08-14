const WebSocket = require("ws");
const Store = require("electron-store");
const crypto = require("crypto");

const store = new Store();
const WS_URL = "ws://localhost:4000/ws";
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const DEVICE_ID = store.get("deviceId") || require("uuid").v4();
store.set("deviceId", DEVICE_ID);

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

let ws = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let messageQueue = [];
let isConnected = false;
let currentActivitySequence = 0;
const sourceSessionId = crypto.randomUUID();

const listeners = new Map();

// ═══════════════════════════════════════════════════════════════════════
// CONNECTION
// ═══════════════════════════════════════════════════════════════════════

function connect() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  const url = `${WS_URL}?userId=${USER_ID}&deviceId=${DEVICE_ID}&clientType=desktop`;
  ws = new WebSocket(url);

  ws.on("open", () => {
    reconnectAttempt = 0;
    isConnected = true;
    console.log("[WS] Desktop connected");

    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      if (msg) ws.send(msg);
    }

    startHeartbeat();
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(msg);
    } catch (err) {
      console.error("[WS] Parse error:", err);
    }
  });

  ws.on("close", () => {
    isConnected = false;
    stopHeartbeat();
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err.message);
    isConnected = false;
  });
}

function disconnect() {
  stopHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnected = false;
  reconnectAttempt = 0;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
  reconnectAttempt++;
  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// ═══════════════════════════════════════════════════════════════════════
// HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════

let heartbeatInterval = null;

function startHeartbeat() {
  heartbeatInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping", payload: {} }));
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MESSAGE HANDLING
// ═══════════════════════════════════════════════════════════════════════

function handleMessage(msg) {
  const set = listeners.get(msg.type);
  if (set) {
    set.forEach((fn) => {
      try { fn(msg.payload); } catch (err) { console.error("[WS] Listener error:", err); }
    });
  }
  const wild = listeners.get("*");
  if (wild) {
    wild.forEach((fn) => {
      try { fn(msg); } catch (err) { console.error("[WS] Wildcard error:", err); }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

function send(type, payload) {
  const msg = JSON.stringify({ type, payload });
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(msg);
  } else {
    messageQueue.push(msg);
  }
}

function on(type, handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  return () => listeners.get(type)?.delete(handler);
}

function off(type, handler) {
  listeners.get(type)?.delete(handler);
}

// ═══════════════════════════════════════════════════════════════════════
// DESKTOP-SPECIFIC: ACTIVITY STREAMING
// ═══════════════════════════════════════════════════════════════════════

/** Stream activity directly via WS instead of HTTP POST */
function streamActivity(activity) {
  if (ws?.readyState !== WebSocket.OPEN) {
    return false;
  }

  ws.send(JSON.stringify({
    type: "activity:stream",
    payload: {
      userId: USER_ID,
      ...activity,
    }
  }));

  return true;
}

/** Stream the current foreground context without persisting it as an activity. */
function streamCurrentActivity(context) {
  if (ws?.readyState !== WebSocket.OPEN) {
    return false;
  }

  ws.send(JSON.stringify({
    type: "activity:current",
    payload: {
      userId: USER_ID,
      sourceDeviceId: DEVICE_ID,
      sourceSessionId,
      sourceSequence: ++currentActivitySequence,
      ...context,
      observedAt: context.observedAt || new Date().toISOString()
    }
  }));

  return true;
}

function reportDistractionBlock(event) {
  send("distraction-block:event", {
    id: crypto.randomUUID(),
    ...event,
  });
}

/** Subscribe to deep work state changes */
function subscribeToDeepWork(deepWorkId) {
  send("session:subscribe", { deepWorkId });
}

/** Unsubscribe from deep work */
function unsubscribeFromDeepWork(deepWorkId) {
  send("session:unsubscribe", { deepWorkId });
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  connect,
  disconnect,
  send,
  on,
  off,
  streamActivity,
  streamCurrentActivity,
  reportDistractionBlock,
  subscribeToDeepWork,
  unsubscribeFromDeepWork,
  get isConnected() { return isConnected; },
};
