import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { COLLECTOR_VERIFICATION_STATUSES, USER_ROLES } from '../models/user';
import { getPlanById } from '../services/planService';
import {
  deleteUserAndRelatedData,
  listCollectorApplications,
  listCollectors,
  listUsers,
  reviewCollectorApplication,
  setUserActive,
} from '../services/adminUsersService';
import { setSubscriptionPlan } from '../services/userService';
import { HttpError } from '../middlewares/errorHandler';

const optionalBooleanSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return value;
}, z.boolean().optional());

const listUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  active: optionalBooleanSchema,
});

const setActiveParamsSchema = z.object({
  id: z.string().uuid(),
});

const setActiveBodySchema = z.object({
  is_active: z.boolean(),
});

const listCollectorApplicationsQuerySchema = z.object({
  status: z.enum(COLLECTOR_VERIFICATION_STATUSES).optional(),
});

const reviewCollectorBodySchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    rejection_reason: z.string().trim().min(2).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'rejected' && !value.rejection_reason) {
      ctx.addIssue({
        path: ['rejection_reason'],
        code: z.ZodIssueCode.custom,
        message: 'Rejection reason is required when rejecting a collector application',
      });
    }
  });

export const adminListUsers: RequestHandler = asyncHandler(async (req, res) => {
  const query = listUsersQuerySchema.parse(req.query);

  const users = await listUsers({
    q: query.q,
    role: query.role,
    active: query.active,
  });

  res.status(200).json({
    success: true,
    users,
  });
});

export const adminSetUserActive: RequestHandler = asyncHandler(async (req, res) => {
  const params = setActiveParamsSchema.parse(req.params);
  const body = setActiveBodySchema.parse(req.body);

  if (req.user?.id === params.id && body.is_active === false) {
    throw new HttpError('You cannot deactivate your own account', 400);
  }

  await setUserActive(params.id, body.is_active);

  res.status(200).json({ success: true });
});

export const adminDeleteUser: RequestHandler = asyncHandler(async (req, res) => {
  const params = setActiveParamsSchema.parse(req.params);
  const adminId = req.user?.id;
  if (!adminId) {
    throw new HttpError('Unauthorized', 401);
  }

  const result = await deleteUserAndRelatedData({
    userId: params.id,
    adminId,
  });

  res.status(200).json({
    success: true,
    result,
  });
});

export const adminListCollectors: RequestHandler = asyncHandler(async (_req, res) => {
  const collectors = await listCollectors();
  res.status(200).json({
    success: true,
    collectors,
  });
});

export const adminListCollectorApplications: RequestHandler = asyncHandler(async (req, res) => {
  const query = listCollectorApplicationsQuerySchema.parse(req.query);
  const applications = await listCollectorApplications({ status: query.status });
  res.status(200).json({
    success: true,
    applications,
  });
});

export const adminReviewCollectorApplication: RequestHandler = asyncHandler(async (req, res) => {
  const params = setActiveParamsSchema.parse(req.params);
  const body = reviewCollectorBodySchema.parse(req.body);
  const adminId = req.user?.id;
  if (!adminId) {
    throw new HttpError('Unauthorized', 401);
  }

  await reviewCollectorApplication({
    collectorId: params.id,
    adminId,
    status: body.status,
    rejectionReason: body.rejection_reason,
  });

  res.status(200).json({ success: true });
});

const setPlanParamsSchema = z.object({
  id: z.string().uuid(),
});

const setPlanBodySchema = z.object({
  plan: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,32}$/, 'Unknown plan.'),
});

export const adminSetUserPlan: RequestHandler = asyncHandler(async (req, res) => {
  const params = setPlanParamsSchema.parse(req.params);
  const body = setPlanBodySchema.parse(req.body);

  const plan = await getPlanById(body.plan);
  if (!plan) {
    throw new HttpError('Plan not found.', 404);
  }
  const updatedUser = await setSubscriptionPlan(params.id, plan.id);
  res.status(200).json({ success: true, user: updatedUser });
});
