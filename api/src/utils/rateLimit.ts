import type { NextFunction, Request, Response } from "express";

// Fixed-window, in-memory request limiter. One API process serves one
// deployment, so process memory is the right store; a multi-instance
// deployment would need a shared store instead.

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Bucket key for a request; return null to skip limiting it. */
  key: (req: Request) => string | null;
  message?: string;
}

export interface RateLimiter {
  (req: Request, res: Response, next: NextFunction): void;
  /** Clears one key, e.g. after a successful login. */
  reset(key: string): void;
  resetAll(): void;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, Math.max(options.windowMs, 60_000));
  sweep.unref();

  const limiter = ((req: Request, res: Response, next: NextFunction) => {
    const key = options.key(req);
    if (!key) return next();
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: options.message || "Too many requests. Try again later." });
      return;
    }
    next();
  }) as RateLimiter;

  limiter.reset = (key: string) => {
    buckets.delete(key);
  };
  limiter.resetAll = () => buckets.clear();
  return limiter;
}

export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}
