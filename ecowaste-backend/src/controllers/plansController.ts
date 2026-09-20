import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import {
  createPlan,
  deletePlan,
  getPlanById,
  listPlans,
  updatePlan,
} from '../services/planService';

const planIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,32}$/, 'Plan id must be a 2-32 char slug (letters, digits, dashes).');

const planFeaturesSchema = z.array(z.string().trim().min(1).max(120)).max(20).default([]);

const createPlanBodySchema = z.object({
  id: planIdSchema,
  name: z.string().trim().min(2).max(80),
  price_amount: z.number().int().min(0),
  currency: z.string().trim().min(3).max(3).optional(),
  monthly_limit: z.number().int().positive().nullable().optional(),
  features: planFeaturesSchema,
  is_active: z.boolean().optional(),
});

const updatePlanBodySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  price_amount: z.number().int().min(0).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  monthly_limit: z.number().int().positive().nullable().optional(),
  features: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  is_active: z.boolean().optional(),
});

const planParamsSchema = z.object({
  id: planIdSchema,
});

export const adminListPlans: RequestHandler = asyncHandler(async (_req, res) => {
  const plans = await listPlans(false);
  res.status(200).json({ success: true, plans });
});

export const adminCreatePlan: RequestHandler = asyncHandler(async (req, res) => {
  const body = createPlanBodySchema.parse(req.body ?? {});
  const plan = await createPlan({
    id: body.id,
    name: body.name,
    price_amount: body.price_amount,
    currency: body.currency,
    monthly_limit: body.monthly_limit ?? null,
    features: body.features,
    is_active: body.is_active,
  });
  res.status(201).json({ success: true, plan });
});

export const adminUpdatePlan: RequestHandler = asyncHandler(async (req, res) => {
  const params = planParamsSchema.parse(req.params);
  const body = updatePlanBodySchema.parse(req.body ?? {});
  if (Object.keys(body).length === 0) {
    throw new HttpError('No fields to update.', 400);
  }
  const plan = await updatePlan(params.id, body);
  res.status(200).json({ success: true, plan });
});

export const adminDeletePlan: RequestHandler = asyncHandler(async (req, res) => {
  const params = planParamsSchema.parse(req.params);
  await deletePlan(params.id);
  res.status(200).json({ success: true });
});

export const adminGetPlan: RequestHandler = asyncHandler(async (req, res) => {
  const params = planParamsSchema.parse(req.params);
  const plan = await getPlanById(params.id);
  if (!plan) {
    throw new HttpError('Plan not found.', 404);
  }
  res.status(200).json({ success: true, plan });
});
