import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PickupStatus, ReportStatus } from '../models/enums';
import { writeAuditLog } from './auditService';
import { publishRealtimeEvent } from './realtimeService';
import { dispatchNotificationCreated } from './notificationsService';
import { dispatchPickupToNextCollector, dispatchReportToNextCollector } from './dispatchService';

export type CollectorAssignmentRow = {
  id: string;
  collector_id: string;
  pickup_request_id: string;
  assigned_at: string;
  completed_at: string | null;
  started_at: string | null;
  completion_photo_url: string | null;
  completion_note: string | null;
  issue_reason: string | null;
  issue_note: string | null;
  completion_submitted_at: string | null;
  resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
  resident_confirmed_at: string | null;
  resident_rejection_note: string | null;
  status: PickupStatus;
  waste_type?: string | null;
  address?: string | null;
  scheduled_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  resident_name?: string | null;
  resident_phone?: string | null;
  resident_email?: string | null;
};

export type CollectorWasteReportRow = {
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
  assigned_collector_id: string | null;
  assigned_at: string | null;
  cleaned_by_collector_id: string | null;
  cleaned_at: string | null;
  cleaned_photo_url: string | null;
  cleaned_note: string | null;
  collector_issue_by_id: string | null;
  collector_issue_at: string | null;
  collector_issue_reason: string | null;
  collector_issue_note: string | null;
  resident_confirmation_status: 'pending' | 'approved' | 'rejected' | null;
  resident_confirmed_at: string | null;
  resident_rejection_note: string | null;
  created_at: string;
  updated_at: string;
  resident_name?: string | null;
  resident_phone?: string | null;
  resident_email?: string | null;
};

export const listAssignedPickups = async (
  collectorId: string
): Promise<CollectorAssignmentRow[]> => {
  const res = await query<CollectorAssignmentRow>(
    `
      SELECT ca.id,
             ca.collector_id,
             ca.pickup_request_id,
             ca.assigned_at,
             ca.started_at,
             ca.completed_at,
             ca.completion_photo_url,
             ca.completion_note,
             ca.issue_reason,
             ca.issue_note,
             ca.completion_submitted_at,
             ca.resident_confirmation_status,
             ca.resident_confirmed_at,
             ca.resident_rejection_note,
             ca.status,
             pr.waste_type,
             pr.address,
             pr.scheduled_date,
             pr.latitude::float8 AS latitude,
             pr.longitude::float8 AS longitude,
             u.name AS resident_name,
             u.phone AS resident_phone,
             u.email AS resident_email
      FROM collector_assignments ca
      JOIN pickup_requests pr ON pr.id = ca.pickup_request_id
      JOIN users u ON u.id = pr.user_id
      WHERE ca.collector_id = $1
        AND ca.status IN ('assigned', 'in_progress')
      ORDER BY ca.assigned_at DESC
      LIMIT 500
    `,
    [collectorId]
  );
  return res.rows;
};

export const listPickupHistory = async (collectorId: string): Promise<CollectorAssignmentRow[]> => {
  const res = await query<CollectorAssignmentRow>(
    `
      SELECT ca.id,
             ca.collector_id,
             ca.pickup_request_id,
             ca.assigned_at,
             ca.started_at,
             ca.completed_at,
             ca.completion_photo_url,
             ca.completion_note,
             ca.issue_reason,
             ca.issue_note,
             ca.completion_submitted_at,
             ca.resident_confirmation_status,
             ca.resident_confirmed_at,
             ca.resident_rejection_note,
             ca.status,
             pr.waste_type,
             pr.address,
             pr.scheduled_date,
             pr.latitude::float8 AS latitude,
             pr.longitude::float8 AS longitude,
             u.name AS resident_name,
             u.phone AS resident_phone,
             u.email AS resident_email
      FROM collector_assignments ca
      JOIN pickup_requests pr ON pr.id = ca.pickup_request_id
      JOIN users u ON u.id = pr.user_id
      WHERE ca.collector_id = $1
        AND ca.status IN ('completed', 'cancelled')
      ORDER BY ca.completed_at DESC NULLS LAST, ca.assigned_at DESC
      LIMIT 500
    `,
    [collectorId]
  );
  return res.rows;
};

export const getCollectorAssignment = async (
  collectorId: string,
  assignmentId: string
): Promise<CollectorAssignmentRow> => {
  const res = await query<CollectorAssignmentRow>(
    `
      SELECT ca.id,
             ca.collector_id,
             ca.pickup_request_id,
             ca.assigned_at,
             ca.started_at,
             ca.completed_at,
             ca.completion_photo_url,
             ca.completion_note,
             ca.issue_reason,
             ca.issue_note,
             ca.completion_submitted_at,
             ca.resident_confirmation_status,
             ca.resident_confirmed_at,
             ca.resident_rejection_note,
             ca.status,
             pr.waste_type,
             pr.address,
             pr.scheduled_date,
             pr.latitude::float8 AS latitude,
             pr.longitude::float8 AS longitude,
             u.name AS resident_name,
             u.phone AS resident_phone,
             u.email AS resident_email
      FROM collector_assignments ca
      JOIN pickup_requests pr ON pr.id = ca.pickup_request_id
      JOIN users u ON u.id = pr.user_id
      WHERE ca.collector_id = $1
        AND ca.id = $2
      LIMIT 1
    `,
    [collectorId, assignmentId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new HttpError('Assignment not found', 404);
  }
  return row;
};

export const startPickupAssignment = async (
  collectorId: string,
  assignmentId: string
): Promise<void> => {
  const eventContext = await withTransaction(
    async (
      client
    ): Promise<{
      pickupRequestId: string;
      residentUserId: string | null;
      notificationMessage: string | null;
    }> => {
      const updated = await client.query<{ pickup_request_id: string }>(
        `
        UPDATE collector_assignments
        SET status = 'in_progress',
            started_at = now()
        WHERE id = $1
          AND collector_id = $2
          AND status = 'assigned'
        RETURNING pickup_request_id
      `,
        [assignmentId, collectorId]
      );

      const row = updated.rows[0];
      if (!row) {
        const existing = await client.query<{ status: PickupStatus }>(
          `
          SELECT status
          FROM collector_assignments
          WHERE id = $1
            AND collector_id = $2
          LIMIT 1
        `,
          [assignmentId, collectorId]
        );

        if (!existing.rows[0]) {
          throw new HttpError('Assignment not found', 404);
        }

        throw new HttpError('Assignment cannot be started in its current status', 409);
      }

      const pickupUpdated = await client.query<{ id: string }>(
        `
        UPDATE pickup_requests
        SET status = 'in_progress'
        WHERE id = $1
          AND status IN ('assigned', 'approved', 'overdue')
        RETURNING id
      `,
        [row.pickup_request_id]
      );

      if (!pickupUpdated.rows[0]) {
        throw new HttpError('Pickup request cannot be started in its current status', 409);
      }

      const pickupOwnerRes = await client.query<{ user_id: string }>(
        `
        SELECT user_id
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
      `,
        [row.pickup_request_id]
      );

      const pickupOwner = pickupOwnerRes.rows[0];
      const nextEventContext = {
        pickupRequestId: row.pickup_request_id,
        residentUserId: pickupOwner?.user_id ?? null,
        notificationMessage: null as string | null,
      };
      if (pickupOwner) {
        const notificationMessage = 'Your pickup request is now in progress.';
        await client.query(
          `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
          [pickupOwner.user_id, notificationMessage]
        );
        nextEventContext.notificationMessage = notificationMessage;
      }

      try {
        await writeAuditLog({
          entityType: 'collector_assignment',
          entityId: assignmentId,
          action: 'collector:start',
          actorId: collectorId,
        });
      } catch {
        // best-effort audit
      }

      return nextEventContext;
    }
  );

  publishRealtimeEvent({
    type: 'assignment.updated',
    payload: {
      assignment_id: assignmentId,
      pickup_request_id: eventContext?.pickupRequestId ?? null,
      status: 'in_progress',
    },
    roles: ['admin'],
    userIds: [collectorId, ...(eventContext?.residentUserId ? [eventContext.residentUserId] : [])],
  });

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: eventContext?.pickupRequestId ?? null,
      status: 'in_progress',
    },
    roles: ['admin'],
    userIds: [collectorId, ...(eventContext?.residentUserId ? [eventContext.residentUserId] : [])],
  });

  if (eventContext?.residentUserId && eventContext.notificationMessage) {
    void dispatchNotificationCreated({
      userIds: [eventContext.residentUserId],
      message: eventContext.notificationMessage,
      source: 'collector.pickup.started',
      path: '/pickup/tracking',
      data: {
        pickup_request_id: eventContext.pickupRequestId,
      },
    });
  }
};

export const completePickupAssignment = async (
  collectorId: string,
  assignmentId: string,
  input?: { completionPhotoUrl?: string | null; completionNote?: string | null }
): Promise<void> => {
  const eventContext = await withTransaction(
    async (
      client
    ): Promise<{
      pickupRequestId: string;
      residentUserId: string | null;
      notificationMessage: string | null;
    }> => {
      const updated = await client.query<{ pickup_request_id: string }>(
        `
        UPDATE collector_assignments
        SET status = 'completed',
            completed_at = now(),
            completion_submitted_at = now(),
            resident_confirmation_status = 'pending',
            resident_confirmed_at = NULL,
            resident_rejection_note = NULL,
            completion_photo_url = COALESCE($3, completion_photo_url),
            completion_note = COALESCE($4, completion_note)
        WHERE id = $1
          AND collector_id = $2
          AND status = 'in_progress'
        RETURNING pickup_request_id
      `,
        [
          assignmentId,
          collectorId,
          input?.completionPhotoUrl ?? null,
          input?.completionNote ?? null,
        ]
      );

      const row = updated.rows[0];
      if (!row) {
        const existing = await client.query<{ status: PickupStatus }>(
          `
          SELECT status
          FROM collector_assignments
          WHERE id = $1
            AND collector_id = $2
          LIMIT 1
        `,
          [assignmentId, collectorId]
        );

        if (!existing.rows[0]) {
          throw new HttpError('Assignment not found', 404);
        }

        throw new HttpError('Assignment cannot be completed in its current status', 409);
      }

      const pickupUpdated = await client.query<{ id: string }>(
        `
        UPDATE pickup_requests
        SET status = 'completed'
        WHERE id = $1
          AND status IN ('in_progress', 'assigned', 'overdue')
        RETURNING id
      `,
        [row.pickup_request_id]
      );

      if (!pickupUpdated.rows[0]) {
        throw new HttpError('Pickup request cannot be completed in its current status', 409);
      }

      const pickupOwnerRes = await client.query<{ user_id: string }>(
        `
        SELECT user_id
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
      `,
        [row.pickup_request_id]
      );

      const pickupOwner = pickupOwnerRes.rows[0];
      let notificationMessage: string | null = null;
      if (pickupOwner) {
        notificationMessage =
          'Your collector submitted pickup completion proof. Please approve or reject in History.';
        await client.query(
          `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
          [pickupOwner.user_id, notificationMessage]
        );
      }

      const nextEventContext = {
        pickupRequestId: row.pickup_request_id,
        residentUserId: pickupOwner?.user_id ?? null,
        notificationMessage,
      };

      try {
        await writeAuditLog({
          entityType: 'collector_assignment',
          entityId: assignmentId,
          action: 'collector:complete',
          actorId: collectorId,
          metadata: {
            has_completion_photo: !!input?.completionPhotoUrl,
            has_completion_note: !!input?.completionNote,
          },
        });
      } catch {
        // best-effort audit
      }

      return nextEventContext;
    }
  );

  publishRealtimeEvent({
    type: 'assignment.updated',
    payload: {
      assignment_id: assignmentId,
      pickup_request_id: eventContext?.pickupRequestId ?? null,
      status: 'completed',
      resident_confirmation_status: 'pending',
    },
    roles: ['admin'],
    userIds: [collectorId, ...(eventContext?.residentUserId ? [eventContext.residentUserId] : [])],
  });

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: eventContext?.pickupRequestId ?? null,
      status: 'completed',
      resident_confirmation_status: 'pending',
    },
    roles: ['admin'],
    userIds: [collectorId, ...(eventContext?.residentUserId ? [eventContext.residentUserId] : [])],
  });

  if (eventContext?.residentUserId && eventContext.notificationMessage) {
    void dispatchNotificationCreated({
      userIds: [eventContext.residentUserId],
      message: eventContext.notificationMessage,
      source: 'collector.pickup.proof.submitted',
      path: '/profile/history',
      data: {
        pickup_request_id: eventContext.pickupRequestId,
        resident_confirmation_status: 'pending',
      },
    });
  }
};

export const reportPickupIssue = async (
  collectorId: string,
  assignmentId: string,
  input: { reason: string; note?: string }
): Promise<void> => {
  const eventContext = await withTransaction(
    async (
      client
    ): Promise<{
      pickupRequestId: string;
      residentUserId: string | null;
      notificationMessage: string | null;
    }> => {
      const updated = await client.query<{ pickup_request_id: string }>(
        `
        UPDATE collector_assignments
        SET status = 'cancelled',
            issue_reason = $3,
            issue_note = $4
        WHERE id = $1
          AND collector_id = $2
          AND status IN ('assigned', 'in_progress')
        RETURNING pickup_request_id
      `,
        [assignmentId, collectorId, input.reason, input.note ?? null]
      );

      const row = updated.rows[0];
      if (!row) {
        throw new HttpError('Assignment cannot be marked with an issue', 409);
      }

      const pickupUpdated = await client.query<{ id: string }>(
        `
        UPDATE pickup_requests
        SET status = 'approved'
        WHERE id = $1
          AND status IN ('assigned', 'in_progress', 'approved', 'overdue')
        RETURNING id
      `,
        [row.pickup_request_id]
      );

      if (!pickupUpdated.rows[0]) {
        throw new HttpError(
          'Pickup request cannot be marked with an issue in its current status',
          409
        );
      }

      const pickupOwnerRes = await client.query<{ user_id: string }>(
        `
        SELECT user_id
        FROM pickup_requests
        WHERE id = $1
        LIMIT 1
      `,
        [row.pickup_request_id]
      );

      const pickupOwner = pickupOwnerRes.rows[0];
      const nextEventContext = {
        pickupRequestId: row.pickup_request_id,
        residentUserId: pickupOwner?.user_id ?? null,
        notificationMessage: null as string | null,
      };
      if (pickupOwner) {
        const notificationMessage = `A collector reported an issue: ${input.reason}. We are matching another nearby collector.`;
        await client.query(
          `
          INSERT INTO notifications (user_id, message)
          VALUES ($1, $2)
        `,
          [pickupOwner.user_id, notificationMessage]
        );
        nextEventContext.notificationMessage = notificationMessage;
      }

      try {
        await writeAuditLog({
          entityType: 'collector_assignment',
          entityId: assignmentId,
          action: 'collector:issue',
          actorId: collectorId,
          metadata: { reason: input.reason },
        });
      } catch {
        // best-effort audit
      }

      return nextEventContext;
    }
  );

  publishRealtimeEvent({
    type: 'assignment.updated',
    payload: {
      assignment_id: assignmentId,
      pickup_request_id: eventContext?.pickupRequestId ?? null,
      status: 'cancelled',
      reason: input.reason,
    },
    roles: ['admin'],
    userIds: [collectorId, ...(eventContext?.residentUserId ? [eventContext.residentUserId] : [])],
  });

  publishRealtimeEvent({
    type: 'pickup.updated',
    payload: {
      pickup_id: eventContext?.pickupRequestId ?? null,
      status: 'approved',
      reason: input.reason,
    },
    roles: ['admin'],
    userIds: [collectorId, ...(eventContext?.residentUserId ? [eventContext.residentUserId] : [])],
  });

  if (eventContext?.residentUserId && eventContext.notificationMessage) {
    void dispatchNotificationCreated({
      userIds: [eventContext.residentUserId],
      message: eventContext.notificationMessage,
    });
  }

  if (eventContext?.pickupRequestId) {
    await dispatchPickupToNextCollector(eventContext.pickupRequestId, {
      residentNotice: 'A collector reported an issue. We are matching another nearby collector.',
    });
  }
};

export const listAssignedReports = async (
  collectorId: string
): Promise<CollectorWasteReportRow[]> => {
  const res = await query<CollectorWasteReportRow>(
    `
      SELECT
        wr.id,
        wr.user_id,
        wr.photo_url,
        wr.report_type,
        wr.location_text,
        wr.description,
        wr.latitude::float8 AS latitude,
        wr.longitude::float8 AS longitude,
        wr.priority,
        wr.status,
        wr.assigned_collector_id,
        wr.assigned_at,
        wr.cleaned_by_collector_id,
        wr.cleaned_at,
        wr.cleaned_photo_url,
        wr.cleaned_note,
        wr.collector_issue_by_id,
        wr.collector_issue_at,
        wr.collector_issue_reason,
        wr.collector_issue_note,
        wr.resident_confirmation_status,
        wr.resident_confirmed_at,
        wr.resident_rejection_note,
        wr.created_at,
        wr.updated_at,
        u.name AS resident_name,
        u.phone AS resident_phone,
        u.email AS resident_email
      FROM waste_reports wr
      JOIN users u ON u.id = wr.user_id
      WHERE wr.assigned_collector_id = $1
        AND wr.status = 'assigned'
      ORDER BY wr.assigned_at DESC NULLS LAST, wr.created_at DESC
      LIMIT 500
    `,
    [collectorId]
  );
  return res.rows;
};

export const listReportHistory = async (
  collectorId: string
): Promise<CollectorWasteReportRow[]> => {
  const res = await query<CollectorWasteReportRow>(
    `
      SELECT
        wr.id,
        wr.user_id,
        wr.photo_url,
        wr.report_type,
        wr.location_text,
        wr.description,
        wr.latitude::float8 AS latitude,
        wr.longitude::float8 AS longitude,
        wr.priority,
        wr.status,
        wr.assigned_collector_id,
        wr.assigned_at,
        wr.cleaned_by_collector_id,
        wr.cleaned_at,
        wr.cleaned_photo_url,
        wr.cleaned_note,
        wr.collector_issue_by_id,
        wr.collector_issue_at,
        wr.collector_issue_reason,
        wr.collector_issue_note,
        wr.resident_confirmation_status,
        wr.resident_confirmed_at,
        wr.resident_rejection_note,
        wr.created_at,
        wr.updated_at,
        u.name AS resident_name,
        u.phone AS resident_phone,
        u.email AS resident_email
      FROM waste_reports wr
      JOIN users u ON u.id = wr.user_id
      WHERE (wr.cleaned_by_collector_id = $1 OR wr.collector_issue_by_id = $1)
        AND wr.status <> 'assigned'
      ORDER BY COALESCE(wr.cleaned_at, wr.collector_issue_at, wr.updated_at, wr.created_at) DESC
      LIMIT 500
    `,
    [collectorId]
  );
  return res.rows;
};

export const getCollectorWasteReport = async (
  collectorId: string,
  reportId: string
): Promise<CollectorWasteReportRow> => {
  const res = await query<CollectorWasteReportRow>(
    `
      SELECT
        wr.id,
        wr.user_id,
        wr.photo_url,
        wr.report_type,
        wr.location_text,
        wr.description,
        wr.latitude::float8 AS latitude,
        wr.longitude::float8 AS longitude,
        wr.priority,
        wr.status,
        wr.assigned_collector_id,
        wr.assigned_at,
        wr.cleaned_by_collector_id,
        wr.cleaned_at,
        wr.cleaned_photo_url,
        wr.cleaned_note,
        wr.collector_issue_by_id,
        wr.collector_issue_at,
        wr.collector_issue_reason,
        wr.collector_issue_note,
        wr.resident_confirmation_status,
        wr.resident_confirmed_at,
        wr.resident_rejection_note,
        wr.created_at,
        wr.updated_at,
        u.name AS resident_name,
        u.phone AS resident_phone,
        u.email AS resident_email
      FROM waste_reports wr
      JOIN users u ON u.id = wr.user_id
      WHERE wr.id = $2
        AND (wr.assigned_collector_id = $1 OR wr.cleaned_by_collector_id = $1 OR wr.collector_issue_by_id = $1)
      LIMIT 1
    `,
    [collectorId, reportId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new HttpError('Report not found', 404);
  }
  return row;
};

export const cleanWasteReport = async (
  collectorId: string,
  reportId: string,
  input?: { cleanedPhotoUrl?: string | null; cleanedNote?: string | null }
): Promise<void> => {
  let residentUserId: string | null = null;
  let notificationMessage: string | null = null;

  await withTransaction(async (client) => {
    const updated = await client.query<{ user_id: string }>(
      `
        UPDATE waste_reports
        SET status = 'cleaned',
            cleaned_by_collector_id = $2,
            cleaned_at = now(),
            resident_confirmation_status = 'pending',
            resident_confirmed_at = NULL,
            resident_rejection_note = NULL,
            cleaned_photo_url = COALESCE($3, cleaned_photo_url),
            cleaned_note = COALESCE($4, cleaned_note)
        WHERE id = $1
          AND assigned_collector_id = $2
          AND status = 'assigned'
        RETURNING user_id
      `,
      [reportId, collectorId, input?.cleanedPhotoUrl ?? null, input?.cleanedNote ?? null]
    );

    const row = updated.rows[0];
    if (!row) {
      const existing = await client.query<{
        status: ReportStatus;
        assigned_collector_id: string | null;
      }>(
        `
          SELECT status, assigned_collector_id
          FROM waste_reports
          WHERE id = $1
          LIMIT 1
        `,
        [reportId]
      );

      const existingRow = existing.rows[0];
      if (!existingRow) {
        throw new HttpError('Report not found', 404);
      }
      if (existingRow.assigned_collector_id !== collectorId) {
        throw new HttpError('Forbidden', 403);
      }
      throw new HttpError('Report cannot be marked cleaned in its current status', 409);
    }

    residentUserId = row.user_id;
    notificationMessage =
      'Your collector submitted cleanup proof for this report. Please approve or reject in History.';

    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [row.user_id, notificationMessage]
    );

    try {
      await writeAuditLog({
        entityType: 'waste_report',
        entityId: reportId,
        action: 'collector:clean',
        actorId: collectorId,
        metadata: {
          has_cleaned_photo: !!input?.cleanedPhotoUrl,
          has_cleaned_note: !!input?.cleanedNote,
        },
      });
    } catch {
      // best-effort audit
    }
  });

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: reportId,
      status: 'cleaned',
      resident_confirmation_status: 'pending',
    },
    roles: ['admin'],
    userIds: [collectorId, ...(residentUserId ? [residentUserId] : [])],
  });

  if (residentUserId && notificationMessage) {
    void dispatchNotificationCreated({
      userIds: [residentUserId],
      message: notificationMessage,
      source: 'collector.report.proof.submitted',
      path: '/profile/history',
      data: {
        report_id: reportId,
        resident_confirmation_status: 'pending',
      },
    });
  }
};

export const reportWasteReportIssue = async (
  collectorId: string,
  reportId: string,
  input: { reason: string; note?: string }
): Promise<void> => {
  let residentUserId: string | null = null;
  let notificationMessage: string | null = null;

  await withTransaction(async (client) => {
    const updated = await client.query<{ user_id: string }>(
      `
        UPDATE waste_reports
        SET status = 'verified',
            assigned_collector_id = NULL,
            assigned_at = NULL,
            resident_confirmation_status = NULL,
            resident_confirmed_at = NULL,
            resident_rejection_note = NULL,
            collector_issue_by_id = $2,
            collector_issue_at = now(),
            collector_issue_reason = $3,
            collector_issue_note = $4
        WHERE id = $1
          AND assigned_collector_id = $2
          AND status = 'assigned'
        RETURNING user_id
      `,
      [reportId, collectorId, input.reason, input.note ?? null]
    );

    const row = updated.rows[0];
    if (!row) {
      const existing = await client.query<{
        status: ReportStatus;
        assigned_collector_id: string | null;
      }>(
        `
          SELECT status, assigned_collector_id
          FROM waste_reports
          WHERE id = $1
          LIMIT 1
        `,
        [reportId]
      );

      const existingRow = existing.rows[0];
      if (!existingRow) {
        throw new HttpError('Report not found', 404);
      }
      if (existingRow.assigned_collector_id !== collectorId) {
        throw new HttpError('Forbidden', 403);
      }
      throw new HttpError('Report cannot be marked with an issue in its current status', 409);
    }

    await client.query(
      `
        INSERT INTO notifications (user_id, message)
        VALUES ($1, $2)
      `,
      [
        row.user_id,
        (notificationMessage = `A collector reported an issue for your report: ${input.reason}.`),
      ]
    );

    residentUserId = row.user_id;

    try {
      await writeAuditLog({
        entityType: 'waste_report',
        entityId: reportId,
        action: 'collector:issue',
        actorId: collectorId,
        metadata: { reason: input.reason },
      });
    } catch {
      // best-effort audit
    }
  });

  publishRealtimeEvent({
    type: 'report.updated',
    payload: {
      report_id: reportId,
      status: 'verified',
      reason: input.reason,
    },
    roles: ['admin'],
    userIds: [collectorId, ...(residentUserId ? [residentUserId] : [])],
  });

  if (residentUserId && notificationMessage) {
    void dispatchNotificationCreated({
      userIds: [residentUserId],
      message: notificationMessage,
    });
  }

  await dispatchReportToNextCollector(reportId, {
    residentNotice: 'A collector reported an issue. We are matching another nearby collector.',
  });
};
