import express from 'express';
import { createServer } from "http";
import activityRoutes from './routes/activity';
import analyticsRoutes from './routes/analytics';
import focusRoutes from './routes/focus';
import cors from 'cors';
import { startMinuteLogger } from "./services/minuteLogger";
import { startSessionExpiryChecker } from './services/sessionExpiry';
import { initWebSocket } from "./websocket/manager";
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

app.get('/health', (req, res) => {
  res.json({ status: "OK", ws: true });
});

// Attach WebSocket server to same HTTP server
initWebSocket(server);

server.listen(4000, () => {
  console.log("API + WS running on http://localhost:4000");
  startSessionExpiryChecker();
  startMinuteLogger();
});