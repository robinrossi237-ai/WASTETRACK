import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import { publishRealtimeEvent } from './realtimeService';
import { sendPushNotificationToUsers } from './pushService';

export type NotificationCategory = 'pickup' | 'rewards';

export const categorizeNotificationMessage = (message: string): NotificationCategory => {
  const normalized = message.toLowerCase();
  if (normalized.includes('point') || normalized.includes('reward')) {
    return 'rewards';
  }
  return 'pickup';
};

export type NotificationRow = {
  id: string;
  user_id: string;
  message: string;
  category: NotificationCategory;
  is_read: boolean;
  created_at: string;
};

type DispatchNotificationCreatedInput = {
  userIds: string[];
  message: string;
  source?: string;
  title?: string;
  path?: string;
  data?: Record<string, unknown>;
};

export const dispatchNotificationCreated = async (
  input: DispatchNotificationCreatedInput
): Promise<void> => {
  const userIds = Array.from(new Set(input.userIds.map((entry) => entry.trim()).filter(Boolean)));
  if (userIds.length === 0 || !input.message.trim()) {
    return;
  }

  const category = categorizeNotificationMessage(input.message);

  publishRealtimeEvent({
    type: 'notification.created',
    payload: {
      category,
      source: input.source ?? 'system',
    },
    roles: ['admin'],
    userIds,
  });

  try {
    await sendPushNotificationToUsers({
      userIds,
      title: input.title,
      body: input.message,
      path: input.path,
      data: {
        type: 'notification',
        category,
        ...(input.data ?? {}),
      },
    });
  } catch (err) {
    console.error('Failed to dispatch push notification', err);
  }
};

export const listNotificationsForUser = async (userId: string): Promise<NotificationRow[]> => {
  const res = await query<Omit<NotificationRow, 'category'>>(
    `
      SELECT id, user_id, message, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 200
    `,
    [userId]
  );
  return res.rows.map((row) => ({
    ...row,
    category: categorizeNotificationMessage(row.message),
  }));
};

export const markNotificationRead = async (
  userId: string,
  notificationId: string
): Promise<void> => {
  const res = await query<{ id: string }>(
    `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [notificationId, userId]
  );

  if (!res.rows[0]) {
    throw new HttpError('Notification not found', 404);
  }

  publishRealtimeEvent({
    type: 'notification.read',
    payload: {
      notification_id: notificationId,
    },
    userIds: [userId],
  });
};

export const markAllNotificationsRead = async (userId: string): Promise<number> => {
  const res = await query<{ id: string }>(
    `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1
        AND is_read = false
      RETURNING id
    `,
    [userId]
  );

  const count = res.rows.length;

  if (count > 0) {
    publishRealtimeEvent({
      type: 'notification.read',
      payload: {
        notification_id: 'all',
      },
      userIds: [userId],
    });
  }

  return count;
};

type BroadcastFilters = { area?: string; role?: string };

export const broadcastNotification = async (
  filters: BroadcastFilters,
  message: string
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.area) {
    params.push(filters.area.toLowerCase());
    where.push(`LOWER(area) = $${params.length}`);
  }
  if (filters.role) {
    params.push(filters.role);
    where.push(`role = $${params.length}`);
  }

  const userSql = `
    SELECT id
    FROM users
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const users = await query<{ id: string }>(userSql, params);
  if (users.rows.length === 0) return 0;

  const values = users.rows
    .map((_u, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2}, false, now())`)
    .join(', ');

  const insertParams: unknown[] = [];
  users.rows.forEach((u) => {
    insertParams.push(u.id, message);
  });

  await query(
    `
      INSERT INTO notifications (user_id, message, is_read, created_at)
      VALUES ${values}
    `,
    insertParams
  );

  await dispatchNotificationCreated({
    userIds: users.rows.map((row) => row.id),
    message,
    source: 'broadcast',
  });

  return users.rows.length;
};
