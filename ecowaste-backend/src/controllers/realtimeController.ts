import type { RequestHandler, Response } from 'express';

import { HttpError } from '../middlewares/errorHandler';
import { getBearerToken, verifyAccessToken } from '../services/authService';
import { findUserById } from '../services/userService';
import { shouldDeliverRealtimeEvent, subscribeRealtimeEvents } from '../services/realtimeService';

const writeSseMessage = (res: Response, payload: unknown, id?: number) => {
  if (typeof id === 'number') {
    res.write(`id: ${id}\n`);
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const resolveToken = (authorization?: string, queryToken?: unknown): string | null => {
  const fromHeader = getBearerToken(authorization);
  if (fromHeader) return fromHeader;

  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  if (Array.isArray(queryToken)) {
    const first = queryToken.find((entry) => typeof entry === 'string' && entry.trim());
    if (typeof first === 'string') {
      return first.trim();
    }
  }

  return null;
};

export const streamRealtimeEvents: RequestHandler = (req, res, next) => {
  void (async () => {
    const token = resolveToken(req.header('authorization'), req.query.token);
    if (!token) {
      throw new HttpError('Unauthorized', 401);
    }

    const { userId } = verifyAccessToken(token);
    const user = await findUserById(userId);
    if (!user || !user.is_active) {
      throw new HttpError('Unauthorized', 401);
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    writeSseMessage(res, {
      type: 'connected',
      timestamp: new Date().toISOString(),
      payload: { userId: user.id, role: user.role },
    });

    const heartbeatId = setInterval(() => {
      writeSseMessage(res, {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        payload: {},
      });
    }, 25_000);

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (!shouldDeliverRealtimeEvent(event, { id: user.id, role: user.role })) {
        return;
      }
      writeSseMessage(res, event, event.id);
    });

    const cleanup = () => {
      clearInterval(heartbeatId);
      unsubscribe();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
  })().catch((err) => next(err));
};
