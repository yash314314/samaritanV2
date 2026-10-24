const WebSocket = require("ws");
const crypto = require("crypto");
const auth = require("./authClient");

const WS_URL = process.env.WS_URL || `${auth.API_BASE.replace(/^http/, "ws")}/ws`;
const DEVICE_ID = auth.DEVICE_ID;
// While signed out there is nothing to connect with; retry slowly until a
// credential appears (auth.onChange below reconnects at once when it does).
const SIGNED_OUT_RETRY_MS = 60 * 1000;

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

let connecting = false;
let socketUserId = null;

async function connect() {
  if (connecting || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
  connecting = true;
  let token;
  try {
    token = await auth.getAccessToken();
  } catch (err) {
    console.warn("[WS] Could not obtain an access token:", err.message);
    connecting = false;
    scheduleReconnect();
    return;
  }
  connecting = false;
  if (!token) {
    console.warn("[WS] Desktop is not signed in; waiting for a device credential");
    scheduleReconnect(SIGNED_OUT_RETRY_MS);
    return;
  }

  socketUserId = auth.status().userId;
  const url = `${WS_URL}?deviceId=${encodeURIComponent(DEVICE_ID)}&clientType=desktop`;
  ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });

  ws.on("unexpected-response", (_request, response) => {
    console.warn(`[WS] Handshake refused: HTTP ${response.statusCode}`);
    if (response.statusCode === 401) auth.getAccessToken().catch(() => undefined);
  });

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

  ws.on("close", (code) => {
    isConnected = false;
    stopHeartbeat();
    // 4001: the server ended this login (sign-out everywhere, password change).
    scheduleReconnect(code === 4001 ? SIGNED_OUT_RETRY_MS : undefined);
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

function scheduleReconnect(fixedDelay) {
  if (reconnectTimer) return;
  const delay = fixedDelay ?? Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
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
    payload: activity
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

// A new or replaced credential (dashboard link, re-enrollment) reconnects straight away.
auth.onChange((state) => {
  if (!state.linked) return;
  if (ws?.readyState === WebSocket.OPEN) {
    // Same account: the socket stays valid. Another account: reconnect as it.
    if (state.userId !== socketUserId) ws.close(1000, "Credential changed");
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connect();
});

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
