import { query } from '../config/db';
import type { PickupStatus } from '../models/enums';
import { publishRealtimeEvent } from './realtimeService';

const OVERDUE_SOURCE_STATUSES: PickupStatus[] = ['pending', 'approved', 'assigned'];

type OverduePickupRow = {
  id: string;
  user_id: string;
};

type MarkOverduePickupsOptions = {
  userId?: string;
};

export const markOverduePickups = async (
  options: MarkOverduePickupsOptions = {}
): Promise<number> => {
  const whereClauses = ['scheduled_date < now()', 'status = ANY($1::pickup_status[])'];
  const params: unknown[] = [OVERDUE_SOURCE_STATUSES];

  if (options.userId) {
    params.push(options.userId);
    whereClauses.push(`user_id = $${params.length}`);
  }

  const updated = await query<OverduePickupRow>(
    `
      UPDATE pickup_requests
      SET status = 'overdue'
      WHERE ${whereClauses.join('\n        AND ')}
      RETURNING id, user_id
    `,
    params
  );

  for (const row of updated.rows) {
    publishRealtimeEvent({
      type: 'pickup.updated',
      payload: {
        pickup_id: row.id,
        status: 'overdue',
      },
      roles: ['admin'],
      userIds: [row.user_id],
    });
  }

  return updated.rows.length;
};
