import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { RewardReason } from '../models/enums';
import { publishRealtimeEvent } from './realtimeService';
import { dispatchNotificationCreated } from './notificationsService';

export type RewardRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  points: number;
  reason: RewardReason;
  related_entity_id: string | null;
  created_at: string;
};

const isPgErrorWithCode = (err: unknown): err is { code: string } => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return typeof maybe.code === 'string';
};

export const listRewards = async (filters: {
  userId?: string;
  reason?: RewardReason;
}): Promise<RewardRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.userId) {
    params.push(filters.userId);
    where.push(`user_id = $${params.length}`);
  }

  if (filters.reason) {
    params.push(filters.reason);
    where.push(`reason = $${params.length}`);
  }

  const sql = `
    SELECT
      r.id,
      r.user_id,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      r.points,
      r.reason,
      r.related_entity_id,
      r.created_at
    FROM rewards r
    LEFT JOIN users u ON u.id = r.user_id
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.created_at DESC
    LIMIT 500
  `;

  const res = await query<RewardRow>(sql, params);
  return res.rows;
};

export const grantReward = async (input: {
  userId: string;
  points: number;
  reason: RewardReason;
  relatedEntityId?: string | null;
}): Promise<void> => {
  const notificationMessage = `You earned ${input.points} point(s) for: ${input.reason}.`;

  await withTransaction(async (client) => {
    try {
      await client.query(
        `
          INSERT INTO rewards (user_id, points, reason, related_entity_id)
          VALUES ($1, $2, $3, $4)
        `,
        [input.userId, input.points, input.reason, input.relatedEntityId ?? null]
      );
    } catch (err) {
      if (isPgErrorWithCode(err) && err.code === '23503') {
        throw new HttpError('User not found', 400);
      }
      throw err;
    }

    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [input.userId, notificationMessage]
    );
  });

  publishRealtimeEvent({
    type: 'reward.updated',
    payload: {
      user_id: input.userId,
      points: input.points,
      reason: input.reason,
    },
    roles: ['admin'],
    userIds: [input.userId],
  });

  void dispatchNotificationCreated({
    userIds: [input.userId],
    message: notificationMessage,
  });
};
