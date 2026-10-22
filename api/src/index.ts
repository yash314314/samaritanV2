import "dotenv/config"; // Must run first: modules below read process.env at load time
import express from 'express';
import { createServer } from "http";
import authRoutes from './routes/auth';
import reportsRoutes from './routes/reports';
import activityRoutes from './routes/activity';
import analyticsRoutes from './routes/analytics';
import focusRoutes from './routes/focus';
import projectsRoutes from './routes/projects';
import projectRulesRoutes from './routes/projectRules';
import calendarRoutes from './routes/calendar';
import goalsRoutes from './routes/goals';
import ratingsRoutes from './routes/ratings';
import breaksRoutes from './routes/breaks';
import distractionBlocksRoutes from './routes/distractionBlocks';
import preferencesRoutes from './routes/preferences';
import cors from 'cors';
import { startMinuteLogger } from "./services/minuteLogger";
import { startSessionExpiryChecker } from './services/sessionExpiry';
import { startProjectTimeAggregation } from "./jobs/aggregateProjectTime";
import { initWebSocket } from "./websocket/manager";
import { startCalendarTrackingLifecycle } from "./services/calendarTrackingService";
import { startCalendarReminderScheduler } from "./services/calendarReminderService";
import { startSmartBreakLifecycle } from "./services/smartBreakService";
import { startReportScheduler } from "./services/reportScheduler";
import { isAllowedOrigin } from "./utils/origin";
import "./websocket/handlers"; // Register WS message handlers

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  })
);

// Auth & Reports Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);

// Core Modules Routes
app.use('/activity', activityRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/focus', focusRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/projects', projectRulesRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/breaks', breaksRoutes);
app.use('/api/distraction-blocks', distractionBlocksRoutes);
app.use('/api/preferences', preferencesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: "OK", ws: true, timestamp: new Date().toISOString() });
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API Error:", err);
  const status = typeof err.status === "number" ? err.status : 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
});

// Attach WebSocket server to same HTTP server
initWebSocket(server);

const PORT = Number(process.env.PORT) || 4000;
// Loopback by default: the API has no enforced auth. Containers set HOST=0.0.0.0.
const HOST = process.env.HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`Samaritan API + WS running on ${HOST}:${PORT}`);
  startSessionExpiryChecker();
  startMinuteLogger();
  startProjectTimeAggregation();
  startCalendarTrackingLifecycle();
  startCalendarReminderScheduler();
  startSmartBreakLifecycle();
  startReportScheduler();
});
