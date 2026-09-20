import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { PAYMENT_METHODS, SUBSCRIPTION_REQUEST_STATUSES } from '../models/plan';
import {
  createSubscriptionRequest,
  listMySubscriptionRequests,
  listSubscriptionRequests,
  reviewSubscriptionRequest,
} from '../services/subscriptionService';

const createRequestBodySchema = z.object({
  plan_id: z.string().trim().toLowerCase().min(1).max(32),
  payment_method: z.enum(PAYMENT_METHODS),
  proof_url: z.string().trim().url().max(2048).optional(),
});

const listRequestsQuerySchema = z.object({
  status: z.enum(SUBSCRIPTION_REQUEST_STATUSES).optional(),
});

const reviewParamsSchema = z.object({
  id: z.string().uuid(),
});

const reviewBodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  admin_note: z.string().trim().min(2).max(500).optional(),
});

export const residentCreateSubscriptionRequest: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const body = createRequestBodySchema.parse(req.body ?? {});
  const request = await createSubscriptionRequest({
    userId,
    planId: body.plan_id,
    paymentMethod: body.payment_method,
    proofUrl: body.proof_url ?? null,
  });
  res.status(201).json({ success: true, request });
});

export const residentListMySubscriptionRequests: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const requests = await listMySubscriptionRequests(userId);
  res.status(200).json({ success: true, requests });
});

export const adminListSubscriptionRequests: RequestHandler = asyncHandler(async (req, res) => {
  const query = listRequestsQuerySchema.parse(req.query ?? {});
  const requests = await listSubscriptionRequests(query.status);
  res.status(200).json({ success: true, requests });
});

export const adminReviewSubscriptionRequest: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user?.id;
  if (!adminId) throw new HttpError('Unauthorized', 401);

  const params = reviewParamsSchema.parse(req.params);
  const body = reviewBodySchema.parse(req.body ?? {});
  const request = await reviewSubscriptionRequest({
    requestId: params.id,
    adminId,
    decision: body.decision,
    adminNote: body.admin_note ?? null,
  });
  res.status(200).json({ success: true, request });
});
