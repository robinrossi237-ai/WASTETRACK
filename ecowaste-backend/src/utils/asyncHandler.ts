import type { RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2]
) => Promise<void>;

export const asyncHandler = (handler: AsyncRequestHandler): RequestHandler => {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
};
