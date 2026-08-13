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
import cors from 'cors';
import { startMinuteLogger } from "./services/minuteLogger";
import { startSessionExpiryChecker } from './services/sessionExpiry';
import { startProjectTimeAggregation } from "./jobs/aggregateProjectTime";
import { initWebSocket } from "./websocket/manager";
import { startCalendarTrackingLifecycle } from "./services/calendarTrackingService";
import { startCalendarReminderScheduler } from "./services/calendarReminderService";
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
});
