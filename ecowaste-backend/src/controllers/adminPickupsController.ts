import type { RequestHandler } from 'express';
import { z } from 'zod';

import { PICKUP_STATUSES } from '../models/enums';
import { asyncHandler } from '../utils/asyncHandler';
import { listPickups, updatePickupStatus } from '../services/adminPickupsService';
import { HttpError } from '../middlewares/errorHandler';
import { writeAuditLog } from '../services/auditService';

const listPickupsQuerySchema = z.object({
  status: z.enum(PICKUP_STATUSES).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

const pickupIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const updatePickupBodySchema = z.object({
  status: z.enum(PICKUP_STATUSES),
});

export const adminListPickups: RequestHandler = asyncHandler(async (req, res) => {
  const query = listPickupsQuerySchema.parse(req.query);
  const pickups = await listPickups({
    status: query.status,
    fromDate: query.from,
    toDate: query.to,
  });
  res.status(200).json({ success: true, pickups });
});

export const adminUpdatePickupStatus: RequestHandler = asyncHandler(async (req, res) => {
  const params = pickupIdParamsSchema.parse(req.params);
  const body = updatePickupBodySchema.parse(req.body);
  const adminId = req.user?.id;
  if (!adminId) {
    throw new HttpError('Unauthorized', 401);
  }

  await updatePickupStatus(params.id, body.status);
  await writeAuditLog({
    entityType: 'pickup_request',
    entityId: params.id,
    action: `status:${body.status}`,
    actorId: adminId,
  });
  res.status(200).json({ success: true });
});
