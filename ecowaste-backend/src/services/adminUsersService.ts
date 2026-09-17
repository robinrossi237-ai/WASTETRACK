import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { UserRole } from '../models/user';
import type { CollectorVerificationStatus } from '../models/user';
import { dispatchNotificationCreated } from './notificationsService';
import { publishRealtimeEvent } from './realtimeService';
import { dispatchPickupToNextCollector, dispatchReportToNextCollector } from './dispatchService';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  area: string | null;
  role: UserRole;
  points: number;
  is_active: boolean;
  subscription_plan: string;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note: string | null;
  collector_submitted_at: string | null;
  collector_verified_at: string | null;
  created_at: string;
  last_login_at: string | null;
};

export type CollectorUser = {
  id: string;
  name: string;
  email: string;
  role: 'collector';
  is_active: boolean;
};

export type CollectorApplication = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  area: string | null;
  is_active: boolean;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note: string | null;
  collector_submitted_at: string | null;
  collector_verified_at: string | null;
  created_at: string;
};

export const listUsers = async (filters: {
  q?: string;
  role?: UserRole;
  active?: boolean;
}): Promise<AdminUser[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const p = `$${params.length}`;
    where.push(`(u.name ILIKE ${p} OR u.email ILIKE ${p})`);
  }

  if (filters.role) {
    params.push(filters.role);
    where.push(`u.role = $${params.length}`);
  }

  if (typeof filters.active === 'boolean') {
    params.push(filters.active);
    where.push(`u.is_active = $${params.length}`);
  }

  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.area,
      u.role,
      COALESCE(SUM(r.points), 0)::int AS points,
      u.is_active,
      u.subscription_plan,
      u.collector_verification_status,
      u.collector_verification_note,
      u.collector_submitted_at,
      u.collector_verified_at,
      u.created_at,
      u.last_login_at
    FROM users u
    LEFT JOIN rewards r ON r.user_id = u.id
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY u.id
    ORDER BY COALESCE(u.last_login_at, u.created_at) DESC, u.created_at DESC
    LIMIT 500
  `;

  const result = await query<AdminUser>(sql, params);
  return result.rows;
};

export const setUserActive = async (userId: string, isActive: boolean): Promise<void> => {
  const changed = await withTransaction(async (client) => {
    const result = await client.query<{ id: string; role: UserRole; is_active: boolean }>(
      `
        UPDATE users
        SET is_active = $2
        WHERE id = $1
        RETURNING id, role, is_active
      `,
      [userId, isActive]
    );

    const user = result.rows[0];
    if (!user) {
      throw new HttpError('User not found', 404);
    }

    if (user.role !== 'collector' || isActive) {
      return {
        user,
        affectedEntities: [] as Array<{ entity_type: 'pickup' | 'report'; entity_id: string }>,
      };
    }

    const expiredOffers = await client.query<{
      entity_type: 'pickup' | 'report';
      entity_id: string;
    }>(
      `
        UPDATE collector_dispatch_offers
        SET status = 'expired',
            responded_at = now(),
            rejection_reason = COALESCE(rejection_reason, 'collector_deactivated')
        WHERE collector_id = $1
          AND status = 'pending'
        RETURNING entity_type, entity_id
      `,
      [userId]
    );

    const seen = new Set<string>();
    const affectedEntities = expiredOffers.rows.filter((row) => {
      const key = `${row.entity_type}:${row.entity_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      user,
      affectedEntities,
    };
  });

  if (changed.user.role !== 'collector' || isActive) {
    return;
  }

  for (const entity of changed.affectedEntities) {
    if (entity.entity_type === 'pickup') {
      await dispatchPickupToNextCollector(entity.entity_id, {
        residentNotice:
          'Collector account was deactivated. We are matching another nearby collector.',
      });
      continue;
    }

    await dispatchReportToNextCollector(entity.entity_id, {
      residentNotice:
        'Collector account was deactivated. We are matching another nearby collector.',
    });
  }
};

export const listCollectors = async (): Promise<CollectorUser[]> => {
  const result = await query<CollectorUser>(
    `
      SELECT id, name, email, role, is_active
      FROM users
      WHERE role = 'collector'
        AND is_active = true
        AND collector_verification_status = 'approved'
      ORDER BY created_at DESC
      LIMIT 500
    `
  );

  return result.rows;
};

export const ensureActiveCollector = async (collectorId: string): Promise<void> => {
  const result = await query<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'collector'
        AND is_active = true
        AND collector_verification_status = 'approved'
      LIMIT 1
    `,
    [collectorId]
  );

  if (!result.rows[0]) {
    throw new HttpError('Collector not found or inactive', 400);
  }
};

export const listCollectorApplications = async (filters?: {
  status?: CollectorVerificationStatus;
}): Promise<CollectorApplication[]> => {
  const where: string[] = [`role = 'collector'`];
  const params: unknown[] = [];

  if (filters?.status) {
    params.push(filters.status);
    where.push(`collector_verification_status = $${params.length}`);
  }

  const result = await query<CollectorApplication>(
    `
      SELECT
        id,
        name,
        email,
        phone,
        area,
        is_active,
        collector_verification_status,
        collector_verification_note,
        collector_submitted_at,
        collector_verified_at,
        created_at
      FROM users
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE collector_verification_status
          WHEN 'pending' THEN 0
          WHEN 'rejected' THEN 1
          ELSE 2
        END,
        COALESCE(collector_submitted_at, created_at) DESC
      LIMIT 500
    `,
    params
  );

  return result.rows;
};

export const reviewCollectorApplication = async (input: {
  collectorId: string;
  adminId: string;
  status: Extract<CollectorVerificationStatus, 'approved' | 'rejected'>;
  rejectionReason?: string;
}): Promise<void> => {
  const reviewNote =
    input.status === 'rejected' ? input.rejectionReason?.trim() || 'No reason provided' : null;
  const nextActive = input.status === 'approved';

  const result = await query<{
    id: string;
    name: string;
    collector_verification_status: CollectorVerificationStatus;
  }>(
    `
      UPDATE users
      SET
        collector_verification_status = $2,
        collector_verification_note = $3,
        collector_verified_at = now(),
        is_active = $4
      WHERE id = $1
        AND role = 'collector'
        AND collector_verification_status = 'pending'
      RETURNING id, name, collector_verification_status
    `,
    [input.collectorId, input.status, reviewNote, nextActive]
  );

  const reviewed = result.rows[0];
  if (!reviewed) {
    const existing = await query<{
      id: string;
      collector_verification_status: CollectorVerificationStatus;
    }>(
      `
        SELECT id, collector_verification_status
        FROM users
        WHERE id = $1
          AND role = 'collector'
        LIMIT 1
      `,
      [input.collectorId]
    );

    const row = existing.rows[0];
    if (!row) {
      throw new HttpError('Collector application not found', 404);
    }

    throw new HttpError(`Collector application already ${row.collector_verification_status}`, 409);
  }

  const message =
    input.status === 'approved'
      ? 'Your collector application has been approved. You can now sign in.'
      : `Your collector application was rejected. Reason: ${reviewNote}`;

  await query(
    `
      INSERT INTO notifications (user_id, message, is_read, created_at)
      VALUES ($1, $2, false, now())
    `,
    [input.collectorId, message]
  );

  await dispatchNotificationCreated({
    userIds: [input.collectorId],
    message,
    source: 'collector.application.reviewed',
    data: {
      collector_id: input.collectorId,
      reviewed_by_admin_id: input.adminId,
      review_status: input.status,
    },
  });

  publishRealtimeEvent({
    type: 'collector.application.reviewed',
    roles: ['admin'],
    payload: {
      collector_id: input.collectorId,
      reviewed_by_admin_id: input.adminId,
      status: input.status,
    },
  });
};

export const deleteUserAndRelatedData = async (input: {
  userId: string;
  adminId: string;
}): Promise<{
  userId: string;
  role: UserRole;
  redispatchedPickups: number;
  redispatchedReports: number;
}> => {
  const reopenPickupIds = new Set<string>();
  const reopenReportIds = new Set<string>();

  const deleted = await withTransaction(async (client) => {
    const userRes = await client.query<{ id: string; role: UserRole }>(
      `
        SELECT id, role
        FROM users
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      throw new HttpError('User not found', 404);
    }
    if (user.role === 'admin') {
      throw new HttpError('Admin accounts cannot be deleted', 400);
    }
    if (user.id === input.adminId) {
      throw new HttpError('You cannot delete your own account', 400);
    }

    if (user.role === 'collector') {
      const assignmentRes = await client.query<{
        pickup_request_id: string;
        status: string;
        resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
      }>(
        `
          SELECT pickup_request_id, status, resident_confirmation_status
          FROM collector_assignments
          WHERE collector_id = $1
          FOR UPDATE
        `,
        [input.userId]
      );

      for (const assignment of assignmentRes.rows) {
        if (
          assignment.status === 'assigned' ||
          assignment.status === 'in_progress' ||
          (assignment.status === 'completed' &&
            assignment.resident_confirmation_status !== 'approved')
        ) {
          reopenPickupIds.add(assignment.pickup_request_id);
        }
      }

      if (reopenPickupIds.size > 0) {
        await client.query(
          `
            UPDATE pickup_requests
            SET status = 'approved'
            WHERE id = ANY($1::uuid[])
              AND status IN ('assigned', 'in_progress', 'completed')
          `,
          [Array.from(reopenPickupIds)]
        );
      }

      await client.query(
        `
          DELETE FROM collector_assignments
          WHERE collector_id = $1
        `,
        [input.userId]
      );

      const reportRes = await client.query<{
        id: string;
        status: string;
        resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
      }>(
        `
          SELECT id, status, resident_confirmation_status
          FROM waste_reports
          WHERE assigned_collector_id = $1
          FOR UPDATE
        `,
        [input.userId]
      );

      for (const report of reportRes.rows) {
        if (
          report.status === 'assigned' ||
          (report.status === 'cleaned' && report.resident_confirmation_status !== 'approved')
        ) {
          reopenReportIds.add(report.id);
        }
      }

      if (reopenReportIds.size > 0) {
        try {
          await client.query(
            `
              UPDATE waste_reports
              SET
                status = 'verified',
                assigned_collector_id = NULL,
                cleaned_by_collector_id = NULL,
                cleaned_photo_url = NULL,
                cleaned_note = NULL,
                cleaned_at = NULL,
                resident_confirmation_status = NULL,
                resident_confirmed_at = NULL,
                resident_rejection_note = NULL
              WHERE id = ANY($1::uuid[])
            `,
            [Array.from(reopenReportIds)]
          );
        } catch (err) {
          if (!(
            typeof err === 'object' &&
            err &&
            'code' in err &&
            (err as { code?: string }).code === '42703'
          )) {
            throw err;
          }
          await client.query(
            `
              UPDATE waste_reports
              SET
                status = 'verified',
                assigned_collector_id = NULL,
                resident_confirmation_status = NULL,
                resident_confirmed_at = NULL,
                resident_rejection_note = NULL
              WHERE id = ANY($1::uuid[])
            `,
            [Array.from(reopenReportIds)]
          );
        }
      }
    }

    await client.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [input.userId]
    );

    return user;
  });

  for (const pickupId of reopenPickupIds) {
    await dispatchPickupToNextCollector(pickupId, {
      residentNotice: 'Your pickup is being reassigned after collector account removal.',
    });
  }

  for (const reportId of reopenReportIds) {
    await dispatchReportToNextCollector(reportId, {
      residentNotice: 'Your report is being reassigned after collector account removal.',
    });
  }

  publishRealtimeEvent({
    type: 'admin.user.deleted',
    roles: ['admin'],
    payload: {
      deleted_user_id: deleted.id,
      role: deleted.role,
      deleted_by_admin_id: input.adminId,
    },
  });

  return {
    userId: deleted.id,
    role: deleted.role,
    redispatchedPickups: reopenPickupIds.size,
    redispatchedReports: reopenReportIds.size,
  };
};
