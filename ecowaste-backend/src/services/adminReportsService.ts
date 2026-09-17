import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { ReportStatus } from '../models/enums';
import { ensureActiveCollector } from './adminUsersService';
import { dispatchReportToNearestCollectors, type DispatchResult } from './dispatchService';
import { publishRealtimeEvent } from './realtimeService';
import { dispatchNotificationCreated } from './notificationsService';

export type ReportDispatchOffer = {
  offer_id: string;
  collector_id: string;
  collector_name: string | null;
  collector_email: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  distance_km: number | null;
  offered_at: string;
  responded_at: string | null;
};

export type WasteReportRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  photo_url: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  priority: 'normal' | 'high' | 'emergency';
  status: ReportStatus;
  verified_by_admin_id: string | null;
  assigned_collector_id: string | null;
  assigned_collector_name: string | null;
  assigned_collector_email: string | null;
  assigned_at: string | null;
  auto_offer_collectors: ReportDispatchOffer[];
  created_at: string;
};

export const listReports = async (filters: {
  status?: ReportStatus;
}): Promise<WasteReportRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`wr.status = $${params.length}`);
  }

  const sql = `
    SELECT
      wr.id,
      wr.user_id,
      u.name AS user_name,
      u.email AS user_email,
      wr.photo_url,
      wr.description,
      wr.latitude::float8 AS latitude,
      wr.longitude::float8 AS longitude,
      wr.priority,
      wr.status,
      wr.verified_by_admin_id,
      wr.assigned_collector_id,
      c.name AS assigned_collector_name,
      c.email AS assigned_collector_email,
      wr.assigned_at,
      dof.auto_offer_collectors,
      wr.created_at
    FROM waste_reports wr
    JOIN users u ON u.id = wr.user_id
    LEFT JOIN users c ON c.id = wr.assigned_collector_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'offer_id', ro.id,
              'collector_id', ro.collector_id,
              'collector_name', co.name,
              'collector_email', co.email,
              'status', ro.status,
              'distance_km', ro.distance_km::float8,
              'offered_at', ro.offered_at,
              'responded_at', ro.responded_at
            )
            ORDER BY
              CASE ro.status
                WHEN 'pending' THEN 0
                WHEN 'accepted' THEN 1
                WHEN 'rejected' THEN 2
                WHEN 'expired' THEN 3
                ELSE 4
              END,
              ro.offered_at DESC
          ),
          '[]'::jsonb
        ) AS auto_offer_collectors
      FROM (
        SELECT id, collector_id, status, distance_km, offered_at, responded_at
        FROM collector_dispatch_offers
        WHERE entity_type = 'report'
          AND entity_id = wr.id
        ORDER BY
          CASE status
            WHEN 'pending' THEN 0
            WHEN 'accepted' THEN 1
            WHEN 'rejected' THEN 2
            WHEN 'expired' THEN 3
            ELSE 4
          END,
          offered_at DESC
        LIMIT 3
      ) ro
      LEFT JOIN users co ON co.id = ro.collector_id
    ) dof ON true
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY wr.created_at DESC
    LIMIT 500
  `;

  const result = await query<WasteReportRow>(sql, params);
  return result.rows;
};

export const updateReportStatus = async (
  reportId: string,
  status: ReportStatus,
  adminId: string
): Promise<void> => {
  const shouldSetVerifier = status === 'verified' || status === 'approved' || status === 'rejected';
  const eventContext = await withTransaction(
    async (
      client
    ): Promise<{
      userId: string;
      collectorId: string | null;
      notificationMessage: string | null;
    }> => {
      const result = await client.query<{
        id: string;
        user_id: string;
        report_type: string | null;
        assigned_collector_id: string | null;
      }>(
        `
        UPDATE waste_reports
        SET status = $2
          ${shouldSetVerifier ? ', verified_by_admin_id = $3' : ''}
        WHERE id = $1
        RETURNING id, user_id, report_type, assigned_collector_id
      `,
        shouldSetVerifier ? [reportId, status, adminId] : [reportId, status]
      );

      const row = result.rows[0];
      if (!row) {
        throw new HttpError('Report not found', 404);
      }

      const nextEventContext = {
        userId: row.user_id,
        collectorId: row.assigned_collector_id ?? null,
        notificationMessage: null as string | null,
      };

      const isIllegalDumping = (row.report_type ?? '').toLowerCase() === 'illegal_dumping';
      const isValidationStatus = status === 'verified' || status === 'approved';

      if (!isIllegalDumping || !isValidationStatus) {
        return nextEventContext;
      }

      const verb = status === 'approved' ? 'approved' : 'verified';
      const notificationMessage = `Your report was ${verb}. A collector will handle cleanup next.`;
      await client.query(
        `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
        [row.user_id, notificationMessage]
      );
      nextEventContext.notificationMessage = notificationMessage;

      return nextEventContext;
    }
  );

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: reportId,
      status,
    },
    roles: ['admin'],
    userIds: [
      ...(eventContext?.userId ? [eventContext.userId] : []),
      ...(eventContext?.collectorId ? [eventContext.collectorId] : []),
    ],
  });

  if (eventContext.notificationMessage) {
    void dispatchNotificationCreated({
      userIds: [eventContext.userId],
      message: eventContext.notificationMessage,
    });
  }
};

export const assignReportCollector = async (
  reportId: string,
  collectorId: string
): Promise<void> => {
  await ensureActiveCollector(collectorId);

  const eventContext = await withTransaction(
    async (
      client
    ): Promise<{
      userId: string;
      previousCollectorId: string | null;
    }> => {
      const reportRes = await client.query<{
        id: string;
        user_id: string;
        assigned_collector_id: string | null;
      }>(
        `
        SELECT id, user_id, assigned_collector_id
        FROM waste_reports
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
        [reportId]
      );

      const report = reportRes.rows[0];
      if (!report) {
        throw new HttpError('Report not found', 404);
      }

      await client.query(
        `
        UPDATE waste_reports
        SET assigned_collector_id = $2,
            assigned_at = now(),
            status = 'assigned'
        WHERE id = $1
      `,
        [reportId, collectorId]
      );

      await client.query(
        `
        UPDATE collector_dispatch_offers
        SET
          status = CASE
            WHEN collector_id = $2 THEN 'accepted'
            ELSE 'expired'
          END,
          responded_at = now(),
          rejection_reason = CASE
            WHEN collector_id = $2 THEN NULL
            ELSE COALESCE(rejection_reason, 'manual_admin_assignment')
          END
        WHERE entity_type = 'report'
          AND entity_id = $1
          AND status = 'pending'
      `,
        [reportId, collectorId]
      );

      await client.query(
        `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
        [report.user_id, 'An admin assigned a collector to your report.']
      );

      await client.query(
        `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
        [collectorId, 'Admin assigned you to a report. Open your dashboard to review details.']
      );

      if (report.assigned_collector_id && report.assigned_collector_id !== collectorId) {
        await client.query(
          `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
          [report.assigned_collector_id, 'This report has been reassigned by admin.']
        );
      }

      return {
        userId: report.user_id,
        previousCollectorId: report.assigned_collector_id ?? null,
      };
    }
  );

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: reportId,
      status: 'assigned',
      assigned_collector_id: collectorId,
    },
    roles: ['admin'],
    userIds: Array.from(
      new Set([
        eventContext.userId,
        collectorId,
        ...(eventContext.previousCollectorId ? [eventContext.previousCollectorId] : []),
      ])
    ),
  });

  void dispatchNotificationCreated({
    userIds: [eventContext.userId],
    message: 'An admin assigned a collector to your report.',
    source: 'admin.report.assigned',
    data: { report_id: reportId, collector_id: collectorId },
  });

  void dispatchNotificationCreated({
    userIds: [collectorId],
    message: 'Admin assigned you to a report. Open your dashboard to review details.',
    source: 'admin.report.assigned',
    data: { report_id: reportId },
  });

  if (eventContext.previousCollectorId && eventContext.previousCollectorId !== collectorId) {
    void dispatchNotificationCreated({
      userIds: [eventContext.previousCollectorId],
      message: 'This report has been reassigned by admin.',
      source: 'admin.report.reassigned',
      data: { report_id: reportId, new_collector_id: collectorId },
    });
  }
};

export const signalNearestCollectorsForReport = async (
  reportId: string,
  maxCollectors = 3
): Promise<DispatchResult> => {
  const requestedCollectors = Math.max(1, Math.min(3, Math.floor(maxCollectors)));
  return dispatchReportToNearestCollectors(reportId, {
    maxCollectors: requestedCollectors,
    residentNotice:
      requestedCollectors > 1
        ? 'We are matching your report with nearby collectors.'
        : 'We are matching your report with the nearest available collector.',
  });
};
