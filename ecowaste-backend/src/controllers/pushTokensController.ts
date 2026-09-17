import type { RequestHandler } from 'express';
import { z } from 'zod';

import { HttpError } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { deactivatePushToken, upsertPushToken } from '../services/pushTokenService';

const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1).max(255),
  platform: z.enum(['ios', 'android', 'web']),
});

const pushTokenParamSchema = z.object({
  token: z.string().trim().min(1).max(255),
});

export const registerMyPushToken: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new HttpError('Unauthorized', 401);
  }

  const body = registerPushTokenSchema.parse(req.body);
  await upsertPushToken({
    userId,
    token: body.token,
    platform: body.platform,
  });

  res.status(200).json({ success: true });
});

export const unregisterMyPushToken: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new HttpError('Unauthorized', 401);
  }

  const params = pushTokenParamSchema.parse(req.params);
  await deactivatePushToken(userId, params.token);

  res.status(200).json({ success: true });
});
