import type { RequestHandler } from 'express';
import { z } from 'zod';

import { env } from '../config/env';
import { HttpError } from '../middlewares/errorHandler';
import { USER_ROLES } from '../models/user';
import { asyncHandler } from '../utils/asyncHandler';
import { createAccessToken, hashPassword, verifyPassword } from '../services/authService';
import {
  createUser,
  findUserForLoginByEmail,
  updateUserLastLogin,
  updateUserProfile,
} from '../services/userService';
import { publishRealtimeEvent } from '../services/realtimeService';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(72),
  phone: z.string().trim().min(1).max(32).optional(),
  area: z.string().trim().min(1).max(128).optional(),
  neighborhood: z.string().trim().min(1).max(128).optional(),
  role: z.enum(USER_ROLES).default('resident'),
  signup_secret: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(72),
});

const optionalNullableTrimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
  }, z.string().min(1).max(maxLength).nullable().optional());

const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    phone: optionalNullableTrimmedString(32),
    area: optionalNullableTrimmedString(128),
    collector_auto_location_tracking: z.boolean().optional(),
    collector_exit_location_capture_enabled: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'No profile fields provided',
  });

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);

  if (input.role === 'admin') {
    if (!env.SIGNUP_SECRET || input.signup_secret !== env.SIGNUP_SECRET) {
      throw new HttpError('Forbidden', 403);
    }
  }

  const email = input.email.toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const area = input.area ?? input.neighborhood;
  const isCollectorApplication = input.role === 'collector';

  const user = await createUser({
    name: input.name,
    email,
    passwordHash,
    phone: input.phone,
    area,
    role: input.role,
    isActive: isCollectorApplication ? false : true,
    collectorVerificationStatus: isCollectorApplication ? 'pending' : 'approved',
    collectorSubmittedAt: isCollectorApplication ? new Date().toISOString() : null,
    collectorVerifiedAt: isCollectorApplication ? null : new Date().toISOString(),
  });

  if (isCollectorApplication) {
    publishRealtimeEvent({
      type: 'collector.application.submitted',
      roles: ['admin'],
      payload: {
        collector_id: user.id,
        name: user.name,
        email: user.email,
        area: user.area,
        status: user.collector_verification_status,
      },
    });

    res.status(201).json({
      success: true,
      pending_approval: true,
      collector_application: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        area: user.area,
        status: user.collector_verification_status,
        submitted_at: user.collector_submitted_at,
      },
    });
    return;
  }

  const token = createAccessToken({ id: user.id, role: user.role });

  res.status(201).json({
    success: true,
    token,
    user,
  });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);

  const email = input.email.toLowerCase();
  const user = await findUserForLoginByEmail(email);

  if (!user) {
    throw new HttpError('Invalid credentials', 401);
  }

  if (!user.is_active) {
    if (user.role === 'collector' && user.collector_verification_status === 'pending') {
      throw new HttpError('Collector application is pending admin validation', 403);
    }
    if (user.role === 'collector' && user.collector_verification_status === 'rejected') {
      const reason = user.collector_verification_note?.trim();
      throw new HttpError(
        reason
          ? `Collector application rejected: ${reason}`
          : 'Collector application was rejected. Please contact admin.',
        403
      );
    }
    throw new HttpError('Account is disabled', 403);
  }

  if (user.role === 'collector' && user.collector_verification_status !== 'approved') {
    throw new HttpError('Collector account is not approved yet', 403);
  }

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    throw new HttpError('Invalid credentials', 401);
  }

  const lastLoginAt = await updateUserLastLogin(user.id);
  const token = createAccessToken({ id: user.id, role: user.role });

  publishRealtimeEvent({
    type: 'user.login',
    roles: ['admin'],
    payload: {
      user_id: user.id,
      role: user.role,
      email: user.email,
      last_login_at: lastLoginAt,
    },
  });

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      area: user.area,
      subscription_plan: user.subscription_plan,
      collector_verification_status: user.collector_verification_status,
      collector_verification_note: user.collector_verification_note,
      collector_submitted_at: user.collector_submitted_at,
      collector_verified_at: user.collector_verified_at,
      collector_auto_location_tracking: user.collector_auto_location_tracking,
      collector_exit_location_capture_enabled: user.collector_exit_location_capture_enabled,
      last_login_at: lastLoginAt,
    },
  });
});

export const updateMe: RequestHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new HttpError('Unauthorized', 401);

  const body = updateMeSchema.parse(req.body);

  const user = await updateUserProfile(userId, {
    name: body.name,
    phone: body.phone,
    area: body.area,
    collectorAutoLocationTracking: body.collector_auto_location_tracking,
    collectorExitLocationCaptureEnabled: body.collector_exit_location_capture_enabled,
  });

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      area: user.area,
      subscription_plan: user.subscription_plan,
      collector_verification_status: user.collector_verification_status,
      collector_verification_note: user.collector_verification_note,
      collector_submitted_at: user.collector_submitted_at,
      collector_verified_at: user.collector_verified_at,
      collector_auto_location_tracking: user.collector_auto_location_tracking,
      collector_exit_location_capture_enabled: user.collector_exit_location_capture_enabled,
    },
  });
});
