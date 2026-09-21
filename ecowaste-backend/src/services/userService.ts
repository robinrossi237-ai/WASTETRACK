import bcrypt from 'bcrypt';

import { query } from '../config/db';
import { env } from '../config/env';
import { HttpError } from '../middlewares/errorHandler';
import type { CollectorVerificationStatus, UserRole } from '../models/user';

type UserAuthRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  area: string | null;
  last_login_at: string | null;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  subscription_plan: string;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note: string | null;
  collector_submitted_at: string | null;
  collector_verified_at: string | null;
  collector_auto_location_tracking: boolean;
  collector_exit_location_capture_enabled: boolean;
};

export type UserMe = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  area: string | null;
  role: UserRole;
  is_active: boolean;
  subscription_plan: string;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note: string | null;
  collector_submitted_at: string | null;
  collector_verified_at: string | null;
  collector_auto_location_tracking: boolean;
  collector_exit_location_capture_enabled: boolean;
};

type UserPublicRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  area: string | null;
  role: UserRole;
  subscription_plan: string;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note: string | null;
  collector_submitted_at: string | null;
  collector_verified_at: string | null;
  collector_auto_location_tracking: boolean;
  collector_exit_location_capture_enabled: boolean;
};

const isPgErrorWithCode = (err: unknown): err is { code: string } => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return typeof maybe.code === 'string';
};

export const createResidentUser = async (input: {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  area?: string;
}): Promise<UserPublicRow> => {
  return createUser({ ...input, role: 'resident' });
};

export const createUser = async (input: {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  area?: string;
  role: UserRole;
  isActive?: boolean;
  collectorVerificationStatus?: CollectorVerificationStatus;
  collectorVerificationNote?: string | null;
  collectorSubmittedAt?: string | null;
  collectorVerifiedAt?: string | null;
}): Promise<UserPublicRow> => {
  try {
    const isActive = input.isActive ?? true;
    const collectorVerificationStatus = input.collectorVerificationStatus ?? 'approved';
    const collectorVerificationNote = input.collectorVerificationNote ?? null;
    const collectorSubmittedAt = input.collectorSubmittedAt ?? null;
    const collectorVerifiedAt = input.collectorVerifiedAt ?? null;

    const result = await query<UserPublicRow>(
      `
        INSERT INTO users (
          name,
          email,
          password_hash,
          phone,
          area,
          role,
          is_active,
          subscription_plan,
          collector_verification_status,
          collector_verification_note,
          collector_submitted_at,
          collector_verified_at,
          collector_auto_location_tracking,
          collector_exit_location_capture_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'free', $8, $9, $10, $11, true, true)
        RETURNING
          id,
          name,
          email,
          phone,
          area,
          role,
          subscription_plan,
          collector_verification_status,
          collector_verification_note,
          collector_submitted_at,
          collector_verified_at,
          collector_auto_location_tracking,
          collector_exit_location_capture_enabled
      `,
      [
        input.name,
        input.email,
        input.passwordHash,
        input.phone ?? null,
        input.area ?? null,
        input.role,
        isActive,
        collectorVerificationStatus,
        collectorVerificationNote,
        collectorSubmittedAt,
        collectorVerifiedAt,
      ]
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  } catch (err) {
    if (isPgErrorWithCode(err) && err.code === '23505') {
      throw new HttpError('Email already in use', 409);
    }
    throw err;
  }
};

export const findUserForLoginByEmail = async (email: string): Promise<UserAuthRow | null> => {
  const result = await query<UserAuthRow>(
    `
      SELECT
        id,
        name,
        email,
        phone,
        area,
        last_login_at,
        password_hash,
        role,
        is_active,
        subscription_plan,
        collector_verification_status,
        collector_verification_note,
        collector_submitted_at,
        collector_verified_at,
        collector_auto_location_tracking,
        collector_exit_location_capture_enabled
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
};

export const updateUserLastLogin = async (userId: string): Promise<string> => {
  const result = await query<{ last_login_at: string }>(
    `
      UPDATE users
      SET last_login_at = now()
      WHERE id = $1
      RETURNING last_login_at
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError('User not found', 404);
  }

  return row.last_login_at;
};

export const findUserById = async (id: string): Promise<UserMe | null> => {
  const result = await query<UserMe>(
    `
      SELECT
        id,
        name,
        email,
        phone,
        area,
        role,
        is_active,
        subscription_plan,
        collector_verification_status,
        collector_verification_note,
        collector_submitted_at,
        collector_verified_at,
        collector_auto_location_tracking,
        collector_exit_location_capture_enabled
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
};

export const updateUserProfile = async (
  userId: string,
  updates: {
    name?: string;
    phone?: string | null;
    area?: string | null;
    collectorAutoLocationTracking?: boolean;
    collectorExitLocationCaptureEnabled?: boolean;
  }
): Promise<UserMe> => {
  const set: string[] = [];
  const params: unknown[] = [userId];

  if (updates.name !== undefined) {
    params.push(updates.name);
    set.push(`name = $${params.length}`);
  }

  if (updates.phone !== undefined) {
    params.push(updates.phone);
    set.push(`phone = $${params.length}`);
  }

  if (updates.area !== undefined) {
    params.push(updates.area);
    set.push(`area = $${params.length}`);
  }

  if (updates.collectorAutoLocationTracking !== undefined) {
    params.push(updates.collectorAutoLocationTracking);
    set.push(`collector_auto_location_tracking = $${params.length}`);
  }

  if (updates.collectorExitLocationCaptureEnabled !== undefined) {
    params.push(updates.collectorExitLocationCaptureEnabled);
    set.push(`collector_exit_location_capture_enabled = $${params.length}`);
  }

  if (set.length === 0) {
    throw new HttpError('No profile fields provided', 400);
  }

  const result = await query<UserMe>(
    `
      UPDATE users
      SET ${set.join(', ')}
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        phone,
        area,
        role,
        is_active,
        subscription_plan,
        collector_verification_status,
        collector_verification_note,
        collector_submitted_at,
        collector_verified_at,
        collector_auto_location_tracking,
        collector_exit_location_capture_enabled
    `,
    params
  );

  const user = result.rows[0];
  if (!user) {
    throw new HttpError('User not found', 404);
  }

  return user;
};

export const updateUserRole = async (userId: string, role: UserRole): Promise<UserMe> => {
  const result = await query<UserMe>(
    `
      UPDATE users
      SET role = $2
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        phone,
        area,
        role,
        is_active,
        subscription_plan,
        collector_verification_status,
        collector_verification_note,
        collector_submitted_at,
        collector_verified_at,
        collector_auto_location_tracking,
        collector_exit_location_capture_enabled
    `,
    [userId, role]
  );

  const user = result.rows[0];
  if (!user) {
    throw new HttpError('User not found', 404);
  }

  return user;
};

export const setSubscriptionPlan = async (
  userId: string,
  plan: string,
): Promise<UserMe> => {
  const result = await query<UserMe>(
    `
      UPDATE users
      SET subscription_plan = $2
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        phone,
        area,
        role,
        is_active,
        subscription_plan,
        collector_verification_status,
        collector_verification_note,
        collector_submitted_at,
        collector_verified_at,
        collector_auto_location_tracking,
        collector_exit_location_capture_enabled
    `,
    [userId, plan],
  );

  const user = result.rows[0];
  if (!user) {
    throw new HttpError('User not found', 404);
  }

  return user;
};

export const updateUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const result = await query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new HttpError('User not found', 404);
  }
  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) {
    throw new HttpError('Current password is incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
  }
  const hash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, hash]);
};
