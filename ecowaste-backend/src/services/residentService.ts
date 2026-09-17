import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PickupStatus, ReportStatus, RewardReason } from '../models/enums';
import { assertCanRequestPickup } from './subscriptionService';
import { publishRealtimeEvent } from './realtimeService';
import { markOverduePickups } from './pickupLifecycleService';
import { dispatchNotificationCreated } from './notificationsService';
import {
  dispatchPickupToNextCollector,
  dispatchReportToNearestCollectors,
  dispatchReportToNextCollector,
  processTimedOutDispatchOffers,
} from './dispatchService';

const PICKUP_COMPLETION_POINTS = 10;
const REPORT_REWARD_POINTS = 15;

const ensureFutureScheduledDate = (scheduledDate: string): string => {
  const parsed = new Date(scheduledDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError('scheduled_date must be a valid datetime', 400);
  }
  if (parsed.getTime() <= Date.now()) {
    throw new HttpError('scheduled_date must be in the future', 400);
  }
  return parsed.toISOString();
};

const isPgErrorWithCode = (err: unknown): err is { code: string } => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return typeof maybe.code === 'string';
};

const LEGACY_REPORT_LOCATION_PREFIX = '[Location]';
const LEGACY_REPORT_TYPE_PREFIX = '[Type]';

const buildLegacyReportDescription = (
  locationText?: string | null,
  description?: string | null,
  reportType?: string | null
): string | null => {
  const normalizedLocation = locationText?.trim();
  const normalizedDescription = description?.trim();
  const normalizedReportType = reportType?.trim().toLowerCase();
  const lines: string[] = [];

  if (normalizedReportType) {
    lines.push(`${LEGACY_REPORT_TYPE_PREFIX} ${normalizedReportType}`);
  }
  if (normalizedLocation) {
    lines.push(`${LEGACY_REPORT_LOCATION_PREFIX} ${normalizedLocation}`);
  }
  if (normalizedDescription) {
    lines.push(normalizedDescription);
  }

  return lines.length > 0 ? lines.join('\n') : null;
};

export type ResidentWasteReportRow = {
  id: string;
  user_id: string;
  photo_url: string | null;
  report_type: string | null;
  location_text: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  priority: 'normal' | 'high' | 'emergency';
  status: ReportStatus;
  verified_by_admin_id: string | null;
  assigned_collector_id: string | null;
  assigned_collector_name: string | null;
  assigned_collector_phone: string | null;
  assigned_at: string | null;
  resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
  resident_confirmed_at: string | null;
  resident_rejection_note: string | null;
  cleaned_photo_url: string | null;
  cleaned_note: string | null;
  cleaned_at: string | null;
  created_at: string;
};

export type ResidentPickupRequestRow = {
  id: string;
  user_id: string;
  waste_type: string;
  scheduled_date: string;
  pickup_category: string | null;
  distance_km: number | null;
  description: string | null;
  address: string | null;
  photo_url: string | null;
  assigned_collector_id: string | null;
  assigned_collector_name: string | null;
  assigned_collector_phone: string | null;
  resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
  resident_confirmed_at: string | null;
  resident_rejection_note: string | null;
  completion_submitted_at: string | null;
  completion_photo_url: string | null;
  completion_note: string | null;
  completed_at: string | null;
  status: PickupStatus;
  created_at: string;
};

export type ResidentRewardRow = {
  id: string;
  user_id: string;
  points: number;
  reason: RewardReason;
  related_entity_id: string | null;
  created_at: string;
};

export const createWasteReport = async (
  userId: string,
  input: {
    photoUrl?: string | null;
    reportType?: string | null;
    locationText?: string | null;
    description?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    priority?: 'normal' | 'high' | 'emergency' | null;
  }
): Promise<ResidentWasteReportRow> => {
  const row = await withTransaction(async (client) => {
    let res: { rows: ResidentWasteReportRow[] };
    try {
      res = await client.query<ResidentWasteReportRow>(
        `
          INSERT INTO waste_reports (
            user_id,
            photo_url,
            report_type,
            location_text,
            description,
            latitude,
            longitude,
            priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            user_id,
            photo_url,
            report_type,
            location_text,
            description,
            latitude::float8 AS latitude,
            longitude::float8 AS longitude,
            priority,
            status,
            verified_by_admin_id,
            assigned_collector_id,
            NULL::text AS assigned_collector_name,
            NULL::text AS assigned_collector_phone,
            assigned_at,
            resident_confirmation_status,
            resident_confirmed_at,
            resident_rejection_note,
            cleaned_photo_url,
            cleaned_note,
            cleaned_at,
            created_at
        `,
        [
          userId,
          input.photoUrl ?? null,
          input.reportType ?? null,
          input.locationText ?? null,
          input.description ?? null,
          input.latitude ?? null,
          input.longitude ?? null,
          input.priority ?? 'normal',
        ]
      );
    } catch (err) {
      if (!isPgErrorWithCode(err) || err.code !== '42703') {
        throw err;
      }
      res = await client.query<ResidentWasteReportRow>(
        `
          INSERT INTO waste_reports (
            user_id,
            photo_url,
            description,
            latitude,
            longitude
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            user_id,
            photo_url,
            NULL::text AS report_type,
            NULL::text AS location_text,
            description,
            latitude::float8 AS latitude,
            longitude::float8 AS longitude,
            'normal'::text AS priority,
            status,
            verified_by_admin_id,
            NULL::uuid AS assigned_collector_id,
            NULL::text AS assigned_collector_name,
            NULL::text AS assigned_collector_phone,
            NULL::timestamptz AS assigned_at,
            NULL::text AS resident_confirmation_status,
            NULL::timestamptz AS resident_confirmed_at,
            NULL::text AS resident_rejection_note,
            NULL::text AS cleaned_photo_url,
            NULL::text AS cleaned_note,
            NULL::timestamptz AS cleaned_at,
            created_at
        `,
        [
          userId,
          input.photoUrl ?? null,
          buildLegacyReportDescription(input.locationText, input.description, input.reportType),
          input.latitude ?? null,
          input.longitude ?? null,
        ]
      );
    }

    const created = res.rows[0];
    if (!created) {
      throw new Error('Failed to create report');
    }

    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [
        userId,
        'Thanks for reporting! We are automatically matching the nearest available collector.',
      ]
    );

    return created;
  });

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: row.id,
      status: row.status,
    },
    roles: ['admin'],
    userIds: [userId],
  });

  void dispatchNotificationCreated({
    userIds: [userId],
    message: 'Thanks for reporting! We are automatically matching the nearest available collector.',
  });

  const reportPriority = input.priority ?? 'normal';

  void dispatchReportToNearestCollectors(row.id, {
    residentNotice: 'We are finding the nearest available collector for your report.',
    priority: reportPriority,
    maxCollectors: reportPriority === 'emergency' ? 3 : reportPriority === 'high' ? 2 : 3,
  });

  return row;
};

export const listMyWasteReports = async (userId: string): Promise<ResidentWasteReportRow[]> => {
  try {
    await processTimedOutDispatchOffers();
  } catch {
    // best-effort timeout sweep
  }

  try {
    const res = await query<ResidentWasteReportRow>(
      `
        SELECT
          id,
          user_id,
          photo_url,
          report_type,
          location_text,
          description,
          latitude::float8 AS latitude,
          longitude::float8 AS longitude,
          priority,
          status,
          verified_by_admin_id,
          assigned_collector_id,
          c.name AS assigned_collector_name,
          c.phone AS assigned_collector_phone,
          assigned_at,
          resident_confirmation_status,
          resident_confirmed_at,
          resident_rejection_note,
          cleaned_photo_url,
          cleaned_note,
          cleaned_at,
          created_at
        FROM waste_reports
        LEFT JOIN users c ON c.id = waste_reports.assigned_collector_id
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 500
      `,
      [userId]
    );
    return res.rows;
  } catch (err) {
    if (!isPgErrorWithCode(err)) {
      throw err;
    }
    if (err.code === '42P01') {
      return [];
    }
    try {
      const res = await query<ResidentWasteReportRow>(
        `
          SELECT
            id,
            user_id,
            photo_url,
            report_type,
            location_text,
            description,
            latitude::float8 AS latitude,
            longitude::float8 AS longitude,
            priority,
            status,
            verified_by_admin_id,
            assigned_collector_id,
            NULL::text AS assigned_collector_name,
            NULL::text AS assigned_collector_phone,
            NULL::timestamptz AS assigned_at,
            NULL::text AS resident_confirmation_status,
            NULL::timestamptz AS resident_confirmed_at,
            NULL::text AS resident_rejection_note,
            NULL::text AS cleaned_photo_url,
            NULL::text AS cleaned_note,
            NULL::timestamptz AS cleaned_at,
            created_at
          FROM waste_reports
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 500
        `,
        [userId]
      );
      return res.rows;
    } catch (fallbackErr) {
      if (isPgErrorWithCode(fallbackErr) && fallbackErr.code === '42P01') {
        return [];
      }
      if (!(isPgErrorWithCode(fallbackErr) && fallbackErr.code === '42703')) {
        throw fallbackErr;
      }
      try {
        const res = await query<ResidentWasteReportRow>(
          `
            SELECT
              id,
              user_id,
              photo_url,
              NULL::text AS report_type,
              NULL::text AS location_text,
              description,
              latitude::float8 AS latitude,
              longitude::float8 AS longitude,
              'normal'::text AS priority,
              status,
              verified_by_admin_id,
              NULL::uuid AS assigned_collector_id,
              NULL::text AS assigned_collector_name,
              NULL::text AS assigned_collector_phone,
              NULL::timestamptz AS assigned_at,
              NULL::text AS resident_confirmation_status,
              NULL::timestamptz AS resident_confirmed_at,
              NULL::text AS resident_rejection_note,
              NULL::text AS cleaned_photo_url,
              NULL::text AS cleaned_note,
              NULL::timestamptz AS cleaned_at,
              created_at
            FROM waste_reports
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 500
          `,
          [userId]
        );
        return res.rows;
      } catch (legacyFallbackErr) {
        if (
          isPgErrorWithCode(legacyFallbackErr) &&
          (legacyFallbackErr.code === '42P01' || legacyFallbackErr.code === '42703')
        ) {
          return [];
        }
        throw legacyFallbackErr;
      }
    }
  }
};

export const cancelWasteReport = async (userId: string, reportId: string): Promise<void> => {
  const tx = await withTransaction(
    async (
      client
    ): Promise<{
      changed: boolean;
      assignedCollectorId: string | null;
      pendingOfferCollectorIds: string[];
    }> => {
      const res = await client.query<{
        user_id: string;
        status: ReportStatus;
        assigned_collector_id: string | null;
      }>(
        `
        SELECT user_id, status, assigned_collector_id
        FROM waste_reports
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
        [reportId]
      );

      const row = res.rows[0];
      if (!row) {
        throw new HttpError('Report not found', 404);
      }
      if (row.user_id !== userId) {
        throw new HttpError('Forbidden', 403);
      }

      if (row.status === 'cancelled') {
        return {
          changed: false,
          assignedCollectorId: row.assigned_collector_id ?? null,
          pendingOfferCollectorIds: [],
        };
      }

      await client.query(
        `
        UPDATE waste_reports
        SET status = 'cancelled'
        WHERE id = $1
      `,
        [reportId]
      );

      const expiredOffers = await client.query<{ collector_id: string }>(
        `
        UPDATE collector_dispatch_offers
        SET status = 'expired',
            responded_at = now(),
            rejection_reason = COALESCE(rejection_reason, 'resident_cancelled')
        WHERE entity_type = 'report'
          AND entity_id = $1
          AND status = 'pending'
        RETURNING collector_id
      `,
        [reportId]
      );

      if (row.assigned_collector_id) {
        await client.query(
          `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
          [row.assigned_collector_id, 'Resident cancelled this report.']
        );
      }

      return {
        changed: true,
        assignedCollectorId: row.assigned_collector_id ?? null,
        pendingOfferCollectorIds: Array.from(
          new Set(expiredOffers.rows.map((entry) => entry.collector_id))
        ),
      };
    }
  );

  if (!tx.changed) {
    return;
  }

  const targetUserIds = Array.from(
    new Set([
      userId,
      ...(tx.assignedCollectorId ? [tx.assignedCollectorId] : []),
      ...tx.pendingOfferCollectorIds,
    ])
  );

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: reportId,
      status: 'cancelled',
    },
    roles: ['admin'],
    userIds: targetUserIds,
  });

  if (tx.assignedCollectorId) {
    void dispatchNotificationCreated({
      userIds: [tx.assignedCollectorId],
      message: 'Resident cancelled this report.',
      source: 'resident.report.cancelled',
      path: '/(collector)/history',
      data: { report_id: reportId },
    });
  }
};

export const createPickupRequest = async (
  userId: string,
  input: {
    wasteType: string;
    scheduledDate: string;
    description?: string | null;
    address?: string | null;
    photoUrl?: string | null;
    pickupCategory?: string | null;
    distanceKm?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<ResidentPickupRequestRow> => {
  const normalizedScheduledDate = ensureFutureScheduledDate(input.scheduledDate);

  await assertCanRequestPickup(userId);

  const waste = input.wasteType.trim().toLowerCase();
  const isHazardousWaste = waste === 'hazardous' || waste === 'electronic';
  const rawCategory = (input.pickupCategory ?? 'standard').toString().trim().toLowerCase();
  const pickupCategory = isHazardousWaste
    ? 'hazardous'
    : ['standard', 'bulk', 'hazardous'].includes(rawCategory)
      ? rawCategory
      : 'standard';
  const distanceValue =
    typeof input.distanceKm === 'number' && Number.isFinite(input.distanceKm)
      ? Math.max(0, input.distanceKm)
      : null;

  const row = await withTransaction(async (client) => {
    const res = await client.query<ResidentPickupRequestRow>(
      `
        INSERT INTO pickup_requests (
          user_id,
          waste_type,
          scheduled_date,
          description,
          address,
          photo_url,
          latitude,
          longitude,
          pickup_category,
          distance_km,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'approved')
        RETURNING
          id,
          user_id,
          waste_type,
          scheduled_date,
          pickup_category,
          distance_km::float8 AS distance_km,
          description,
          address,
          photo_url,
          latitude::float8 AS latitude,
          longitude::float8 AS longitude,
          NULL::uuid AS assigned_collector_id,
          NULL::text AS assigned_collector_name,
          NULL::text AS assigned_collector_phone,
          NULL::text AS resident_confirmation_status,
          NULL::timestamptz AS resident_confirmed_at,
          NULL::text AS resident_rejection_note,
          NULL::timestamptz AS completion_submitted_at,
          NULL::text AS completion_photo_url,
          NULL::text AS completion_note,
          NULL::timestamptz AS completed_at,
          status,
          created_at
      `,
      [
        userId,
        input.wasteType,
        normalizedScheduledDate,
        input.description ?? null,
        input.address ?? null,
        input.photoUrl ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        pickupCategory,
        distanceValue,
      ]
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error('Failed to create pickup request');
    }

    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [userId, 'Thanks for requesting a pickup! We are matching the nearest available collector.']
    );

    return row;
  });

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: row.id,
      status: row.status,
    },
    roles: ['admin'],
    userIds: [userId],
  });

  void dispatchNotificationCreated({
    userIds: [userId],
    message: 'Thanks for requesting a pickup! We are matching the nearest available collector.',
  });

  void dispatchPickupToNextCollector(row.id, {
    residentNotice: 'We are finding the nearest available collector for your pickup request.',
  });

  return row;
};

export const listMyPickups = async (userId: string): Promise<ResidentPickupRequestRow[]> => {
  try {
    await processTimedOutDispatchOffers();
  } catch {
    // best-effort timeout sweep
  }

  await markOverduePickups({ userId });

  try {
    const res = await query<ResidentPickupRequestRow>(
      `
        SELECT
          pr.id,
          pr.user_id,
          pr.waste_type,
          pr.scheduled_date,
          pr.pickup_category,
          pr.distance_km::float8 AS distance_km,
          pr.description,
          pr.address,
          pr.photo_url,
          pr.latitude::float8 AS latitude,
          pr.longitude::float8 AS longitude,
          pr.status,
          pr.created_at,
          ca.collector_id AS assigned_collector_id,
          cu.name AS assigned_collector_name,
          cu.phone AS assigned_collector_phone,
          ca.resident_confirmation_status,
          ca.resident_confirmed_at,
          ca.resident_rejection_note,
          ca.completion_submitted_at,
          ca.completion_photo_url,
          ca.completion_note,
          ca.completed_at
        FROM pickup_requests pr
        LEFT JOIN LATERAL (
          SELECT
            collector_id,
            assigned_at,
            resident_confirmation_status,
            resident_confirmed_at,
            resident_rejection_note,
            completion_submitted_at,
            completion_photo_url,
            completion_note,
            completed_at
          FROM collector_assignments
          WHERE pickup_request_id = pr.id
          ORDER BY assigned_at DESC
          LIMIT 1
        ) ca ON true
        LEFT JOIN users cu ON cu.id = ca.collector_id
        WHERE user_id = $1
        ORDER BY pr.created_at DESC
        LIMIT 500
      `,
      [userId]
    );
    return res.rows;
  } catch (err) {
    if (!isPgErrorWithCode(err)) {
      throw err;
    }
    if (err.code !== '42703' && err.code !== '42P01') {
      throw err;
    }
    try {
      const res = await query<ResidentPickupRequestRow>(
        `
          SELECT
            pr.id,
            pr.user_id,
            pr.waste_type,
            pr.scheduled_date,
            pr.pickup_category,
            pr.distance_km::float8 AS distance_km,
            pr.description,
            pr.address,
            pr.photo_url,
            pr.latitude::float8 AS latitude,
            pr.longitude::float8 AS longitude,
            pr.status,
            pr.created_at,
            NULL::uuid AS assigned_collector_id,
            NULL::text AS assigned_collector_name,
            NULL::text AS assigned_collector_phone,
            NULL::text AS resident_confirmation_status,
            NULL::timestamptz AS resident_confirmed_at,
            NULL::text AS resident_rejection_note,
            NULL::timestamptz AS completion_submitted_at,
            NULL::text AS completion_photo_url,
            NULL::text AS completion_note,
            NULL::timestamptz AS completed_at
          FROM pickup_requests pr
          WHERE user_id = $1
          ORDER BY pr.created_at DESC
          LIMIT 500
        `,
        [userId]
      );
      return res.rows;
    } catch (fallbackErr) {
      if (isPgErrorWithCode(fallbackErr) && fallbackErr.code === '42P01') {
        return [];
      }
      if (!(isPgErrorWithCode(fallbackErr) && fallbackErr.code === '42703')) {
        throw fallbackErr;
      }
      try {
        const res = await query<ResidentPickupRequestRow>(
          `
            SELECT
              pr.id,
              pr.user_id,
              pr.waste_type,
              pr.scheduled_date,
              NULL::text AS pickup_category,
              NULL::float8 AS distance_km,
              NULL::text AS description,
              NULL::text AS address,
              NULL::text AS photo_url,
              NULL::float8 AS latitude,
              NULL::float8 AS longitude,
              pr.status,
              pr.created_at,
              NULL::uuid AS assigned_collector_id,
              NULL::text AS assigned_collector_name,
              NULL::text AS assigned_collector_phone,
              NULL::text AS resident_confirmation_status,
              NULL::timestamptz AS resident_confirmed_at,
              NULL::text AS resident_rejection_note,
              NULL::timestamptz AS completion_submitted_at,
              NULL::text AS completion_photo_url,
              NULL::text AS completion_note,
              NULL::timestamptz AS completed_at
            FROM pickup_requests pr
            WHERE user_id = $1
            ORDER BY pr.created_at DESC
            LIMIT 500
          `,
          [userId]
        );
        return res.rows;
      } catch (legacyFallbackErr) {
        if (isPgErrorWithCode(legacyFallbackErr) && legacyFallbackErr.code === '42P01') {
          return [];
        }
        throw legacyFallbackErr;
      }
    }
  }
};

export const reschedulePickup = async (
  userId: string,
  pickupRequestId: string,
  scheduledDate: string
): Promise<void> => {
  const normalizedScheduledDate = ensureFutureScheduledDate(scheduledDate);

  const updated = await query<{ id: string }>(
    `
      UPDATE pickup_requests
      SET scheduled_date = $3
      WHERE id = $1
        AND user_id = $2
        AND status IN ('pending', 'approved', 'assigned', 'overdue')
      RETURNING id
    `,
    [pickupRequestId, userId, normalizedScheduledDate]
  );

  if (!updated.rows[0]) {
    const existing = await query<{ user_id: string; status: PickupStatus }>(
      `
        SELECT user_id, status
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
      `,
      [pickupRequestId]
    );

    const row = existing.rows[0];
    if (!row) throw new HttpError('Pickup request not found', 404);
    if (row.user_id !== userId) throw new HttpError('Forbidden', 403);
    throw new HttpError('Only pending/approved/assigned/overdue pickups can be rescheduled', 400);
  }

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: pickupRequestId,
      scheduled_date: normalizedScheduledDate,
    },
    roles: ['admin'],
    userIds: [userId],
  });
};

export const cancelPickup = async (userId: string, pickupRequestId: string): Promise<void> => {
  const tx = await withTransaction(
    async (
      client
    ): Promise<{
      changed: boolean;
      affectedCollectorIds: string[];
    }> => {
      const existing = await client.query<{ user_id: string; status: PickupStatus }>(
        `
        SELECT user_id, status
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
        [pickupRequestId]
      );
      const row = existing.rows[0];
      if (!row) throw new HttpError('Pickup request not found', 404);
      if (row.user_id !== userId) throw new HttpError('Forbidden', 403);

      if (row.status === 'cancelled') {
        return { changed: false, affectedCollectorIds: [] };
      }

      await client.query(
        `
        UPDATE pickup_requests
        SET status = 'cancelled'
        WHERE id = $1
      `,
        [pickupRequestId]
      );

      const cancelledAssignments = await client.query<{ collector_id: string }>(
        `
        UPDATE collector_assignments
        SET status = 'cancelled',
            issue_reason = COALESCE(issue_reason, 'resident_cancelled'),
            issue_note = COALESCE(issue_note, 'Cancelled by resident user.')
        WHERE pickup_request_id = $1
          AND status IN ('assigned', 'in_progress')
        RETURNING collector_id
      `,
        [pickupRequestId]
      );

      const expiredOffers = await client.query<{ collector_id: string }>(
        `
        UPDATE collector_dispatch_offers
        SET status = 'expired',
            responded_at = now(),
            rejection_reason = COALESCE(rejection_reason, 'resident_cancelled')
        WHERE entity_type = 'pickup'
          AND entity_id = $1
          AND status = 'pending'
        RETURNING collector_id
      `,
        [pickupRequestId]
      );

      const affectedCollectorIds = Array.from(
        new Set([
          ...cancelledAssignments.rows.map((entry) => entry.collector_id),
          ...expiredOffers.rows.map((entry) => entry.collector_id),
        ])
      );

      if (affectedCollectorIds.length > 0) {
        for (const collectorId of affectedCollectorIds) {
          await client.query(
            `
            INSERT INTO notifications (user_id, message)
            VALUES ($1, $2)
          `,
            [collectorId, 'Resident cancelled this pickup request.']
          );
        }
      }

      return {
        changed: true,
        affectedCollectorIds,
      };
    }
  );

  if (!tx.changed) {
    return;
  }

  const targetUserIds = Array.from(new Set([userId, ...tx.affectedCollectorIds]));

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: pickupRequestId,
      status: 'cancelled',
    },
    roles: ['admin'],
    userIds: targetUserIds,
  });

  if (tx.affectedCollectorIds.length > 0) {
    void dispatchNotificationCreated({
      userIds: tx.affectedCollectorIds,
      message: 'Resident cancelled this pickup request.',
      source: 'resident.pickup.cancelled',
      path: '/(collector)/assigned',
      data: { pickup_request_id: pickupRequestId },
    });
  }
};

export const confirmPickupCompletion = async (
  userId: string,
  pickupRequestId: string,
  input: { approved: boolean; note?: string | null }
): Promise<void> => {
  let collectorId: string | null = null;
  let pointsGranted = 0;
  let shouldRedispatch = false;
  let residentMessage: string | null = null;

  await withTransaction(async (client) => {
    const pickupRes = await client.query<{ id: string; user_id: string; status: PickupStatus }>(
      `
        SELECT id, user_id, status
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [pickupRequestId]
    );

    const pickup = pickupRes.rows[0];
    if (!pickup) throw new HttpError('Pickup request not found', 404);
    if (pickup.user_id !== userId) throw new HttpError('Forbidden', 403);
    if (pickup.status !== 'completed') {
      throw new HttpError('Pickup completion is not awaiting confirmation', 409);
    }

    const assignmentRes = await client.query<{
      id: string;
      collector_id: string;
      resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
    }>(
      `
        SELECT id, collector_id, resident_confirmation_status
        FROM collector_assignments
        WHERE pickup_request_id = $1
          AND status = 'completed'
        ORDER BY COALESCE(completed_at, assigned_at) DESC
        LIMIT 1
        FOR UPDATE
      `,
      [pickupRequestId]
    );

    const assignment = assignmentRes.rows[0];
    if (!assignment) {
      throw new HttpError('No completed collector proof found for this pickup', 409);
    }

    collectorId = assignment.collector_id;

    if (
      assignment.resident_confirmation_status &&
      assignment.resident_confirmation_status !== 'pending'
    ) {
      throw new HttpError(
        `Pickup completion already ${assignment.resident_confirmation_status}`,
        409
      );
    }

    if (input.approved) {
      await client.query(
        `
          UPDATE collector_assignments
          SET resident_confirmation_status = 'approved',
              resident_confirmed_at = now(),
              resident_rejection_note = NULL
          WHERE id = $1
        `,
        [assignment.id]
      );

      const existingReward = await client.query<{ id: string }>(
        `
          SELECT id
          FROM rewards
          WHERE user_id = $1
            AND reason = 'pickup_participation'
            AND related_entity_id = $2
          LIMIT 1
        `,
        [userId, pickupRequestId]
      );

      if (!existingReward.rows[0]) {
        await client.query(
          `
            INSERT INTO rewards (user_id, points, reason, related_entity_id)
            VALUES ($1, $2, 'pickup_participation', $3)
          `,
          [userId, PICKUP_COMPLETION_POINTS, pickupRequestId]
        );
        pointsGranted = PICKUP_COMPLETION_POINTS;
      }

      residentMessage =
        pointsGranted > 0
          ? `Pickup completion approved. You earned ${PICKUP_COMPLETION_POINTS} point(s).`
          : 'Pickup completion approved.';
      await client.query(
        `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
        [userId, residentMessage]
      );
      await client.query(
        `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
        [assignment.collector_id, 'Resident approved your pickup completion proof.']
      );
      return;
    }

    await client.query(
      `
        UPDATE collector_assignments
        SET resident_confirmation_status = 'rejected',
            resident_confirmed_at = now(),
            resident_rejection_note = $2
        WHERE id = $1
      `,
      [assignment.id, input.note?.trim() || 'Resident rejected completion proof']
    );

    await client.query(
      `
        UPDATE pickup_requests
        SET status = 'approved'
        WHERE id = $1
      `,
      [pickupRequestId]
    );

    shouldRedispatch = true;
    residentMessage = 'Pickup completion rejected. We will assign another nearby collector.';
    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [userId, residentMessage]
    );
    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [
        assignment.collector_id,
        `Resident rejected your pickup completion proof${input.note?.trim() ? `: ${input.note.trim()}` : '.'}`,
      ]
    );
  });

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: pickupRequestId,
      status: shouldRedispatch ? 'approved' : 'completed',
      resident_confirmation_status: input.approved ? 'approved' : 'rejected',
    },
    roles: ['admin'],
    userIds: [userId, ...(collectorId ? [collectorId] : [])],
  });

  if (pointsGranted > 0) {
    publishRealtimeEvent({
      type: 'reward.updated',
      payload: {
        user_id: userId,
        points: pointsGranted,
        reason: 'pickup_participation',
        related_entity_id: pickupRequestId,
      },
      roles: ['admin'],
      userIds: [userId],
    });
  }

  if (residentMessage) {
    void dispatchNotificationCreated({
      userIds: [userId],
      message: residentMessage,
      source: 'resident.pickup.confirmation',
      path: '/profile/history',
      data: {
        pickup_request_id: pickupRequestId,
        approved: input.approved,
      },
    });
  }

  if (collectorId) {
    void dispatchNotificationCreated({
      userIds: [collectorId],
      message: input.approved
        ? 'Resident approved your pickup completion proof.'
        : 'Resident rejected your pickup completion proof.',
      source: 'resident.pickup.confirmation',
      path: '/(collector)/history',
      data: {
        pickup_request_id: pickupRequestId,
        approved: input.approved,
      },
    });
  }

  if (shouldRedispatch) {
    await dispatchPickupToNextCollector(pickupRequestId, {
      residentNotice: 'Pickup completion was rejected. We are matching another nearby collector.',
    });
  }
};

export const confirmReportCleanup = async (
  userId: string,
  reportId: string,
  input: { approved: boolean; note?: string | null }
): Promise<void> => {
  let collectorId: string | null = null;
  let pointsGranted = 0;
  let shouldRedispatch = false;
  let residentMessage: string | null = null;

  await withTransaction(async (client) => {
    const reportRes = await client.query<{
      id: string;
      user_id: string;
      status: ReportStatus;
      assigned_collector_id: string | null;
      resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
    }>(
      `
        SELECT
          id,
          user_id,
          status,
          assigned_collector_id,
          resident_confirmation_status
        FROM waste_reports
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [reportId]
    );

    const report = reportRes.rows[0];
    if (!report) throw new HttpError('Report not found', 404);
    if (report.user_id !== userId) throw new HttpError('Forbidden', 403);
    if (report.status !== 'cleaned') {
      throw new HttpError('Report cleanup is not awaiting confirmation', 409);
    }

    collectorId = report.assigned_collector_id;

    if (report.resident_confirmation_status && report.resident_confirmation_status !== 'pending') {
      throw new HttpError(`Report cleanup already ${report.resident_confirmation_status}`, 409);
    }

    if (input.approved) {
      await client.query(
        `
          UPDATE waste_reports
          SET status = 'approved',
              resident_confirmation_status = 'approved',
              resident_confirmed_at = now(),
              resident_rejection_note = NULL
          WHERE id = $1
        `,
        [reportId]
      );

      const existingReward = await client.query<{ id: string }>(
        `
          SELECT id
          FROM rewards
          WHERE user_id = $1
            AND reason = 'waste_report'
            AND related_entity_id = $2
          LIMIT 1
        `,
        [userId, reportId]
      );

      if (!existingReward.rows[0]) {
        await client.query(
          `
            INSERT INTO rewards (user_id, points, reason, related_entity_id)
            VALUES ($1, $2, 'waste_report', $3)
          `,
          [userId, REPORT_REWARD_POINTS, reportId]
        );
        pointsGranted = REPORT_REWARD_POINTS;
      }

      residentMessage =
        pointsGranted > 0
          ? `Report cleanup approved. You earned ${REPORT_REWARD_POINTS} point(s).`
          : 'Report cleanup approved.';
      await client.query(
        `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
        [userId, residentMessage]
      );
      if (report.assigned_collector_id) {
        await client.query(
          `
            INSERT INTO notifications (user_id, message)
            VALUES ($1, $2)
          `,
          [report.assigned_collector_id, 'Resident approved your report cleanup proof.']
        );
      }
      return;
    }

    await client.query(
      `
        UPDATE waste_reports
        SET status = 'verified',
            assigned_collector_id = NULL,
            assigned_at = NULL,
            resident_confirmation_status = 'rejected',
            resident_confirmed_at = now(),
            resident_rejection_note = $2
        WHERE id = $1
      `,
      [reportId, input.note?.trim() || 'Resident rejected cleanup proof']
    );

    shouldRedispatch = true;
    residentMessage = 'Report cleanup rejected. We will assign another nearby collector.';
    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [userId, residentMessage]
    );
    if (report.assigned_collector_id) {
      await client.query(
        `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
        [
          report.assigned_collector_id,
          `Resident rejected your report cleanup proof${input.note?.trim() ? `: ${input.note.trim()}` : '.'}`,
        ]
      );
    }
  });

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: reportId,
      status: input.approved ? 'approved' : 'verified',
      resident_confirmation_status: input.approved ? 'approved' : 'rejected',
    },
    roles: ['admin'],
    userIds: [userId, ...(collectorId ? [collectorId] : [])],
  });

  if (pointsGranted > 0) {
    publishRealtimeEvent({
      type: 'reward.updated',
      payload: {
        user_id: userId,
        points: pointsGranted,
        reason: 'waste_report',
        related_entity_id: reportId,
      },
      roles: ['admin'],
      userIds: [userId],
    });
  }

  if (residentMessage) {
    void dispatchNotificationCreated({
      userIds: [userId],
      message: residentMessage,
      source: 'resident.report.confirmation',
      path: '/profile/history',
      data: {
        report_id: reportId,
        approved: input.approved,
      },
    });
  }

  if (collectorId) {
    void dispatchNotificationCreated({
      userIds: [collectorId],
      message: input.approved
        ? 'Resident approved your report cleanup proof.'
        : 'Resident rejected your report cleanup proof.',
      source: 'resident.report.confirmation',
      path: '/(collector)/history',
      data: {
        report_id: reportId,
        approved: input.approved,
      },
    });
  }

  if (shouldRedispatch) {
    await dispatchReportToNextCollector(reportId, {
      residentNotice:
        'Cleanup confirmation was rejected. We are matching another nearby collector.',
    });
  }
};

export const listMyRewards = async (userId: string): Promise<ResidentRewardRow[]> => {
  const res = await query<ResidentRewardRow>(
    `
      SELECT id, user_id, points, reason, related_entity_id, created_at
      FROM rewards
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 500
    `,
    [userId]
  );
  return res.rows;
};
