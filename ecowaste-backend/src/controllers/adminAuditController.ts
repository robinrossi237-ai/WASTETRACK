import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { listAuditLogs } from '../services/auditService';

const querySchema = z.object({
  entity_type: z.string().trim().min(1).optional(),
  entity_id: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const adminListAuditLogs: RequestHandler = asyncHandler(async (req, res) => {
  const query = querySchema.parse(req.query);

  const logs = await listAuditLogs({
    entityType: query.entity_type,
    entityId: query.entity_id,
    limit: query.limit,
  });

  res.status(200).json({ success: true, logs });
});
