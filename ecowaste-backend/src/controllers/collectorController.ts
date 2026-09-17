import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { createAccessToken } from '../services/authService';
import {
  completePickupAssignment,
  listAssignedPickups,
  listPickupHistory,
  startPickupAssignment,
  reportPickupIssue,
  getCollectorAssignment,
  cleanWasteReport,
  getCollectorWasteReport,
  listAssignedReports,
  listReportHistory,
  reportWasteReportIssue,
} from '../services/collectorService';
import { updateUserRole } from '../services/userService';
import { listCollectorPendingOffers, respondCollectorOffer } from '../services/dispatchService';

const assignmentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const collectorListAssigned: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const assignments = await listAssignedPickups(collectorId);
  res.status(200).json({ success: true, assignments });
});

export const collectorListHistory: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const assignments = await listPickupHistory(collectorId);
  res.status(200).json({ success: true, assignments });
});

export const collectorGetAssignment: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  const assignment = await getCollectorAssignment(collectorId, params.id);
  res.status(200).json({ success: true, assignment });
});

export const collectorStartAssignment: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  await startPickupAssignment(collectorId, params.id);
  res.status(200).json({ success: true });
});

export const collectorCompleteAssignment: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  const body = z
    .object({
      completionPhotoUrl: z
        .preprocess((value) => {
          if (value === undefined) return undefined;
          if (value === null) return null;
          if (typeof value !== 'string') return value;
          const trimmed = value.trim();
          return trimmed ? trimmed : null;
        }, z.string().min(1).nullable().optional())
        .optional(),
      completionNote: z
        .preprocess((value) => {
          if (value === undefined) return undefined;
          if (value === null) return null;
          if (typeof value !== 'string') return value;
          const trimmed = value.trim();
          return trimmed ? trimmed : null;
        }, z.string().min(1).nullable().optional())
        .optional(),
    })
    .partial()
    .parse(req.body ?? {});

  await completePickupAssignment(collectorId, params.id, {
    completionPhotoUrl: body.completionPhotoUrl ?? null,
    completionNote: body.completionNote ?? null,
  });
  res.status(200).json({ success: true });
});

export const collectorReportIssue: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  const body = z
    .object({
      reason: z.string().trim().min(1),
      note: z.string().trim().min(1).optional(),
    })
    .parse(req.body);

  await reportPickupIssue(collectorId, params.id, body);
  res.status(200).json({ success: true });
});

export const collectorListAssignedReports: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const reports = await listAssignedReports(collectorId);
  res.status(200).json({ success: true, reports });
});

export const collectorListReportHistory: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const reports = await listReportHistory(collectorId);
  res.status(200).json({ success: true, reports });
});

export const collectorGetReport: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  const report = await getCollectorWasteReport(collectorId, params.id);
  res.status(200).json({ success: true, report });
});

export const collectorCleanReport: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  const body = z
    .object({
      cleanedPhotoUrl: z
        .preprocess((value) => {
          if (value === undefined) return undefined;
          if (value === null) return null;
          if (typeof value !== 'string') return value;
          const trimmed = value.trim();
          return trimmed ? trimmed : null;
        }, z.string().min(1).nullable().optional())
        .optional(),
      cleanedNote: z
        .preprocess((value) => {
          if (value === undefined) return undefined;
          if (value === null) return null;
          if (typeof value !== 'string') return value;
          const trimmed = value.trim();
          return trimmed ? trimmed : null;
        }, z.string().min(1).nullable().optional())
        .optional(),
    })
    .partial()
    .parse(req.body ?? {});

  await cleanWasteReport(collectorId, params.id, {
    cleanedPhotoUrl: body.cleanedPhotoUrl ?? null,
    cleanedNote: body.cleanedNote ?? null,
  });
  res.status(200).json({ success: true });
});

export const collectorReportWasteReportIssue: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const params = assignmentIdParamsSchema.parse(req.params);
  const body = z
    .object({
      reason: z.string().trim().min(1),
      note: z.string().trim().min(1).optional(),
    })
    .parse(req.body);

  await reportWasteReportIssue(collectorId, params.id, body);
  res.status(200).json({ success: true });
});

export const collectorSwitchRole: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const body = z
    .object({
      role: z.literal('resident'),
    })
    .parse(req.body ?? { role: 'resident' });

  const user = await updateUserRole(collectorId, body.role);
  const token = createAccessToken({ id: user.id, role: user.role });

  res.status(200).json({ success: true, token, user });
});

export const collectorListPendingOffers: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);

  const offers = await listCollectorPendingOffers(collectorId);
  res.status(200).json({ success: true, offers });
});

export const collectorAcceptOffer: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);
  const params = assignmentIdParamsSchema.parse(req.params);

  const result = await respondCollectorOffer({
    collectorId,
    offerId: params.id,
    action: 'accept',
  });

  res.status(200).json({ success: true, result });
});

export const collectorRejectOffer: RequestHandler = asyncHandler(async (req, res) => {
  const collectorId = req.user?.id;
  if (!collectorId) throw new HttpError('Unauthorized', 401);
  const params = assignmentIdParamsSchema.parse(req.params);
  const body = z
    .object({
      reason: z.string().trim().min(1).max(300).optional(),
    })
    .parse(req.body ?? {});

  const result = await respondCollectorOffer({
    collectorId,
    offerId: params.id,
    action: 'reject',
    rejectionReason: body.reason,
  });

  res.status(200).json({ success: true, result });
});
