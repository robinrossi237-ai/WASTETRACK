import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { broadcastNotification } from '../services/notificationsService';

const broadcastSchema = z.object({
  message: z.string().trim().min(1).max(500),
  area: z.string().trim().min(1).max(128).optional(),
  role: z.enum(['resident', 'collector', 'admin']).optional(),
});

export const adminBroadcastNotification: RequestHandler = asyncHandler(async (req, res) => {
  const body = broadcastSchema.parse(req.body);
  const count = await broadcastNotification(
    {
      area: body.area,
      role: body.role,
    },
    body.message
  );

  res.status(200).json({ success: true, sent: count });
});
