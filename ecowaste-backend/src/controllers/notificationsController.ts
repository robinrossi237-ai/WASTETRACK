import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { listNotificationsForUser, markNotificationRead, markAllNotificationsRead } from '../services/notificationsService';

const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listMyNotifications: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new HttpError('Unauthorized', 401);
  }

  const notifications = await listNotificationsForUser(userId);
  res.status(200).json({ success: true, notifications });
});

export const markMyNotificationRead: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new HttpError('Unauthorized', 401);
  }

  const params = notificationIdParamsSchema.parse(req.params);
  await markNotificationRead(userId, params.id);
  res.status(200).json({ success: true });
});

export const markMyNotificationsReadAll: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new HttpError('Unauthorized', 401);
  }

  const count = await markAllNotificationsRead(userId);
  res.status(200).json({ success: true, updated: count });
});
