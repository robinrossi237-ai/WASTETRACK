import type { PoolClient } from 'pg';

import { query, withTransaction } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import { publishRealtimeEvent } from './realtimeService';
import { dispatchNotificationCreated } from './notificationsService';

type DispatchEntityType = 'pickup' | 'report';
type DispatchOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

const PICKUP_DISPATCHABLE_STATUSES = new Set(['pending', 'approved', 'overdue']);
const REPORT_DISPATCHABLE_STATUSES = new Set(['reported', 'verified']);
const MAX_DISTANCE_KM = 30;
const MAX_LOGIN_AGE_HOURS = 72;
const MAX_LOCATION_AGE_MINUTES = 180;
const DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS = 30 * 60;
const PICKUP_DISPATCH_WINDOW_CRITICAL_SECONDS = 30 * 60;
const PICKUP_DISPATCH_WINDOW_SOON_SECONDS = 30 * 60;
const PICKUP_DISPATCH_WINDOW_STANDARD_SECONDS = 30 * 60;
const PICKUP_DISPATCH_WINDOW_RELAXED_SECONDS = 30 * 60;
export const DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS =
  DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS;
const DISPATCH_OFFER_TIMEOUT_REASON = 'offer_timeout';

type CollectorCandidateRow = {
  collector_id: string;
  collector_name: string;
  collector_phone: string | null;
  collector_area: string | null;
  latitude: number;
  longitude: number;
  location_updated_at: string;
  last_login_at: string | null;
  active_pickups: number;
  active_reports: number;
  distance_km: number | null;
};

type DispatchCandidate = {
  collectorId: string;
  collectorName: string;
  collectorPhone: string | null;
  distanceKm: number | null;
  score: number;
};

type DispatchOffer = {
  id: string;
  entity_type: DispatchEntityType;
  entity_id: string;
  collector_id: string;
  resident_id: string;
  status: DispatchOfferStatus;
  distance_km: number | null;
  score: number | null;
  offered_at: string;
  responded_at: string | null;
  rejection_reason: string | null;
};

export type CollectorPendingOfferRow = {
  id: string;
  entity_type: DispatchEntityType;
  entity_id: string;
  status: DispatchOfferStatus;
  offered_at: string;
  expires_at: string;
  seconds_remaining: number;
  response_window_seconds: number;
  distance_km: number | null;
  score: number | null;
  resident_id: string;
  resident_name: string;
  resident_phone: string | null;
  resident_area: string | null;
  waste_type: string | null;
  report_type: string | null;
  address: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduled_date: string | null;
  report_created_at: string | null;
};

export type DispatchResult = {
  dispatched: boolean;
  offerId: string | null;
  collectorId: string | null;
  collectorName: string | null;
  residentId: string | null;
  reason: string;
  offers?: Array<{
    offerId: string;
    collectorId: string;
    collectorName: string;
  }>;
};

type ExpiredDispatchEntity = {
  entity_type: DispatchEntityType;
  entity_id: string;
};

type OfferResponseTxResult = {
  action: 'accepted' | 'rejected' | 'expired';
  entityType: DispatchEntityType;
  entityId: string;
  residentId: string | null;
  assignmentId: string | null;
  hasPendingOffers?: boolean;
};

export type CollectorOfferResponse = {
  action: 'accepted' | 'rejected';
  entity_type: DispatchEntityType;
  entity_id: string;
  assignment_id: string | null;
};

const isPgErrorWithCode = (err: unknown): err is { code: string } => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return typeof maybe.code === 'string';
};

const toFiniteNumber = (value: number | null | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseDateMs = (value: string): number => {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return Date.now();
  }
  return parsed;
};

const computePickupResponseWindowSeconds = (
  scheduledDate: string | null | undefined,
  now: Date = new Date()
): number => {
  if (!scheduledDate) return PICKUP_DISPATCH_WINDOW_STANDARD_SECONDS;
  const scheduledAtMs = new Date(scheduledDate).getTime();
  if (!Number.isFinite(scheduledAtMs)) return PICKUP_DISPATCH_WINDOW_STANDARD_SECONDS;
  const minutesUntilScheduled = (scheduledAtMs - now.getTime()) / (1000 * 60);

  if (minutesUntilScheduled <= 90) return PICKUP_DISPATCH_WINDOW_CRITICAL_SECONDS;
  if (minutesUntilScheduled <= 6 * 60) return PICKUP_DISPATCH_WINDOW_SOON_SECONDS;
  if (minutesUntilScheduled <= 24 * 60) return PICKUP_DISPATCH_WINDOW_STANDARD_SECONDS;
  return PICKUP_DISPATCH_WINDOW_RELAXED_SECONDS;
};

const getOfferResponseWindowSecondsForEntity = (
  entityType: DispatchEntityType,
  scheduledDate: string | null | undefined,
  now: Date = new Date()
): number => {
  if (entityType === 'pickup') {
    return computePickupResponseWindowSeconds(scheduledDate, now);
  }
  return DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS;
};

const getOfferResponseWindowSecondsTx = async (
  client: PoolClient,
  input: {
    entityType: DispatchEntityType;
    entityId: string;
    now?: Date;
  }
): Promise<number> => {
  if (input.entityType !== 'pickup') {
    return DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS;
  }

  const pickupRes = await client.query<{ scheduled_date: string | null }>(
    `
      SELECT scheduled_date
      FROM pickup_requests
      WHERE id = $1
      LIMIT 1
    `,
    [input.entityId]
  );

  return getOfferResponseWindowSecondsForEntity(
    'pickup',
    pickupRes.rows[0]?.scheduled_date ?? null,
    input.now
  );
};

export const getDispatchOfferExpiryDate = (
  offeredAt: string,
  responseWindowSeconds = DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS
): Date => new Date(parseDateMs(offeredAt) + responseWindowSeconds * 1000);

export const getDispatchOfferRemainingSeconds = (
  offeredAt: string,
  responseWindowSeconds = DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS,
  now: Date = new Date()
): number => {
  const expiresAtMs = getDispatchOfferExpiryDate(offeredAt, responseWindowSeconds).getTime();
  const remainingMs = expiresAtMs - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / 1000));
};

const computeCandidateScore = (input: {
  distanceKm: number | null;
  locationAgeMinutes: number;
  lastLoginHours: number;
  workload: number;
  areaMatch: boolean;
}): number => {
  const distanceScore =
    typeof input.distanceKm === 'number'
      ? clamp(1 - input.distanceKm / MAX_DISTANCE_KM, 0, 1)
      : input.areaMatch
        ? 0.65
        : 0.4;
  const recencyScore = clamp(1 - input.lastLoginHours / MAX_LOGIN_AGE_HOURS, 0, 1);
  const freshnessScore = clamp(1 - input.locationAgeMinutes / MAX_LOCATION_AGE_MINUTES, 0, 1);
  const workloadPenalty = clamp(input.workload / 6, 0, 1);
  const areaBonus = input.areaMatch ? 0.08 : 0;

  const score =
    distanceScore * 0.55 +
    recencyScore * 0.25 +
    freshnessScore * 0.2 +
    areaBonus -
    workloadPenalty * 0.2;

  return clamp(score, 0, 1);
};

const insertNotificationTx = async (
  client: PoolClient,
  userId: string,
  message: string
): Promise<void> => {
  await client.query(
    `
      INSERT INTO notifications (user_id, message)
      VALUES ($1, $2)
    `,
    [userId, message]
  );
};

const expireOtherPendingOffersTx = async (
  client: PoolClient,
  input: { entityType: DispatchEntityType; entityId: string; exceptOfferId?: string | null }
): Promise<void> => {
  const params: unknown[] = [input.entityType, input.entityId];
  let whereTail = '';
  if (input.exceptOfferId) {
    params.push(input.exceptOfferId);
    whereTail = `AND id <> $${params.length}`;
  }

  await client.query(
    `
      UPDATE collector_dispatch_offers
      SET status = 'expired',
          responded_at = now(),
          rejection_reason = COALESCE(rejection_reason, 'superseded')
      WHERE entity_type = $1
        AND entity_id = $2
        AND status = 'pending'
        ${whereTail}
    `,
    params
  );
};

const expireTimedOutOffersTx = async (
  client: PoolClient,
  input?: { collectorId?: string; offerId?: string }
): Promise<ExpiredDispatchEntity[]> => {
  const where: string[] = [`status = 'pending'`];
  const params: unknown[] = [];

  if (input?.collectorId) {
    params.push(input.collectorId);
    where.push(`collector_id = $${params.length}`);
  }
  if (input?.offerId) {
    params.push(input.offerId);
    where.push(`id = $${params.length}`);
  }

  const pendingResult = await client.query<{
    id: string;
    entity_type: DispatchEntityType;
    entity_id: string;
    offered_at: string;
  }>(
    `
      SELECT id, entity_type, entity_id, offered_at
      FROM collector_dispatch_offers
      WHERE ${where.join('\n        AND ')}
    `,
    params
  );

  if (pendingResult.rows.length === 0) {
    return [];
  }

  const now = new Date();
  const expiredOfferIds: string[] = [];
  for (const offer of pendingResult.rows) {
    const responseWindowSeconds = await getOfferResponseWindowSecondsTx(client, {
      entityType: offer.entity_type,
      entityId: offer.entity_id,
      now,
    });
    const remainingSeconds = getDispatchOfferRemainingSeconds(
      offer.offered_at,
      responseWindowSeconds,
      now
    );
    if (remainingSeconds <= 0) {
      expiredOfferIds.push(offer.id);
    }
  }

  if (expiredOfferIds.length === 0) {
    return [];
  }

  const result = await client.query<ExpiredDispatchEntity>(
    `
      UPDATE collector_dispatch_offers
      SET status = 'expired',
          responded_at = now(),
          rejection_reason = COALESCE(rejection_reason, $2)
      WHERE id = ANY($1::uuid[])
      RETURNING entity_type, entity_id
    `,
    [expiredOfferIds, DISPATCH_OFFER_TIMEOUT_REASON]
  );

  const seen = new Set<string>();
  return result.rows.filter((row) => {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findCollectorCandidatesTx = async (
  client: PoolClient,
  input: {
    entityType: DispatchEntityType;
    entityId: string;
    latitude: number | null;
    longitude: number | null;
    residentArea: string | null;
    limit?: number;
  }
): Promise<DispatchCandidate[]> => {
  const rows = await client.query<CollectorCandidateRow>(
    `
      WITH active_pickups AS (
        SELECT collector_id, count(*)::int AS count
        FROM collector_assignments
        WHERE status IN ('assigned', 'in_progress')
        GROUP BY collector_id
      ),
      active_reports AS (
        SELECT assigned_collector_id AS collector_id, count(*)::int AS count
        FROM waste_reports
        WHERE status = 'assigned'
          AND assigned_collector_id IS NOT NULL
        GROUP BY assigned_collector_id
      )
      SELECT
        u.id AS collector_id,
        u.name AS collector_name,
        u.phone AS collector_phone,
        u.area AS collector_area,
        ul.latitude::float8 AS latitude,
        ul.longitude::float8 AS longitude,
        ul.updated_at AS location_updated_at,
        u.last_login_at,
        COALESCE(ap.count, 0)::int AS active_pickups,
        COALESCE(ar.count, 0)::int AS active_reports,
        CASE
          WHEN $3::float8 IS NULL OR $4::float8 IS NULL THEN NULL
          ELSE (
            6371 * 2 * asin(
              sqrt(
                power(sin(radians(($3::float8 - ul.latitude::float8) / 2)), 2) +
                cos(radians(ul.latitude::float8)) * cos(radians($3::float8)) *
                power(sin(radians(($4::float8 - ul.longitude::float8) / 2)), 2)
              )
            )
          )
        END::float8 AS distance_km
      FROM users u
      JOIN user_locations ul ON ul.user_id = u.id
      LEFT JOIN active_pickups ap ON ap.collector_id = u.id
      LEFT JOIN active_reports ar ON ar.collector_id = u.id
      WHERE u.role = 'collector'
        AND u.is_active = true
        AND u.collector_verification_status = 'approved'
        AND ul.updated_at >= now() - make_interval(mins => ${MAX_LOCATION_AGE_MINUTES})
        AND (
          u.last_login_at IS NULL
          OR u.last_login_at >= now() - make_interval(hours => ${MAX_LOGIN_AGE_HOURS})
        )
        AND NOT EXISTS (
          SELECT 1
          FROM collector_dispatch_offers o
          WHERE o.entity_type = $1
            AND o.entity_id = $2
            AND o.collector_id = u.id
        )
      ORDER BY ul.updated_at DESC
    `,
    [input.entityType, input.entityId, input.latitude, input.longitude]
  );

  const now = Date.now();
  const residentAreaNormalized = input.residentArea?.trim().toLowerCase() ?? null;

  const ranked = rows.rows
    .map((row): DispatchCandidate & { lastLoginHours: number } => {
      const locationAgeMinutes = Math.max(
        0,
        (now - new Date(row.location_updated_at).getTime()) / (1000 * 60)
      );
      const lastLoginHours = row.last_login_at
        ? Math.max(0, (now - new Date(row.last_login_at).getTime()) / (1000 * 60 * 60))
        : MAX_LOGIN_AGE_HOURS * 2;
      const workload = toFiniteNumber(row.active_pickups) + toFiniteNumber(row.active_reports);
      const areaMatch =
        !!residentAreaNormalized &&
        !!row.collector_area &&
        row.collector_area.trim().toLowerCase() === residentAreaNormalized;
      const score = computeCandidateScore({
        distanceKm: row.distance_km,
        locationAgeMinutes,
        lastLoginHours,
        workload,
        areaMatch,
      });
      return {
        collectorId: row.collector_id,
        collectorName: row.collector_name,
        collectorPhone: row.collector_phone,
        distanceKm: row.distance_km,
        score,
        lastLoginHours,
      };
    })
    .sort((left, right) => {
      const leftDistanceKnown =
        typeof left.distanceKm === 'number' && Number.isFinite(left.distanceKm);
      const rightDistanceKnown =
        typeof right.distanceKm === 'number' && Number.isFinite(right.distanceKm);

      if (leftDistanceKnown && rightDistanceKnown) {
        const leftDistance = left.distanceKm as number;
        const rightDistance = right.distanceKm as number;
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
      } else if (leftDistanceKnown !== rightDistanceKnown) {
        return leftDistanceKnown ? -1 : 1;
      }

      if (left.lastLoginHours !== right.lastLoginHours) {
        return left.lastLoginHours - right.lastLoginHours;
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.collectorId.localeCompare(right.collectorId);
    });

  const limit = Math.max(1, Math.floor(input.limit ?? 1));
  return ranked.slice(0, limit).map((candidate) => ({
    collectorId: candidate.collectorId,
    collectorName: candidate.collectorName,
    collectorPhone: candidate.collectorPhone,
    distanceKm: candidate.distanceKm,
    score: candidate.score,
  }));
};

const createDispatchOfferTx = async (
  client: PoolClient,
  input: {
    entityType: DispatchEntityType;
    entityId: string;
    collectorId: string;
    residentId: string;
    distanceKm: number | null;
    score: number;
  }
): Promise<DispatchOffer> => {
  const result = await client.query<DispatchOffer>(
    `
      INSERT INTO collector_dispatch_offers (
        entity_type,
        entity_id,
        collector_id,
        resident_id,
        status,
        distance_km,
        score
      )
      VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING
        id,
        entity_type,
        entity_id,
        collector_id,
        resident_id,
        status,
        distance_km::float8 AS distance_km,
        score::float8 AS score,
        offered_at,
        responded_at,
        rejection_reason
    `,
    [
      input.entityType,
      input.entityId,
      input.collectorId,
      input.residentId,
      input.distanceKm,
      input.score,
    ]
  );

  const offer = result.rows[0];
  if (!offer) {
    throw new Error('Failed to create collector dispatch offer');
  }
  return offer;
};

const dispatchEntityInternal = async (
  entityType: DispatchEntityType,
  entityId: string,
  opts?: {
    residentNotice?: string;
    collectorOfferMessage?: string;
    residentArea?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    markPickupApproved?: boolean;
    maxCollectors?: number;
    priority?: 'normal' | 'high' | 'emergency';
  }
): Promise<DispatchResult> => {
  const txResult: DispatchResult = await withTransaction(
    async (client): Promise<DispatchResult> => {
      if (entityType === 'pickup') {
        const pickupRes = await client.query<{
          id: string;
          user_id: string;
          status: string;
          waste_type: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          resident_area: string | null;
        }>(
          `
          SELECT
            pr.id,
            pr.user_id,
            pr.status,
            pr.waste_type,
            pr.address,
            pr.latitude::float8 AS latitude,
            pr.longitude::float8 AS longitude,
            u.area AS resident_area
          FROM pickup_requests pr
          JOIN users u ON u.id = pr.user_id
          WHERE pr.id = $1
          LIMIT 1
          FOR UPDATE
        `,
          [entityId]
        );

        const pickup = pickupRes.rows[0];
        if (!pickup) {
          return {
            dispatched: false,
            offerId: null,
            collectorId: null,
            collectorName: null,
            residentId: null,
            reason: 'pickup_not_found',
          } satisfies DispatchResult;
        }

        if (!PICKUP_DISPATCHABLE_STATUSES.has(pickup.status)) {
          return {
            dispatched: false,
            offerId: null,
            collectorId: null,
            collectorName: null,
            residentId: pickup.user_id,
            reason: `pickup_status_${pickup.status}`,
          } satisfies DispatchResult;
        }

        const activeAssignmentRes = await client.query<{ id: string }>(
          `
          SELECT id
          FROM collector_assignments
          WHERE pickup_request_id = $1
            AND status IN ('assigned', 'in_progress')
          LIMIT 1
        `,
          [pickup.id]
        );

        if (activeAssignmentRes.rows[0]) {
          await expireOtherPendingOffersTx(client, {
            entityType: 'pickup',
            entityId: pickup.id,
          });
          return {
            dispatched: false,
            offerId: null,
            collectorId: null,
            collectorName: null,
            residentId: pickup.user_id,
            reason: 'pickup_already_assigned',
          } satisfies DispatchResult;
        }

        if (opts?.markPickupApproved && pickup.status !== 'approved') {
          await client.query(
            `
            UPDATE pickup_requests
            SET status = 'approved'
            WHERE id = $1
          `,
            [pickup.id]
          );
        }

        const pickupLatitude = opts?.latitude ?? pickup.latitude;
        const pickupLongitude = opts?.longitude ?? pickup.longitude;
        if (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) {
          await insertNotificationTx(
            client,
            pickup.user_id,
            'Pickup location coordinates are missing. Please update location to continue auto-dispatch.'
          );
          return {
            dispatched: false,
            offerId: null,
            collectorId: null,
            collectorName: null,
            residentId: pickup.user_id,
            reason: 'pickup_coordinates_missing',
          } satisfies DispatchResult;
        }

        const requestedMaxCollectors = Math.max(1, Math.floor(opts?.maxCollectors ?? 1));
        const candidates = await findCollectorCandidatesTx(client, {
          entityType: 'pickup',
          entityId: pickup.id,
          latitude: pickupLatitude,
          longitude: pickupLongitude,
          residentArea: opts?.residentArea ?? pickup.resident_area,
          limit: requestedMaxCollectors,
        });
        const candidate = candidates[0];

        if (!candidate) {
          return {
            dispatched: false,
            offerId: null,
            collectorId: null,
            collectorName: null,
            residentId: pickup.user_id,
            reason: 'no_collector_candidate',
          } satisfies DispatchResult;
        }

        const createdOffers: Array<{
          offerId: string;
          collectorId: string;
          collectorName: string;
        }> = [];

        for (const candidateEntry of candidates) {
          const offer = await createDispatchOfferTx(client, {
            entityType: 'pickup',
            entityId: pickup.id,
            collectorId: candidateEntry.collectorId,
            residentId: pickup.user_id,
            distanceKm: candidateEntry.distanceKm,
            score: candidateEntry.score,
          });

          await insertNotificationTx(
            client,
            candidateEntry.collectorId,
            opts?.collectorOfferMessage ??
              `New pickup request nearby (${pickup.waste_type}). Accept or reject from your dashboard.`
          );

          createdOffers.push({
            offerId: offer.id,
            collectorId: candidateEntry.collectorId,
            collectorName: candidateEntry.collectorName,
          });
        }

        if (opts?.residentNotice) {
          await insertNotificationTx(client, pickup.user_id, opts.residentNotice);
        }

        return {
          dispatched: true,
          offerId: createdOffers[0]?.offerId ?? null,
          collectorId: createdOffers[0]?.collectorId ?? null,
          collectorName: createdOffers[0]?.collectorName ?? null,
          residentId: pickup.user_id,
          reason:
            createdOffers.length > 1 ? `offers_created_${createdOffers.length}` : 'offer_created',
          offers: createdOffers,
        } satisfies DispatchResult;
      }

      const reportRes = await client.query<{
        id: string;
        user_id: string;
        status: string;
        report_type: string | null;
        location_text: string | null;
        priority: 'normal' | 'high' | 'emergency';
        latitude: number | null;
        longitude: number | null;
        resident_area: string | null;
      }>(
        `
        SELECT
          wr.id,
          wr.user_id,
          wr.status,
          wr.report_type,
          wr.location_text,
          wr.priority,
          wr.latitude::float8 AS latitude,
          wr.longitude::float8 AS longitude,
          u.area AS resident_area
        FROM waste_reports wr
        JOIN users u ON u.id = wr.user_id
        WHERE wr.id = $1
        LIMIT 1
        FOR UPDATE
      `,
        [entityId]
      );

      const report = reportRes.rows[0];
      if (!report) {
        return {
          dispatched: false,
          offerId: null,
          collectorId: null,
          collectorName: null,
          residentId: null,
          reason: 'report_not_found',
        } satisfies DispatchResult;
      }

      if (!REPORT_DISPATCHABLE_STATUSES.has(report.status)) {
        return {
          dispatched: false,
          offerId: null,
          collectorId: null,
          collectorName: null,
          residentId: report.user_id,
          reason: `report_status_${report.status}`,
        } satisfies DispatchResult;
      }

      const requestedMaxCollectors = Math.max(1, Math.floor(opts?.maxCollectors ?? 1));
      const reportLatitude = opts?.latitude ?? report.latitude;
      const reportLongitude = opts?.longitude ?? report.longitude;
      if (!Number.isFinite(reportLatitude) || !Number.isFinite(reportLongitude)) {
        await insertNotificationTx(
          client,
          report.user_id,
          'Report location coordinates are missing. Please update location to continue auto-dispatch.'
        );
        return {
          dispatched: false,
          offerId: null,
          collectorId: null,
          collectorName: null,
          residentId: report.user_id,
          reason: 'report_coordinates_missing',
        } satisfies DispatchResult;
      }

      const candidates = await findCollectorCandidatesTx(client, {
        entityType: 'report',
        entityId: report.id,
        latitude: reportLatitude,
        longitude: reportLongitude,
        residentArea: opts?.residentArea ?? report.resident_area,
        limit: requestedMaxCollectors,
      });
      const candidate = candidates[0];

      if (!candidate) {
        return {
          dispatched: false,
          offerId: null,
          collectorId: null,
          collectorName: null,
          residentId: report.user_id,
          reason: 'no_collector_candidate',
        } satisfies DispatchResult;
      }

      const createdOffers: Array<{
        offerId: string;
        collectorId: string;
        collectorName: string;
      }> = [];

        const reportPriority = opts?.priority ?? report.priority;

        for (const candidateEntry of candidates) {
          const offer = await createDispatchOfferTx(client, {
            entityType: 'report',
            entityId: report.id,
            collectorId: candidateEntry.collectorId,
            residentId: report.user_id,
            distanceKm: candidateEntry.distanceKm,
            score: candidateEntry.score,
          });

          await insertNotificationTx(
            client,
            candidateEntry.collectorId,
            opts?.collectorOfferMessage ??
              `${reportPriority === 'emergency' ? 'EMERGENCY: ' : reportPriority === 'high' ? 'HIGH PRIORITY: ' : ''}New waste report nearby (${report.report_type ?? 'issue'}). Accept or reject from your dashboard.`
          );

          if (reportPriority === 'emergency') {
            await insertNotificationTx(
              client,
              candidateEntry.collectorId,
              'This report is flagged as an emergency. Please respond urgently if you are nearby.'
            );
          }

          createdOffers.push({
          offerId: offer.id,
          collectorId: candidateEntry.collectorId,
          collectorName: candidateEntry.collectorName,
        });
      }

      if (opts?.residentNotice) {
        await insertNotificationTx(client, report.user_id, opts.residentNotice);
      }

      return {
        dispatched: true,
        offerId: createdOffers[0]?.offerId ?? null,
        collectorId: createdOffers[0]?.collectorId ?? null,
        collectorName: createdOffers[0]?.collectorName ?? null,
        residentId: report.user_id,
        reason:
          createdOffers.length > 1 ? `offers_created_${createdOffers.length}` : 'offer_created',
        offers: createdOffers,
      } satisfies DispatchResult;
    }
  );

  const createdOffers =
    txResult.offers ??
    (txResult.dispatched && txResult.offerId && txResult.collectorId
      ? [
          {
            offerId: txResult.offerId,
            collectorId: txResult.collectorId,
            collectorName: txResult.collectorName ?? 'Collector',
          },
        ]
      : []);

  if (txResult.dispatched && createdOffers.length > 0) {
    for (const createdOffer of createdOffers) {
      publishRealtimeEvent({
        type: 'collector.offer.created',
        payload: {
          offer_id: createdOffer.offerId,
          entity_type: entityType,
          entity_id: entityId,
        },
        roles: ['admin'],
        userIds: [createdOffer.collectorId, ...(txResult.residentId ? [txResult.residentId] : [])],
      });

      void dispatchNotificationCreated({
        userIds: [createdOffer.collectorId],
        message:
          entityType === 'pickup'
            ? 'New pickup request nearby. Open dashboard to accept or reject.'
            : 'New waste report nearby. Open dashboard to accept or reject.',
        source: 'collector.offer.created',
        data: {
          offer_id: createdOffer.offerId,
          entity_type: entityType,
          entity_id: entityId,
        },
      });
    }

    if (txResult.residentId) {
      const residentMessage =
        entityType === 'pickup'
          ? 'We are matching your pickup request with the nearest available collector.'
          : createdOffers.length > 1
            ? 'We are matching your report with nearby collectors.'
            : 'We are matching your report with the nearest available collector.';
      void dispatchNotificationCreated({
        userIds: [txResult.residentId],
        message: residentMessage,
        source: 'collector.matching.started',
        data: {
          entity_type: entityType,
          entity_id: entityId,
        },
      });
    }
  }

  return txResult;
};

export const dispatchPickupToNextCollector = async (
  pickupRequestId: string,
  opts?: {
    residentNotice?: string;
    collectorOfferMessage?: string;
    residentArea?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    maxCollectors?: number;
  }
): Promise<DispatchResult> => {
  const maxCollectors = opts?.maxCollectors
    ? Math.max(1, Math.min(3, Math.floor(opts.maxCollectors)))
    : undefined;
  return dispatchEntityInternal('pickup', pickupRequestId, {
    ...opts,
    maxCollectors,
    markPickupApproved: true,
  });
};

export const dispatchReportToNextCollector = async (
  reportId: string,
  opts?: {
    residentNotice?: string;
    collectorOfferMessage?: string;
    residentArea?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<DispatchResult> => {
  return dispatchEntityInternal('report', reportId, opts);
};

export const dispatchReportToNearestCollectors = async (
  reportId: string,
  opts?: {
    residentNotice?: string;
    collectorOfferMessage?: string;
    residentArea?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    maxCollectors?: number;
    priority?: 'normal' | 'high' | 'emergency';
  }
): Promise<DispatchResult> => {
  const maxCollectors = Math.max(1, Math.min(3, Math.floor(opts?.maxCollectors ?? 3)));
  return dispatchEntityInternal('report', reportId, {
    ...opts,
    maxCollectors,
  });
};

export const processTimedOutDispatchOffers = async (input?: {
  collectorId?: string;
  offerId?: string;
}): Promise<number> => {
  const entitiesToRedispatch = await withTransaction(async (client) => {
    return expireTimedOutOffersTx(client, input);
  });

  if (entitiesToRedispatch.length === 0) {
    return 0;
  }

  for (const entity of entitiesToRedispatch) {
    const pendingRes = await query<{ id: string }>(
      `
        SELECT id
        FROM collector_dispatch_offers
        WHERE entity_type = $1
          AND entity_id = $2
          AND status = 'pending'
        LIMIT 1
      `,
      [entity.entity_type, entity.entity_id]
    );
    if (pendingRes.rows[0]) {
      continue;
    }

    if (entity.entity_type === 'pickup') {
      await dispatchPickupToNextCollector(entity.entity_id, {
        residentNotice: 'Collector response timed out. We are matching another nearby collector.',
      });
      continue;
    }

    await dispatchReportToNextCollector(entity.entity_id, {
      residentNotice: 'Collector response timed out. We are matching another nearby collector.',
    });
  }

  return entitiesToRedispatch.length;
};

export const listCollectorPendingOffers = async (
  collectorId: string
): Promise<CollectorPendingOfferRow[]> => {
  await processTimedOutDispatchOffers({ collectorId });

  const result = await query<CollectorPendingOfferRow>(
    `
      WITH offers_enriched AS (
        SELECT
          o.*,
          CASE
            WHEN o.entity_type = 'pickup' THEN
              CASE
                WHEN pr.scheduled_date IS NULL THEN ${PICKUP_DISPATCH_WINDOW_STANDARD_SECONDS}
                WHEN pr.scheduled_date <= now() + interval '90 minutes' THEN ${PICKUP_DISPATCH_WINDOW_CRITICAL_SECONDS}
                WHEN pr.scheduled_date <= now() + interval '6 hours' THEN ${PICKUP_DISPATCH_WINDOW_SOON_SECONDS}
                WHEN pr.scheduled_date <= now() + interval '24 hours' THEN ${PICKUP_DISPATCH_WINDOW_STANDARD_SECONDS}
                ELSE ${PICKUP_DISPATCH_WINDOW_RELAXED_SECONDS}
              END
            ELSE ${DEFAULT_DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS}
          END::int AS response_window_seconds
        FROM collector_dispatch_offers o
        LEFT JOIN pickup_requests pr ON o.entity_type = 'pickup' AND pr.id = o.entity_id
      )
      SELECT
        o.id,
        o.entity_type,
        o.entity_id,
        o.status,
        o.offered_at,
        o.response_window_seconds,
        o.offered_at + make_interval(secs => o.response_window_seconds) AS expires_at,
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM ((o.offered_at + make_interval(secs => o.response_window_seconds)) - now())))
        )::int AS seconds_remaining,
        o.distance_km::float8 AS distance_km,
        o.score::float8 AS score,
        o.resident_id,
        resident.name AS resident_name,
        resident.phone AS resident_phone,
        resident.area AS resident_area,
        pr.waste_type,
        wr.report_type,
        pr.address,
        wr.location_text,
        CASE WHEN o.entity_type = 'pickup' THEN pr.latitude::float8 ELSE wr.latitude::float8 END AS latitude,
        CASE WHEN o.entity_type = 'pickup' THEN pr.longitude::float8 ELSE wr.longitude::float8 END AS longitude,
        pr.scheduled_date,
        wr.created_at AS report_created_at
      FROM offers_enriched o
      JOIN users resident ON resident.id = o.resident_id
      LEFT JOIN pickup_requests pr ON o.entity_type = 'pickup' AND pr.id = o.entity_id
      LEFT JOIN waste_reports wr ON o.entity_type = 'report' AND wr.id = o.entity_id
      WHERE o.collector_id = $1
        AND o.status = 'pending'
        AND o.offered_at > now() - make_interval(secs => o.response_window_seconds)
      ORDER BY o.offered_at DESC
      LIMIT 100
    `,
    [collectorId]
  );

  return result.rows;
};

const hasPendingOffersForEntity = async (
  entityType: DispatchEntityType,
  entityId: string
): Promise<boolean> => {
  const pendingRes = await query<{ id: string }>(
    `
      SELECT id
      FROM collector_dispatch_offers
      WHERE entity_type = $1
        AND entity_id = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [entityType, entityId]
  );
  return Boolean(pendingRes.rows[0]);
};

export const respondCollectorOffer = async (input: {
  collectorId: string;
  offerId: string;
  action: 'accept' | 'reject';
  rejectionReason?: string;
}): Promise<CollectorOfferResponse> => {
  await processTimedOutDispatchOffers({ collectorId: input.collectorId, offerId: input.offerId });

  const tx = await withTransaction(async (client): Promise<OfferResponseTxResult> => {
    const offerRes = await client.query<DispatchOffer>(
      `
        SELECT
          id,
          entity_type,
          entity_id,
          collector_id,
          resident_id,
          status,
          distance_km::float8 AS distance_km,
          score::float8 AS score,
          offered_at,
          responded_at,
          rejection_reason
        FROM collector_dispatch_offers
        WHERE id = $1
          AND collector_id = $2
        LIMIT 1
        FOR UPDATE
      `,
      [input.offerId, input.collectorId]
    );

    const offer = offerRes.rows[0];
    if (!offer) {
      throw new HttpError('Dispatch offer not found', 404);
    }

    if (offer.status !== 'pending') {
      throw new HttpError('Dispatch offer already resolved', 409);
    }

    const responseWindowSeconds = await getOfferResponseWindowSecondsTx(client, {
      entityType: offer.entity_type,
      entityId: offer.entity_id,
    });

    if (getDispatchOfferRemainingSeconds(offer.offered_at, responseWindowSeconds) <= 0) {
      await expireTimedOutOffersTx(client, {
        collectorId: input.collectorId,
        offerId: input.offerId,
      });
      return {
        action: 'expired',
        entityType: offer.entity_type,
        entityId: offer.entity_id,
        residentId: offer.resident_id,
        assignmentId: null,
      };
    }

    if (input.action === 'reject') {
      await client.query(
        `
          UPDATE collector_dispatch_offers
          SET status = 'rejected',
              responded_at = now(),
              rejection_reason = $3
          WHERE id = $1
            AND collector_id = $2
            AND status = 'pending'
        `,
        [input.offerId, input.collectorId, input.rejectionReason?.trim() || 'Collector rejected']
      );

      const pendingOffersRes = await client.query<{ id: string }>(
        `
          SELECT id
          FROM collector_dispatch_offers
          WHERE entity_type = $1
            AND entity_id = $2
            AND status = 'pending'
          LIMIT 1
        `,
        [offer.entity_type, offer.entity_id]
      );
      const hasPendingOffers = Boolean(pendingOffersRes.rows[0]);

      await insertNotificationTx(
        client,
        offer.resident_id,
        hasPendingOffers
          ? offer.entity_type === 'pickup'
            ? 'A collector declined your pickup request. Other nearby collectors are still reviewing it.'
            : 'A collector declined your report task. Other nearby collectors are still reviewing it.'
          : offer.entity_type === 'pickup'
            ? 'A collector declined your pickup request. We are matching another nearby collector.'
            : 'A collector declined your report task. We are matching another nearby collector.'
      );

      return {
        action: 'rejected' as const,
        entityType: offer.entity_type,
        entityId: offer.entity_id,
        residentId: offer.resident_id,
        assignmentId: null,
        hasPendingOffers,
      };
    }

    if (offer.entity_type === 'pickup') {
      const pickupRes = await client.query<{ status: string; user_id: string }>(
        `
          SELECT status, user_id
          FROM pickup_requests
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [offer.entity_id]
      );
      const pickup = pickupRes.rows[0];
      if (!pickup) {
        await client.query(
          `
            UPDATE collector_dispatch_offers
            SET status = 'expired',
                responded_at = now(),
                rejection_reason = 'pickup_not_found'
            WHERE id = $1
          `,
          [offer.id]
        );
        throw new HttpError('Pickup request not found', 404);
      }

      if (!PICKUP_DISPATCHABLE_STATUSES.has(pickup.status)) {
        await client.query(
          `
            UPDATE collector_dispatch_offers
            SET status = 'expired',
                responded_at = now(),
                rejection_reason = 'pickup_not_dispatchable'
            WHERE id = $1
          `,
          [offer.id]
        );
        throw new HttpError('Pickup request is no longer available', 409);
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
        [offer.entity_id]
      );

      if (activeAssignmentRes.rows[0]) {
        await client.query(
          `
            UPDATE collector_dispatch_offers
            SET status = 'expired',
                responded_at = now(),
                rejection_reason = 'already_assigned'
            WHERE id = $1
          `,
          [offer.id]
        );
        throw new HttpError('Pickup already assigned to another collector', 409);
      }

      let createdAssignmentId: string | null = null;
      try {
        const assignmentRes = await client.query<{ id: string }>(
          `
            INSERT INTO collector_assignments (collector_id, pickup_request_id, status)
            VALUES ($1, $2, 'assigned')
            RETURNING id
          `,
          [input.collectorId, offer.entity_id]
        );
        createdAssignmentId = assignmentRes.rows[0]?.id ?? null;
      } catch (err) {
        if (isPgErrorWithCode(err) && err.code === '23505') {
          throw new HttpError('Pickup already assigned to another collector', 409);
        }
        throw err;
      }

      await client.query(
        `
          UPDATE pickup_requests
          SET status = 'assigned'
          WHERE id = $1
        `,
        [offer.entity_id]
      );

      await client.query(
        `
          UPDATE collector_dispatch_offers
          SET status = 'accepted',
              responded_at = now(),
              rejection_reason = NULL
          WHERE id = $1
            AND collector_id = $2
            AND status = 'pending'
        `,
        [input.offerId, input.collectorId]
      );

      await expireOtherPendingOffersTx(client, {
        entityType: 'pickup',
        entityId: offer.entity_id,
        exceptOfferId: offer.id,
      });

      await insertNotificationTx(
        client,
        pickup.user_id,
        'A collector has accepted your pickup request. You can now track the route.'
      );

      return {
        action: 'accepted' as const,
        entityType: 'pickup' as const,
        entityId: offer.entity_id,
        residentId: pickup.user_id,
        assignmentId: createdAssignmentId,
      };
    }

    const reportRes = await client.query<{
      user_id: string;
      status: string;
      assigned_collector_id: string | null;
    }>(
      `
        SELECT user_id, status, assigned_collector_id
        FROM waste_reports
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [offer.entity_id]
    );
    const report = reportRes.rows[0];
    if (!report) {
      await client.query(
        `
          UPDATE collector_dispatch_offers
          SET status = 'expired',
              responded_at = now(),
              rejection_reason = 'report_not_found'
          WHERE id = $1
        `,
        [offer.id]
      );
      throw new HttpError('Report not found', 404);
    }

    if (!REPORT_DISPATCHABLE_STATUSES.has(report.status)) {
      await client.query(
        `
          UPDATE collector_dispatch_offers
          SET status = 'expired',
              responded_at = now(),
              rejection_reason = 'report_not_dispatchable'
          WHERE id = $1
        `,
        [offer.id]
      );
      throw new HttpError('Report is no longer available', 409);
    }

    await client.query(
      `
        UPDATE waste_reports
        SET assigned_collector_id = $2,
            assigned_at = now(),
            status = 'assigned'
        WHERE id = $1
      `,
      [offer.entity_id, input.collectorId]
    );

    await client.query(
      `
        UPDATE collector_dispatch_offers
        SET status = 'accepted',
            responded_at = now(),
            rejection_reason = NULL
        WHERE id = $1
          AND collector_id = $2
          AND status = 'pending'
      `,
      [input.offerId, input.collectorId]
    );

    await expireOtherPendingOffersTx(client, {
      entityType: 'report',
      entityId: offer.entity_id,
      exceptOfferId: offer.id,
    });

    await insertNotificationTx(
      client,
      report.user_id,
      'A collector has accepted your report task and is preparing cleanup.'
    );

    return {
      action: 'accepted' as const,
      entityType: 'report' as const,
      entityId: offer.entity_id,
      residentId: report.user_id,
      assignmentId: null,
    };
  });

  if (tx.action === 'expired') {
    const hasPendingOffers = await hasPendingOffersForEntity(tx.entityType, tx.entityId);

    if (tx.residentId) {
      void dispatchNotificationCreated({
        userIds: [tx.residentId],
        message: hasPendingOffers
          ? tx.entityType === 'pickup'
            ? 'A collector did not respond in time. Other nearby collectors are still reviewing your pickup request.'
            : 'A collector did not respond in time. Other nearby collectors are still reviewing your report.'
          : tx.entityType === 'pickup'
            ? 'A collector did not respond in time. We are matching another nearby collector.'
            : 'A collector did not respond in time. We are matching another nearby collector.',
        source: 'collector.offer.expired',
        data: {
          entity_type: tx.entityType,
          entity_id: tx.entityId,
        },
      });
    }

    if (!hasPendingOffers) {
      if (tx.entityType === 'pickup') {
        await dispatchPickupToNextCollector(tx.entityId, {
          residentNotice: 'Collector response timed out. We are matching another nearby collector.',
        });
      } else {
        await dispatchReportToNextCollector(tx.entityId, {
          residentNotice: 'Collector response timed out. We are matching another nearby collector.',
        });
      }
    }

    throw new HttpError(
      hasPendingOffers
        ? 'Dispatch offer expired. Other collectors are still reviewing this request.'
        : 'Dispatch offer expired. This request has been reassigned.',
      409
    );
  }

  publishRealtimeEvent({
    type: 'collector.offer.responded',
    payload: {
      offer_id: input.offerId,
      action: tx.action,
      entity_type: tx.entityType,
      entity_id: tx.entityId,
    },
    roles: ['admin'],
    userIds: [input.collectorId, ...(tx.residentId ? [tx.residentId] : [])],
  });

  if (tx.action === 'accepted') {
    if (tx.entityType === 'pickup') {
      publishRealtimeEvent({
        type: 'pickup.updated',
        payload: {
          pickup_id: tx.entityId,
          status: 'assigned',
        },
        roles: ['admin'],
        userIds: [input.collectorId, ...(tx.residentId ? [tx.residentId] : [])],
      });
      publishRealtimeEvent({
        type: 'assignment.updated',
        payload: {
          assignment_id: tx.assignmentId,
          pickup_request_id: tx.entityId,
          collector_id: input.collectorId,
          status: 'assigned',
        },
        roles: ['admin'],
        userIds: [input.collectorId, ...(tx.residentId ? [tx.residentId] : [])],
      });
    } else {
      publishRealtimeEvent({
        type: 'report.updated',
        payload: {
          report_id: tx.entityId,
          status: 'assigned',
          assigned_collector_id: input.collectorId,
        },
        roles: ['admin'],
        userIds: [input.collectorId, ...(tx.residentId ? [tx.residentId] : [])],
      });
    }

    if (tx.residentId) {
      void dispatchNotificationCreated({
        userIds: [tx.residentId],
        message:
          tx.entityType === 'pickup'
            ? 'A collector has accepted your pickup request. Open map to track.'
            : 'A collector has accepted your report task. Open map to track.',
        source: 'collector.offer.accepted',
        path: tx.entityType === 'pickup' ? '/pickup/tracking' : '/(tabs)/map',
        data: {
          entity_type: tx.entityType,
          entity_id: tx.entityId,
        },
      });
    }

    return {
      action: 'accepted',
      entity_type: tx.entityType,
      entity_id: tx.entityId,
      assignment_id: tx.assignmentId,
    };
  }

  const hasPendingOffersAfterRejection =
    tx.hasPendingOffers ?? (await hasPendingOffersForEntity(tx.entityType, tx.entityId));

  if (tx.residentId) {
    void dispatchNotificationCreated({
      userIds: [tx.residentId],
      message: hasPendingOffersAfterRejection
        ? tx.entityType === 'pickup'
          ? 'A collector declined your pickup request. Other nearby collectors are still reviewing it.'
          : 'A collector declined your report task. Other nearby collectors are still reviewing it.'
        : tx.entityType === 'pickup'
          ? 'A collector declined your pickup request. We are matching another nearby collector.'
          : 'A collector declined your report task. We are matching another nearby collector.',
      source: 'collector.offer.rejected',
      data: {
        entity_type: tx.entityType,
        entity_id: tx.entityId,
      },
    });
  }

  if (!hasPendingOffersAfterRejection) {
    if (tx.entityType === 'pickup') {
      await dispatchPickupToNextCollector(tx.entityId, {
        residentNotice: 'We are matching your pickup request with another nearby collector.',
      });
    } else {
      await dispatchReportToNextCollector(tx.entityId, {
        residentNotice: 'We are matching your report with another nearby collector.',
      });
    }
  }

  return {
    action: 'rejected',
    entity_type: tx.entityType,
    entity_id: tx.entityId,
    assignment_id: null,
  };
};
