import type { Request } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';

import { HttpError } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { persistDataUriUpload } from '../services/uploadsService';

const uploadBodySchema = z.object({
  data_uri: z.string().trim().min(1),
  category: z.string().trim().max(64).optional(),
});

const resolveRequestOrigin = (req: Request): string => {
  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host');
  if (!host) {
    throw new HttpError('Unable to resolve upload host.', 500);
  }
  return `${protocol}://${host}`;
};

export const createUpload: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const body = uploadBodySchema.parse(req.body ?? {});
  const upload = await persistDataUriUpload({
    dataUri: body.data_uri,
    category: body.category,
    userId,
  });

  const origin = resolveRequestOrigin(req);
  res.status(201).json({
    success: true,
    upload: {
      url: `${origin}${upload.relativeUrl}`,
      relative_url: upload.relativeUrl,
      mime_type: upload.mimeType,
      size_bytes: upload.sizeBytes,
    },
  });
});
