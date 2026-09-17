import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { searchNeighborhoods } from '../services/locationService';
import {
  listCollectorLocationsForAdmin,
  listCollectorLocationsForResident,
  upsertUserLocation,
} from '../services/locationTrackingService';

const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
});

const optionalFiniteNumberSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return value;
  return n;
}, z.number().optional());

const locationUpdateSchema = z
  .object({
    latitude: optionalFiniteNumberSchema,
    longitude: optionalFiniteNumberSchema,
    accuracy: optionalFiniteNumberSchema,
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    { message: 'latitude and longitude must be provided together' }
  )
  .refine(
    (value) => value.latitude === undefined || (value.latitude >= -90 && value.latitude <= 90),
    {
      message: 'latitude must be between -90 and 90',
    }
  )
  .refine(
    (value) => value.longitude === undefined || (value.longitude >= -180 && value.longitude <= 180),
    {
      message: 'longitude must be between -180 and 180',
    }
  );

export const listNeighborhoods: RequestHandler = asyncHandler(async (req, res) => {
  const query = searchSchema.parse(req.query);
  const items = await searchNeighborhoods(query.q ?? '');
  res.status(200).json({ success: true, neighborhoods: items });
});

export const trackMyLocation: RequestHandler = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new HttpError('Unauthorized', 401);

  const body = locationUpdateSchema.parse(req.body ?? {});
  if (body.latitude === undefined || body.longitude === undefined) {
    throw new HttpError('latitude and longitude are required', 400);
  }

  const location = await upsertUserLocation({
    userId: user.id,
    role: user.role,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy ?? null,
  });

  res.status(200).json({ success: true, location });
});

export const listCollectorLocations: RequestHandler = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new HttpError('Unauthorized', 401);

  if (user.role === 'admin') {
    const collectors = await listCollectorLocationsForAdmin();
    res.status(200).json({ success: true, collectors });
    return;
  }

  if (user.role === 'resident') {
    const collectors = await listCollectorLocationsForResident(user.id);
    res.status(200).json({ success: true, collectors });
    return;
  }

  throw new HttpError('Forbidden', 403);
});
