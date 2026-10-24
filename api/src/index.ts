import "dotenv/config"; // Must run first: modules below read process.env at load time
import { createServer } from "http";
import { createApp } from "./app";
import { startMinuteLogger } from "./services/minuteLogger";
import { startSessionExpiryChecker } from './services/sessionExpiry';
import { startProjectTimeAggregation } from "./jobs/aggregateProjectTime";
import { initWebSocket } from "./websocket/manager";
import { startCalendarTrackingLifecycle } from "./services/calendarTrackingService";
import { startCalendarReminderScheduler } from "./services/calendarReminderService";
import { startSmartBreakLifecycle } from "./services/smartBreakService";
import { startReportScheduler } from "./services/reportScheduler";
import { ensureEnrollmentKey, pruneRefreshTokens } from "./services/authService";
import { authConfig } from "./config/auth";
import { databaseConfig } from "./prisma";
import { databaseWarnings, describeDatabase } from "./config/database";
import "./websocket/handlers"; // Register WS message handlers

const app = createApp();
const server = createServer(app);

// Attach WebSocket server to same HTTP server
initWebSocket(server);

const PORT = Number(process.env.PORT) || 4000;
// Loopback by default. Containers set HOST=0.0.0.0 and sit behind nginx.
const HOST = process.env.HOST || "127.0.0.1";
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const database = describeDatabase(databaseConfig);
console.log(`[DB] target=${database.target} host=${database.host}:${database.port} db=${database.database} tls=${database.ssl}`);
for (const warning of databaseWarnings(databaseConfig)) console.warn(`[DB] WARNING: ${warning}`);
if (authConfig.ephemeralSecret) {
  console.warn("[Auth] JWT_SECRET is not set: using a per-process secret. Access tokens end at every restart (refresh tokens survive).");
}

server.listen(PORT, HOST, () => {
  console.log(`Samaritan API + WS running on ${HOST}:${PORT}`);
  ensureEnrollmentKey().then((file) => {
    if (file) console.log(`[Auth] Local device enrollment key: ${file}`);
  });
  const prune = () => pruneRefreshTokens().catch((error) => console.error("[Auth] Token prune failed:", error));
  prune();
  setInterval(prune, PRUNE_INTERVAL_MS).unref();
  startSessionExpiryChecker();
  startMinuteLogger();
  startProjectTimeAggregation();
  startCalendarTrackingLifecycle();
  startCalendarReminderScheduler();
  startSmartBreakLifecycle();
  startReportScheduler();
});
