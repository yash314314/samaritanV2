import "dotenv/config"; // Must run first: modules below read process.env at load time
import express from 'express';
import cors from 'cors';
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
import systemRoutes from './routes/system';
import { requireAuth, enforceUserScope } from "./middleware/authMiddleware";
import { isAllowedOrigin, isCredentialOrigin } from "./utils/origin";
import { createRateLimiter, clientIp } from "./utils/rateLimit";
import { prisma } from "./prisma";

function trustProxySetting(value: string | undefined): boolean | number | string {
  if (!value) return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/** The HTTP application without a listening socket or background jobs, so tests can drive it. */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Behind nginx set TRUST_PROXY (e.g. "1") so rate limits see the client address, not the proxy's.
  app.set("trust proxy", trustProxySetting(process.env.TRUST_PROXY));

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
  });

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      callback(null, {
        origin: isAllowedOrigin(origin),
        // Only the dashboard may send the refresh cookie and read what it returns.
        credentials: isCredentialOrigin(origin),
        exposedHeaders: ["Retry-After"],
        maxAge: 600,
      });
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "OK", ws: true, db: "ok", timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "DEGRADED", ws: true, db: "unreachable", timestamp: new Date().toISOString() });
    }
  });

  // Public: sign-in, refresh, registration, device enrollment.
  app.use('/api/auth', authRoutes);

  // Everything below needs a valid access token and is pinned to its user.
  const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 1200,
    key: (req) => clientIp(req),
  });
  app.use(apiLimiter, requireAuth, enforceUserScope);

  app.use('/api/reports', reportsRoutes);
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
  app.use('/api/system', systemRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err.status === "number" ? err.status : typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status >= 500) console.error("Unhandled API Error:", err);
    res.status(status).json({
      // Internal failure details stay in the log.
      error: status >= 500 ? "Internal server error" : err.expose === false ? "Request failed" : err.message || "Request failed",
    });
  });

  return app;
}
