import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PickupStatus } from '../models/enums';
import { ensureActiveCollector } from './adminUsersService';
import { publishRealtimeEvent } from './realtimeService';

export type AssignmentRow = {
  id: string;
  collector_id: string;
  collector_name: string;
  collector_email: string;
  pickup_request_id: string;
  pickup_waste_type: string;
  pickup_scheduled_date: string;
  resident_name: string;
  resident_email: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  completion_photo_url: string | null;
  completion_note: string | null;
  issue_reason: string | null;
  issue_note: string | null;
  status: PickupStatus;
};

const isPgErrorWithCode = (err: unknown): err is { code: string } => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return typeof maybe.code === 'string';
};

export const listAssignments = async (filters: {
  status?: PickupStatus;
}): Promise<AssignmentRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`ca.status = $${params.length}`);
  }

  const sql = `
    SELECT
      ca.id,
      ca.collector_id,
      cu.name AS collector_name,
      cu.email AS collector_email,
      ca.pickup_request_id,
      pr.waste_type AS pickup_waste_type,
      pr.scheduled_date AS pickup_scheduled_date,
      ru.name AS resident_name,
      ru.email AS resident_email,
      ca.assigned_at,
      ca.started_at,
      ca.completed_at,
      ca.completion_photo_url,
      ca.completion_note,
      ca.issue_reason,
      ca.issue_note,
      ca.status
    FROM collector_assignments ca
    JOIN pickup_requests pr ON pr.id = ca.pickup_request_id
    JOIN users ru ON ru.id = pr.user_id
    JOIN users cu ON cu.id = ca.collector_id
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ca.assigned_at DESC
    LIMIT 500
  `;

  const res = await query<AssignmentRow>(sql, params);
  return res.rows;
};

export const createAssignment = async (input: {
  pickupRequestId: string;
  collectorId: string;
}): Promise<void> => {
  await ensureActiveCollector(input.collectorId);

  let residentUserId: string | null = null;

  await withTransaction(async (client) => {
    const pickupRes = await client.query<{ id: string; status: PickupStatus; user_id: string }>(
      `
        SELECT id, status, user_id
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.pickupRequestId]
    );

    const pickup = pickupRes.rows[0];
    if (!pickup) {
      throw new HttpError('Pickup request not found', 404);
    }

    if (pickup.status !== 'approved') {
      throw new HttpError('Pickup request must be approved before assignment', 400);
    }

    const activeAssignmentRes = await client.query<{ id: string }>(
      `
        SELECT id
        FROM collector_assignments
        WHERE pickup_request_id = $1
          AND status IN ('assigned', 'in_progress')
        LIMIT 1
        FOR UPDATE
      `,
      [input.pickupRequestId]
    );

    if (activeAssignmentRes.rows[0]) {
      throw new HttpError('Pickup request is already assigned to an active collector', 409);
    }

    residentUserId = pickup.user_id;

    try {
      await client.query(
        `
          INSERT INTO collector_assignments (collector_id, pickup_request_id, status)
          VALUES ($1, $2, 'assigned')
        `,
        [input.collectorId, input.pickupRequestId]
      );
    } catch (err) {
      if (isPgErrorWithCode(err) && err.code === '23505') {
        throw new HttpError('Assignment already exists', 409);
      }
      throw err;
    }

    await client.query(
      `
        UPDATE collector_dispatch_offers
        SET status = 'expired',
            responded_at = now(),
            rejection_reason = COALESCE(rejection_reason, 'manual_admin_assignment')
        WHERE entity_type = 'pickup'
          AND entity_id = $1
          AND status = 'pending'
      `,
      [input.pickupRequestId]
    );

    const pickupUpdated = await client.query<{ id: string }>(
      `
        UPDATE pickup_requests
        SET status = 'assigned'
        WHERE id = $1
          AND status = 'approved'
        RETURNING id
      `,
      [input.pickupRequestId]
    );

    if (!pickupUpdated.rows[0]) {
      throw new HttpError('Pickup request status changed before assignment. Please retry.', 409);
    }
  });

  publishRealtimeEvent({
    type: 'assignment.updated',
    payload: {
      pickup_request_id: input.pickupRequestId,
      collector_id: input.collectorId,
      status: 'assigned',
    },
    roles: ['admin'],
    userIds: [input.collectorId, ...(residentUserId ? [residentUserId] : [])],
  });

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: input.pickupRequestId,
      status: 'assigned',
    },
    roles: ['admin'],
    userIds: residentUserId ? [residentUserId, input.collectorId] : [input.collectorId],
  });
};
