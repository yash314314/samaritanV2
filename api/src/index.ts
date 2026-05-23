import express from 'express';
import activityRoutes from './routes/activity';
import analyticsRoutes from './routes/analytics';
import focusRoutes from './routes/focus';
import cors from 'cors';
import { startMinuteLogger } from "./services/minuteLogger";    
import { startSessionExpiryChecker } from './services/sessionExpiry';
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000"
  })
);
app.use('/activity', activityRoutes);

app.get('/health', (req, res) => {
  res.json({ status: "OK" });
});
app.use('/analytics', analyticsRoutes);

app.use('/focus', focusRoutes);

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
  startSessionExpiryChecker(); 
  startMinuteLogger();
});