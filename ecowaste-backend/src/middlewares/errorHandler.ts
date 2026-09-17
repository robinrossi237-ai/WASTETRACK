import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env';

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode =
    err instanceof HttpError ? err.statusCode : err instanceof ZodError ? 400 : 500;
  const message =
    err instanceof ZodError
      ? 'Validation error'
      : err instanceof Error
        ? err.message
        : 'Internal Server Error';

  const payload: {
    success: false;
    message: string;
    stack?: string;
    code?: string;
    details?: unknown;
    errors?: ZodError['issues'];
  } = {
    success: false,
    message,
  };

  if (err instanceof HttpError && err.code) {
    payload.code = err.code;
  }

  if (err instanceof HttpError && err.details !== undefined) {
    payload.details = err.details;
  }

  if (err instanceof ZodError) {
    payload.errors = err.issues;
  }

  if (env.NODE_ENV === 'development' && err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};
