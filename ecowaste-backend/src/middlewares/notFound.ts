import type { RequestHandler } from 'express';

import { HttpError } from './errorHandler';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(`Not Found - ${req.originalUrl}`, 404));
};
