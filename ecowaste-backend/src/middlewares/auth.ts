import type { RequestHandler } from 'express';

import { HttpError } from './errorHandler';
import { getBearerToken, verifyAccessToken } from '../services/authService';
import type { UserRole } from '../models/user';
import { findUserById } from '../services/userService';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = getBearerToken(req.header('authorization'));
  if (!token) {
    next(new HttpError('Unauthorized', 401));
    return;
  }

  void (async () => {
    const { userId } = verifyAccessToken(token);
    const user = await findUserById(userId);

    if (!user) {
      throw new HttpError('Unauthorized', 401);
    }

    if (!user.is_active) {
      throw new HttpError('Account is disabled', 403);
    }

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
      area: user.area,
      subscription_plan: user.subscription_plan,
      collector_verification_status: user.collector_verification_status,
      collector_verification_note: user.collector_verification_note,
      collector_submitted_at: user.collector_submitted_at,
      collector_verified_at: user.collector_verified_at,
      collector_auto_location_tracking: user.collector_auto_location_tracking,
      collector_exit_location_capture_enabled: user.collector_exit_location_capture_enabled,
    };
  })()
    .then(() => next())
    .catch((err) => next(err));
};

export const requireRole = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError('Unauthorized', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new HttpError('Forbidden', 403));
      return;
    }

    next();
  };
};
