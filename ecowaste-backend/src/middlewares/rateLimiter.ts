import type { RequestHandler } from 'express';

import { env } from '../config/env';
import { getBearerToken, verifyAccessToken } from '../services/authService';

type RateLimitRequest = Parameters<RequestHandler>[0];

type Bucket = {
  count: number;
  resetAtMs: number;
};

type RateLimiterOptions = {
  windowMs: number;
  max: number | ((req: RateLimitRequest) => number);
  keyGenerator?: (req: RateLimitRequest) => string;
  skip?: (req: RateLimitRequest) => boolean;
};

const createRateLimiter = (options: RateLimiterOptions): RequestHandler => {
  const buckets = new Map<string, Bucket>();
  let lastCleanupAtMs = 0;

  const cleanup = (nowMs: number) => {
    if (nowMs - lastCleanupAtMs < options.windowMs) return;
    lastCleanupAtMs = nowMs;

    for (const [key, bucket] of buckets) {
      if (nowMs > bucket.resetAtMs) {
        buckets.delete(key);
      }
    }
  };

  const resolveMaxForRequest = (req: RateLimitRequest): number => {
    const value = typeof options.max === 'function' ? options.max(req) : options.max;
    if (!Number.isFinite(value) || value <= 0) {
      return 1;
    }
    return Math.floor(value);
  };

  return (req, res, next) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    const nowMs = Date.now();
    cleanup(nowMs);
    const max = resolveMaxForRequest(req);

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip ?? req.socket.remoteAddress ?? 'unknown');
    const current = buckets.get(key);

    if (!current || nowMs > current.resetAtMs) {
      buckets.set(key, { count: 1, resetAtMs: nowMs + options.windowMs });
    } else {
      current.count += 1;
    }

    const bucket = buckets.get(key);
    if (!bucket) {
      next();
      return;
    }

    const remaining = Math.max(max - bucket.count, 0);
    const resetSeconds = Math.ceil(bucket.resetAtMs / 1000);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAtMs - nowMs) / 1000), 1);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
};

const resolveClientIp = (req: RateLimitRequest): string =>
  req.ip ?? req.socket.remoteAddress ?? 'unknown';

const requestIdentityCache = new WeakMap<RateLimitRequest, string>();

const resolveRateLimitIdentity = (req: RateLimitRequest): string => {
  const cached = requestIdentityCache.get(req);
  if (cached) {
    return cached;
  }

  const token = getBearerToken(req.header('authorization'));
  if (token) {
    try {
      const { userId } = verifyAccessToken(token);
      const identity = `user:${userId}`;
      requestIdentityCache.set(req, identity);
      return identity;
    } catch {
      // Fall back to IP identity when the token is absent/invalid.
    }
  }

  const identity = `ip:${resolveClientIp(req)}`;
  requestIdentityCache.set(req, identity);
  return identity;
};

const shouldSkipApiLimiter = (req: RateLimitRequest): boolean => {
  return req.path === '/api/health' || req.path === '/api/realtime/stream';
};

export const apiRateLimiter: RequestHandler = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: (req) =>
    resolveRateLimitIdentity(req).startsWith('user:')
      ? env.RATE_LIMIT_AUTHENTICATED_MAX
      : env.RATE_LIMIT_MAX,
  keyGenerator: resolveRateLimitIdentity,
  skip: shouldSkipApiLimiter,
});

export const authRateLimiter: RequestHandler = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  keyGenerator: (req) => `ip:${resolveClientIp(req)}:auth`,
});
