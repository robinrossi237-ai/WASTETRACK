import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import {
  createPickupRequest,
  createWasteReport,
  confirmPickupCompletion,
  confirmReportCleanup,
  listMyPickups,
  listMyRewards,
  listMyWasteReports,
  reschedulePickup,
  cancelPickup,
  cancelWasteReport,
} from '../services/residentService';
import { getPickupQuota } from '../services/subscriptionService';
import { createFeedback } from '../services/feedbackService';

const optionalFiniteNumberSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return value;
  return n;
}, z.number().optional());

const requiredFiniteNumberSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'string' && value.trim() === '') return value;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return value;
  return n;
}, z.number());

const createReportBodySchema = z
  .object({
    report_type: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .refine((value) => ['illegal_dumping', 'overflowing_bin', 'other'].includes(value), {
        message: 'Invalid report_type',
      })
      .optional(),
    location_text: z.string().trim().min(1).optional(),
    photo_url: z.string().trim().url().optional(),
    description: z.string().trim().min(1).optional(),
    latitude: requiredFiniteNumberSchema,
    longitude: requiredFiniteNumberSchema,
    priority: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .refine((value) => ['normal', 'high', 'emergency'].includes(value), {
        message: 'Invalid priority',
      })
      .optional()
      .default('normal'),
  })
  .refine((value) => value.latitude >= -90 && value.latitude <= 90, {
    message: 'latitude must be between -90 and 90',
  })
  .refine((value) => value.longitude >= -180 && value.longitude <= 180, {
    message: 'longitude must be between -180 and 180',
  });

const ratingSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return value;
}, z.number().int().min(1).max(5));

const feedbackBodySchema = z.object({
  rating: ratingSchema,
  message: z.string().trim().max(2000).optional(),
});

const wasteTypeSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine(
    (value) =>
      ['household', 'plastic', 'organic', 'electronic', 'hazardous', 'metal', 'mixed'].includes(
        value
      ),
    {
      message: 'Invalid waste_type',
    }
  );

const pickupCategorySchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => ['standard', 'bulk', 'hazardous'].includes(value), {
    message: 'Invalid pickup_category',
  })
  .optional();

const createPickupBodySchema = z
  .object({
    waste_type: wasteTypeSchema,
    scheduled_date: z.string().datetime(),
    description: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    photo_url: z.string().trim().url().optional(),
    pickup_category: pickupCategorySchema,
    distance_km: optionalFiniteNumberSchema,
    latitude: requiredFiniteNumberSchema,
    longitude: requiredFiniteNumberSchema,
  })
  .refine((value) => value.latitude >= -90 && value.latitude <= 90, {
    message: 'latitude must be between -90 and 90',
  })
  .refine((value) => value.longitude >= -180 && value.longitude <= 180, {
    message: 'longitude must be between -180 and 180',
  })
  .refine((value) => value.distance_km === undefined || value.distance_km >= 0, {
    message: 'distance_km must be >= 0',
  });

const pickupIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const completionConfirmationBodySchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const residentCreateReport: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const body = createReportBodySchema.parse(req.body);

  const report = await createWasteReport(userId, {
    photoUrl: body.photo_url,
    description: body.description,
    latitude: body.latitude,
    longitude: body.longitude,
    reportType: body.report_type,
    locationText: body.location_text,
    priority: body.priority as "normal" | "high" | "emergency",
  });

  res.status(201).json({ success: true, report });
});

export const residentCreateFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const body = feedbackBodySchema.parse(req.body);
  await createFeedback(userId, {
    rating: body.rating,
    message: body.message?.trim() || null,
  });

  res.status(201).json({ success: true });
});

export const residentListMyReports: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const reports = await listMyWasteReports(userId);
  res.status(200).json({ success: true, reports });
});

export const residentCancelReport: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const params = pickupIdParamsSchema.parse(req.params);
  await cancelWasteReport(userId, params.id);
  res.status(200).json({ success: true });
});

export const residentCreatePickup: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const body = createPickupBodySchema.parse(req.body);

  const pickup = await createPickupRequest(userId, {
    wasteType: body.waste_type,
    scheduledDate: body.scheduled_date,
    description: body.description,
    address: body.address,
    photoUrl: body.photo_url,
    pickupCategory: body.pickup_category,
    distanceKm: body.distance_km,
    latitude: body.latitude,
    longitude: body.longitude,
  });

  res.status(201).json({ success: true, pickup });
});

export const residentListMyPickups: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const pickups = await listMyPickups(userId);
  res.status(200).json({ success: true, pickups });
});

export const residentListMyRewards: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const rewards = await listMyRewards(userId);
  res.status(200).json({ success: true, rewards });
});

const rescheduleBodySchema = z.object({
  scheduled_date: z.string().datetime(),
});

export const residentReschedulePickup: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const params = pickupIdParamsSchema.parse(req.params);
  const body = rescheduleBodySchema.parse(req.body);

  await reschedulePickup(userId, params.id, body.scheduled_date);
  res.status(200).json({ success: true });
});

export const residentCancelPickup: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const params = pickupIdParamsSchema.parse(req.params);
  await cancelPickup(userId, params.id);
  res.status(200).json({ success: true });
});

export const residentConfirmPickupCompletion: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const params = pickupIdParamsSchema.parse(req.params);
  const body = completionConfirmationBodySchema.parse(req.body ?? {});
  await confirmPickupCompletion(userId, params.id, {
    approved: body.approved,
    note: body.note,
  });

  res.status(200).json({ success: true });
});

export const residentConfirmReportCleanup: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const params = pickupIdParamsSchema.parse(req.params);
  const body = completionConfirmationBodySchema.parse(req.body ?? {});
  await confirmReportCleanup(userId, params.id, {
    approved: body.approved,
    note: body.note,
  });

  res.status(200).json({ success: true });
});

export const residentGetPickupQuota: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const quota = await getPickupQuota(userId);
  res.status(200).json({ success: true, quota });
});
