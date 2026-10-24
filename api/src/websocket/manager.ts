import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { parse } from "url";
import { isAllowedOrigin } from "../utils/origin";
import { authenticateToken, bearerToken, tokenStillValid } from "../middleware/authMiddleware";
import type { VerifiedToken } from "../utils/jwt";

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
  /** The access token currently vouching for this socket; renewed in band with "auth:renew". */
  auth: VerifiedToken;
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

// Browsers cannot set headers on a WebSocket, so the dashboard offers its
// access token as a subprotocol ("samaritan", "bearer.<jwt>"); native clients
// send a normal Authorization header. Tokens never travel in the URL, where
// proxies and logs would keep them.
const WS_PROTOCOL = "samaritan";
const BEARER_PROTOCOL_PREFIX = "bearer.";

type AuthenticatedUpgrade = IncomingMessage & { samaritanUser?: VerifiedToken };

// A socket lives only as long as its access token. Clients renew in band
// ("auth:renew" with a fresh token) before expiry; a socket that does not, or
// whose login was signed out, is closed by the sweep below.
const RENEWAL_GRACE_MS = Number(process.env.WS_RENEWAL_GRACE_MS ?? 60 * 1000);
const AUTH_SWEEP_MS = Number(process.env.WS_AUTH_SWEEP_MS) || 30 * 1000;

function upgradeToken(req: IncomingMessage): string | null {
  const fromHeader = bearerToken(req.headers.authorization);
  if (fromHeader) return fromHeader;
  const offered = String(req.headers["sec-websocket-protocol"] || "")
    .split(",")
    .map((value) => value.trim());
  const bearer = offered.find((value) => value.startsWith(BEARER_PROTOCOL_PREFIX));
  return bearer ? bearer.slice(BEARER_PROTOCOL_PREFIX.length) : null;
}

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({
    server,
    path: "/ws",
    perMessageDeflate: false,
    maxPayload: 1024 * 1024,
    // Browsers let any page open a WebSocket to localhost; reject foreign origins,
    // then require a valid access token before the upgrade completes.
    verifyClient: (info: { origin?: string; req: IncomingMessage }, done: (ok: boolean, code?: number, message?: string) => void) => {
      if (!isAllowedOrigin(info.origin)) return done(false, 403, "Origin not allowed");
      authenticateToken(upgradeToken(info.req))
        .then((user) => {
          if (!user) return done(false, 401, "Unauthorized");
          (info.req as AuthenticatedUpgrade).samaritanUser = user;
          done(true);
        })
        .catch(() => done(false, 500, "Authentication failed"));
    },
    handleProtocols: (protocols: Set<string>) => (protocols.has(WS_PROTOCOL) ? WS_PROTOCOL : false),
  });

  wss.on("connection", (ws, req) => {
    const { query } = parse(req.url || "", true);
    const user = (req as AuthenticatedUpgrade).samaritanUser;
    if (!user) {
      ws.close(4001, "Unauthorized");
      return;
    }
    const userId = user.userId;
    if (query.userId && query.userId !== userId) {
      ws.close(4003, "userId does not match the authenticated user");
      return;
    }
    const deviceId = typeof query.deviceId === "string" ? query.deviceId.slice(0, 128) : undefined;
    const clientType = query.clientType === "desktop" ? "desktop" : "dashboard";

    const meta: ClientMeta = {
      userId,
      deviceId,
      clientType,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: new Set(),
      auth: user,
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

  setInterval(() => {
    void sweepSocketAuth();
  }, AUTH_SWEEP_MS).unref();

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
    case "auth:renew": {
      void renewSocketAuth(ws, meta, (msg.payload as { token?: unknown })?.token);
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

async function renewSocketAuth(ws: WebSocket, meta: ClientMeta, token: unknown) {
  const renewed = typeof token === "string" ? await authenticateToken(token).catch(() => null) : null;
  if (!renewed || renewed.userId !== meta.userId) {
    send(ws, { type: "auth:renew.failed", payload: {}, timestamp: new Date().toISOString() });
    return;
  }
  meta.auth = renewed;
  send(ws, { type: "auth:renewed", payload: { expiresAt: new Date(renewed.expiresAt).toISOString() }, timestamp: new Date().toISOString() });
}

/** Closes sockets whose token lapsed without renewal or whose login was signed out. */
async function sweepSocketAuth() {
  const now = Date.now();
  for (const [ws, meta] of clients) {
    if (now > meta.auth.expiresAt + RENEWAL_GRACE_MS) {
      ws.close(4002, "Access token expired");
      continue;
    }
    const valid = await tokenStillValid(meta.auth).catch(() => true);
    if (!valid) ws.close(4001, "Session ended");
  }
}

/** Closes the sockets opened under one login (token family), e.g. after that session is signed out. */
export function disconnectFamily(familyId: string, reason: string) {
  for (const [ws, meta] of clients) {
    if (meta.auth.familyId === familyId) ws.close(4001, reason.slice(0, 120));
  }
}

/** Closes every socket of a user, e.g. after a password change or "log out everywhere". */
export function disconnectUser(userId: string, reason: string) {
  const room = userRooms.get(userId);
  if (!room) return;
  for (const ws of [...room]) ws.close(4001, reason.slice(0, 120));
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