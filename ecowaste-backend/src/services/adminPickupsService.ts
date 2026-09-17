import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PickupStatus } from '../models/enums';
import { markOverduePickups } from './pickupLifecycleService';
import { publishRealtimeEvent } from './realtimeService';

const PICKUP_STATUS_TRANSITIONS: Record<PickupStatus, PickupStatus[]> = {
  pending: ['approved', 'cancelled', 'overdue'],
  approved: ['assigned', 'pending', 'cancelled', 'overdue'],
  assigned: ['in_progress', 'completed', 'cancelled', 'overdue'],
  overdue: ['pending', 'approved', 'assigned', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export type PickupRequestRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  waste_type: string;
  scheduled_date: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pickup_category?: string | null;
  distance_km?: number | null;
  weight_kg?: number | null;
  price_amount?: number | null;
  price_currency?: string | null;
  payment_reason?: string | null;
  status: PickupStatus;
  created_at: string;
  assigned_collector_id: string | null;
  assigned_collector_name: string | null;
  assigned_collector_email: string | null;
  assigned_at: string | null;
  auto_offer_collector_id: string | null;
  auto_offer_collector_name: string | null;
  auto_offer_collector_email: string | null;
  auto_offer_status: 'pending' | 'accepted' | 'rejected' | 'expired' | null;
  auto_offer_distance_km: number | null;
  auto_offer_offered_at: string | null;
};

export const listPickups = async (filters: {
  status?: PickupStatus;
  fromDate?: string;
  toDate?: string;
}): Promise<PickupRequestRow[]> => {
  await markOverduePickups();

  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`pr.status = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`pr.scheduled_date >= ($${params.length}::date)`);
  }
  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`pr.scheduled_date < ($${params.length}::date + interval '1 day')`);
  }

  const sql = `
    SELECT
      pr.id,
      pr.user_id,
      u.name AS user_name,
      u.email AS user_email,
      pr.waste_type,
      pr.scheduled_date,
      pr.address,
      pr.latitude::float8 AS latitude,
      pr.longitude::float8 AS longitude,
      pr.pickup_category,
      pr.distance_km::float8 AS distance_km,
      pr.status,
      pr.created_at,
      ca.collector_id AS assigned_collector_id,
      cu.name AS assigned_collector_name,
      cu.email AS assigned_collector_email,
      ca.assigned_at,
      dof.collector_id AS auto_offer_collector_id,
      dcu.name AS auto_offer_collector_name,
      dcu.email AS auto_offer_collector_email,
      dof.status AS auto_offer_status,
      dof.distance_km::float8 AS auto_offer_distance_km,
      dof.offered_at AS auto_offer_offered_at
    FROM pickup_requests pr
    JOIN users u ON u.id = pr.user_id
    LEFT JOIN LATERAL (
      SELECT collector_id, assigned_at
      FROM collector_assignments
      WHERE pickup_request_id = pr.id
        AND (
          status IN ('assigned', 'in_progress')
          OR (pr.status IN ('completed', 'cancelled') AND status IN ('completed', 'cancelled'))
        )
      ORDER BY assigned_at DESC, id DESC
      LIMIT 1
    ) ca ON true
    LEFT JOIN users cu ON cu.id = ca.collector_id
    LEFT JOIN LATERAL (
      SELECT collector_id, status, distance_km, offered_at
      FROM collector_dispatch_offers
      WHERE entity_type = 'pickup'
        AND entity_id = pr.id
      ORDER BY
        CASE status
          WHEN 'accepted' THEN CASE WHEN ca.collector_id IS NOT NULL AND collector_id = ca.collector_id THEN 0 ELSE 2 END
          WHEN 'pending' THEN 1
          WHEN 'rejected' THEN 3
          WHEN 'expired' THEN 4
          ELSE 5
        END,
        offered_at DESC
      LIMIT 1
    ) dof ON true
    LEFT JOIN users dcu ON dcu.id = dof.collector_id
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY pr.scheduled_date DESC, pr.created_at DESC
    LIMIT 500
  `;

  const result = await query<PickupRequestRow>(sql, params);

  return result.rows.map((row) => ({
    ...row,
    weight_kg: null,
    price_amount: 0,
    price_currency: 'XOF',
    payment_reason: 'no_charge',
  }));
};

export const updatePickupStatus = async (pickupId: string, status: PickupStatus): Promise<void> => {
  const existing = await query<{ id: string; user_id: string; status: PickupStatus }>(
    `
      SELECT id, user_id, status
      FROM pickup_requests
      WHERE id = $1
      LIMIT 1
    `,
    [pickupId]
  );

  const current = existing.rows[0];
  if (!current) {
    throw new HttpError('Pickup request not found', 404);
  }

  if (current.status === status) {
    return;
  }

  const allowed = PICKUP_STATUS_TRANSITIONS[current.status];
  if (!allowed.includes(status)) {
    throw new HttpError(
      `Invalid pickup status transition from '${current.status}' to '${status}'`,
      400
    );
  }

  const result = await query<{ id: string; user_id: string }>(
    `
      UPDATE pickup_requests
      SET status = $2
      WHERE id = $1
        AND status = $3
      RETURNING id, user_id
    `,
    [pickupId, status, current.status]
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError('Pickup status changed. Please refresh and retry.', 409);
  }

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: pickupId,
      status,
    },
    roles: ['admin'],
    userIds: [row.user_id],
  });
};
