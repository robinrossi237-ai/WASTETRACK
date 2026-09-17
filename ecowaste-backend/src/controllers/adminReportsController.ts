import type { RequestHandler } from 'express';
import { z } from 'zod';

import { REPORT_STATUSES } from '../models/enums';
import { asyncHandler } from '../utils/asyncHandler';
import {
  assignReportCollector,
  listReports,
  signalNearestCollectorsForReport,
  updateReportStatus,
} from '../services/adminReportsService';
import { HttpError } from '../middlewares/errorHandler';
import { writeAuditLog } from '../services/auditService';

const listReportsQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
});

const reportIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(REPORT_STATUSES),
});

const assignBodySchema = z.object({
  collector_id: z.string().uuid(),
});

const signalNearestCollectorsBodySchema = z.object({
  max_collectors: z.number().int().min(1).max(3).optional(),
});

export const adminListReports: RequestHandler = asyncHandler(async (req, res) => {
  const query = listReportsQuerySchema.parse(req.query);
  const reports = await listReports({ status: query.status });
  res.status(200).json({ success: true, reports });
});

export const adminUpdateReportStatus: RequestHandler = asyncHandler(async (req, res) => {
  const params = reportIdParamsSchema.parse(req.params);
  const body = updateStatusBodySchema.parse(req.body);

  const adminId = req.user?.id;
  if (!adminId) {
    throw new HttpError('Unauthorized', 401);
  }

  await updateReportStatus(params.id, body.status, adminId);
  await writeAuditLog({
    entityType: 'waste_report',
    entityId: params.id,
    action: `status:${body.status}`,
    actorId: adminId,
  });
  res.status(200).json({ success: true });
});

export const adminAssignReportCollector: RequestHandler = asyncHandler(async (req, res) => {
  const params = reportIdParamsSchema.parse(req.params);
  const body = assignBodySchema.parse(req.body);

  await assignReportCollector(params.id, body.collector_id);
  await writeAuditLog({
    entityType: 'waste_report',
    entityId: params.id,
    action: 'assigned_collector',
    actorId: req.user?.id,
    metadata: { collector_id: body.collector_id },
  });
  res.status(200).json({ success: true });
});

export const adminSignalNearestCollectorsForReport: RequestHandler = asyncHandler(
  async (req, res) => {
    const params = reportIdParamsSchema.parse(req.params);
    const body = signalNearestCollectorsBodySchema.parse(req.body ?? {});
    const result = await signalNearestCollectorsForReport(params.id, body.max_collectors ?? 3);

    await writeAuditLog({
      entityType: 'waste_report',
      entityId: params.id,
      action: 'dispatch_nearest_collectors',
      actorId: req.user?.id,
      metadata: {
        max_collectors: body.max_collectors ?? 3,
        dispatched: result.dispatched,
        offers_created: result.offers?.length ?? 0,
        reason: result.reason,
      },
    });

    res.status(200).json({
      success: true,
      dispatched: result.dispatched,
      offers_created: result.offers?.length ?? 0,
      reason: result.reason,
    });
  }
);
