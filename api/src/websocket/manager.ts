import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { parse } from "url";
import { isAllowedOrigin } from "../utils/origin";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  seq?: number;
}

export interface ClientMeta {
  userId: string;
  deviceId?: string;
  clientType: "dashboard" | "desktop";
  connectedAt: Date;
  lastPing: Date;
  subscriptions: Set<string>;
}

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

const clients = new Map<WebSocket, ClientMeta>();
const userRooms = new Map<string, Set<WebSocket>>();
let messageSeq = 0;
let wss: WebSocketServer | null = null;

const externalHandlers: Array<(ws: WebSocket, msg: WsMessage, meta: ClientMeta) => void | Promise<void>> = [];

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({
    server,
    path: "/ws",
    perMessageDeflate: false,
    // Browsers let any page open a WebSocket to localhost; reject foreign origins.
    verifyClient: ({ origin }: { origin?: string }) => isAllowedOrigin(origin),
  });

  wss.on("connection", (ws, req) => {
    const { query } = parse(req.url || "", true);
    const userId = query.userId as string;
    const deviceId = query.deviceId as string | undefined;
    const clientType = (query.clientType as "dashboard" | "desktop") || "dashboard";

    if (!userId) {
      ws.close(4001, "Missing userId");
      return;
    }

    const meta: ClientMeta = {
      userId,
      deviceId,
      clientType,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: new Set(),
    };

    clients.set(ws, meta);
    addToRoom(userId, ws);

    console.log(`[WS] ${clientType} connected | user=${userId}${deviceId ? ` device=${deviceId}` : ""} | total=${clients.size}`);

    send(ws, { type: "connection:established", payload: { userId, clientType }, timestamp: new Date().toISOString() });

    ws.on("message", (raw) => handleIncoming(ws, raw as Buffer));
    ws.on("close", () => disconnect(ws));
    ws.on("error", (err) => {
      console.error(`[WS] Socket error | user=${meta.userId}:`, err.message);
      disconnect(ws);
    });

    const hb = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(hb);
      }
    }, 30000);

    ws.on("pong", () => { meta.lastPing = new Date(); });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [ws, meta] of clients) {
      if (now - meta.lastPing.getTime() > 120000) {
        console.log(`[WS] Stale connection, terminating | user=${meta.userId}`);
        ws.terminate();
      }
    }
  }, 60000);

  console.log("[WS] Server initialized on /ws");
}

// ═══════════════════════════════════════════════════════════════════════
// INTERNALS
// ═══════════════════════════════════════════════════════════════════════

function addToRoom(userId: string, ws: WebSocket) {
  if (!userRooms.has(userId)) userRooms.set(userId, new Set());
  userRooms.get(userId)!.add(ws);
}

function removeFromRoom(userId: string, ws: WebSocket) {
  const room = userRooms.get(userId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) userRooms.delete(userId);
  }
}

function disconnect(ws: WebSocket) {
  const meta = clients.get(ws);
  if (!meta) return;
  clients.delete(ws);
  removeFromRoom(meta.userId, ws);
  console.log(`[WS] ${meta.clientType} disconnected | user=${meta.userId} | remaining=${clients.size}`);
}

function handleIncoming(ws: WebSocket, raw: Buffer) {
  const meta = clients.get(ws);
  if (!meta) return;
  try {
    const msg = JSON.parse(raw.toString()) as WsMessage;
    handleMessage(ws, msg, meta);
  } catch {
    send(ws, { type: "error", payload: { code: "PARSE_ERROR", message: "Invalid JSON" }, timestamp: new Date().toISOString() });
  }
}

function handleMessage(ws: WebSocket, msg: WsMessage, meta: ClientMeta) {
  switch (msg.type) {
    case "session:subscribe": {
      const { deepWorkId } = msg.payload as { deepWorkId?: string };
      if (deepWorkId) {
        meta.subscriptions.add(`deepwork:${deepWorkId}`);
        send(ws, { type: "session:subscribed", payload: { deepWorkId }, timestamp: new Date().toISOString() });
      }
      break;
    }
    case "session:unsubscribe": {
      const { deepWorkId } = msg.payload as { deepWorkId?: string };
      if (deepWorkId) meta.subscriptions.delete(`deepwork:${deepWorkId}`);
      break;
    }
    case "ping":
      send(ws, { type: "pong", payload: { time: Date.now() }, timestamp: new Date().toISOString() });
      break;
    default:
      for (const handler of externalHandlers) {
        try { handler(ws, msg, meta); } catch (err) { console.error("[WS] Handler error:", err); }
      }
  }
}

function buildMessage<T>(type: string, payload: T): WsMessage<T> {
  return { type, payload, timestamp: new Date().toISOString(), seq: ++messageSeq };
}

function send<T>(ws: WebSocket, msg: WsMessage<T>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC BROADCAST API
// ═══════════════════════════════════════════════════════════════════════

export function registerHandler(handler: (ws: WebSocket, msg: WsMessage, meta: ClientMeta) => void | Promise<void>) {
  externalHandlers.push(handler);
}

export function broadcastToUser<T>(userId: string, type: string, payload: T, filter?: (meta: ClientMeta) => boolean) {
  const room = userRooms.get(userId);
  if (!room) return;
  const msg = buildMessage(type, payload);
  for (const ws of room) {
    const meta = clients.get(ws);
    if (!meta || (filter && !filter(meta))) continue;
    send(ws, msg);
  }
}

export function broadcastToDashboards<T>(userId: string, type: string, payload: T) {
  broadcastToUser(userId, type, payload, (m) => m.clientType === "dashboard");
}

export function broadcastToDesktop<T>(userId: string, type: string, payload: T) {
  broadcastToUser(userId, type, payload, (m) => m.clientType === "desktop");
}

export function broadcastToSession<T>(userId: string, deepWorkId: string, type: string, payload: T) {
  const room = userRooms.get(userId);
  if (!room) return;
  const msg = buildMessage(type, payload);
  for (const ws of room) {
    const meta = clients.get(ws);
    if (!meta || !meta.subscriptions.has(`deepwork:${deepWorkId}`)) continue;
    send(ws, msg);
  }
}

export function sendToSocket<T>(ws: WebSocket, type: string, payload: T) {
  send(ws, buildMessage(type, payload));
}

export function getConnectionStats() {
  const stats = { total: 0, dashboard: 0, desktop: 0, byUser: {} as Record<string, number> };
  for (const [, meta] of clients) {
    stats.total++;
    stats[meta.clientType]++;
    stats.byUser[meta.userId] = (stats.byUser[meta.userId] || 0) + 1;
  }
  return stats;
}