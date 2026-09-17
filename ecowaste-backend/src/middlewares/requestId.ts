import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  next();
};
