import { query } from '../config/db';

export type UserLocationRow = {
  user_id: string;
  role: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
};

export type CollectorLocationRow = {
  collector_id: string;
  name: string;
  phone: string | null;
  collector_area: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
  pickup_request_id?: string | null;
};

export const upsertUserLocation = async (input: {
  userId: string;
  role: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): Promise<UserLocationRow> => {
  const res = await query<UserLocationRow>(
    `
      INSERT INTO user_locations (user_id, role, latitude, longitude, accuracy)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          accuracy = EXCLUDED.accuracy,
          updated_at = now()
      RETURNING user_id, role, latitude::float8 AS latitude, longitude::float8 AS longitude, accuracy, updated_at
    `,
    [input.userId, input.role, input.latitude, input.longitude, input.accuracy ?? null]
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to update location');
  }
  return row;
};

export const listCollectorLocationsForAdmin = async (): Promise<CollectorLocationRow[]> => {
  const res = await query<CollectorLocationRow>(
    `
      SELECT
        u.id AS collector_id,
        u.name,
        u.phone,
        u.area AS collector_area,
        l.latitude::float8 AS latitude,
        l.longitude::float8 AS longitude,
        l.accuracy,
        l.updated_at
      FROM user_locations l
      JOIN users u ON u.id = l.user_id
      WHERE u.role = 'collector'
        AND u.is_active = true
      ORDER BY l.updated_at DESC
    `
  );
  return res.rows;
};

export const listCollectorLocationsForResident = async (
  residentId: string
): Promise<CollectorLocationRow[]> => {
  const res = await query<CollectorLocationRow>(
    `
      SELECT DISTINCT ON (u.id)
        u.id AS collector_id,
        u.name,
        u.phone,
        u.area AS collector_area,
        l.latitude::float8 AS latitude,
        l.longitude::float8 AS longitude,
        l.accuracy,
        l.updated_at,
        ca.pickup_request_id
      FROM pickup_requests pr
      JOIN collector_assignments ca ON ca.pickup_request_id = pr.id
      JOIN users u ON u.id = ca.collector_id
      JOIN user_locations l ON l.user_id = u.id
      WHERE pr.user_id = $1
        AND ca.status IN ('assigned', 'in_progress')
      ORDER BY u.id, ca.assigned_at DESC, l.updated_at DESC
    `,
    [residentId]
  );
  return res.rows;
};
