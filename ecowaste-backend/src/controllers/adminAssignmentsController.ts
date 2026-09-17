import type { RequestHandler } from 'express';
import { z } from 'zod';

import { PICKUP_STATUSES } from '../models/enums';
import { asyncHandler } from '../utils/asyncHandler';
import { createAssignment, listAssignments } from '../services/adminAssignmentsService';
import { writeAuditLog } from '../services/auditService';

const listAssignmentsQuerySchema = z.object({
  status: z.enum(PICKUP_STATUSES).optional(),
});

const createAssignmentBodySchema = z.object({
  pickup_request_id: z.string().uuid(),
  collector_id: z.string().uuid(),
});

export const adminListAssignments: RequestHandler = asyncHandler(async (req, res) => {
  const query = listAssignmentsQuerySchema.parse(req.query);
  const assignments = await listAssignments({ status: query.status });
  res.status(200).json({ success: true, assignments });
});

export const adminCreateAssignment: RequestHandler = asyncHandler(async (req, res) => {
  const body = createAssignmentBodySchema.parse(req.body);

  await createAssignment({
    pickupRequestId: body.pickup_request_id,
    collectorId: body.collector_id,
  });

  await writeAuditLog({
    entityType: 'pickup_request',
    entityId: body.pickup_request_id,
    action: 'assigned_collector',
    actorId: req.user?.id,
    metadata: { collector_id: body.collector_id },
  });

  res.status(201).json({ success: true });
});
