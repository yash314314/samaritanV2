import express from 'express';
import { createServer } from "http";
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
import webhooksRoutes from './routes/webhooks';
import cors from 'cors';
import { startMinuteLogger } from "./services/minuteLogger";
import { startSessionExpiryChecker } from './services/sessionExpiry';
import { startProjectTimeAggregation } from "./jobs/aggregateProjectTime";
import { initWebSocket } from "./websocket/manager";
import { startCalendarTrackingLifecycle } from "./services/calendarTrackingService";
import { startCalendarReminderScheduler } from "./services/calendarReminderService";
import { startSmartBreakLifecycle } from "./services/smartBreakService";
import { startWebhookDispatcher } from "./services/webhookService";
import "./websocket/handlers"; // Register WS message handlers

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000"
  })
);

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
app.use('/api/webhooks', webhooksRoutes);

app.get('/health', (req, res) => {
  res.json({ status: "OK", ws: true });
});

// Attach WebSocket server to same HTTP server
initWebSocket(server);

server.listen(4000, () => {
  console.log("API + WS running on http://localhost:4000");
  startSessionExpiryChecker();
  startMinuteLogger();
  startProjectTimeAggregation();
  startCalendarTrackingLifecycle();
  startCalendarReminderScheduler();
  startSmartBreakLifecycle();
  startWebhookDispatcher();
});
