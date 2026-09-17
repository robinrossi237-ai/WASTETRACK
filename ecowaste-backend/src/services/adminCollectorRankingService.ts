import { query } from '../config/db';

type CollectorRankingRawRow = {
  collector_id: string;
  collector_name: string;
  collector_email: string;
  collector_phone: string | null;
  collector_area: string | null;
  is_active: boolean;
  last_login_at: string | null;
  pickups_assigned: number;
  pickups_completed: number;
  pickups_cancelled: number;
  pickup_issues: number;
  avg_pickup_completion_hours: number | null;
  reports_cleaned: number;
  report_issues: number;
};

export type CollectorRankingRow = {
  rank: number;
  collector_id: string;
  collector_name: string;
  collector_email: string;
  collector_phone: string | null;
  collector_area: string | null;
  is_active: boolean;
  last_login_at: string | null;
  score: number;
  pickups_assigned: number;
  pickups_completed: number;
  pickup_completion_rate: number;
  avg_pickup_completion_hours: number | null;
  pickup_issues: number;
  pickup_issue_rate: number;
  pickups_cancelled: number;
  pickup_cancellation_rate: number;
  reports_cleaned: number;
  report_issues: number;
  report_issue_rate: number;
  total_actions: number;
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const safeRate = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
};

export const listCollectorRanking = async (input?: {
  includeInactive?: boolean;
}): Promise<CollectorRankingRow[]> => {
  const includeInactive = input?.includeInactive ?? false;
  const params: unknown[] = [];
  const activeFilter = includeInactive ? '' : 'AND u.is_active = true';

  const result = await query<CollectorRankingRawRow>(
    `
      WITH pickup_metrics AS (
        SELECT
          ca.collector_id,
          COUNT(*)::int AS pickups_assigned,
          COUNT(*) FILTER (WHERE ca.status = 'completed')::int AS pickups_completed,
          COUNT(*) FILTER (WHERE ca.status = 'cancelled')::int AS pickups_cancelled,
          COUNT(*) FILTER (WHERE ca.issue_reason IS NOT NULL)::int AS pickup_issues,
          AVG(
            EXTRACT(EPOCH FROM (ca.completed_at - COALESCE(ca.started_at, ca.assigned_at))) / 3600
          ) FILTER (
            WHERE ca.status = 'completed'
              AND ca.completed_at IS NOT NULL
              AND ca.assigned_at IS NOT NULL
          )::float8 AS avg_pickup_completion_hours
        FROM collector_assignments ca
        GROUP BY ca.collector_id
      ),
      report_metrics AS (
        SELECT
          outcomes.collector_id,
          COUNT(*) FILTER (WHERE outcomes.outcome = 'cleaned')::int AS reports_cleaned,
          COUNT(*) FILTER (WHERE outcomes.outcome = 'issue')::int AS report_issues
        FROM (
          SELECT cleaned_by_collector_id AS collector_id, 'cleaned'::text AS outcome
          FROM waste_reports
          WHERE cleaned_by_collector_id IS NOT NULL
          UNION ALL
          SELECT collector_issue_by_id AS collector_id, 'issue'::text AS outcome
          FROM waste_reports
          WHERE collector_issue_by_id IS NOT NULL
        ) outcomes
        GROUP BY outcomes.collector_id
      )
      SELECT
        u.id AS collector_id,
        u.name AS collector_name,
        u.email AS collector_email,
        u.phone AS collector_phone,
        u.area AS collector_area,
        u.is_active,
        u.last_login_at,
        COALESCE(pm.pickups_assigned, 0)::int AS pickups_assigned,
        COALESCE(pm.pickups_completed, 0)::int AS pickups_completed,
        COALESCE(pm.pickups_cancelled, 0)::int AS pickups_cancelled,
        COALESCE(pm.pickup_issues, 0)::int AS pickup_issues,
        pm.avg_pickup_completion_hours::float8 AS avg_pickup_completion_hours,
        COALESCE(rm.reports_cleaned, 0)::int AS reports_cleaned,
        COALESCE(rm.report_issues, 0)::int AS report_issues
      FROM users u
      LEFT JOIN pickup_metrics pm ON pm.collector_id = u.id
      LEFT JOIN report_metrics rm ON rm.collector_id = u.id
      WHERE u.role = 'collector'
        AND u.collector_verification_status = 'approved'
        ${activeFilter}
      ORDER BY u.name ASC
      LIMIT 1000
    `,
    params
  );

  const scored = result.rows.map((row) => {
    const pickupsAssigned = row.pickups_assigned ?? 0;
    const pickupsCompleted = row.pickups_completed ?? 0;
    const pickupsCancelled = row.pickups_cancelled ?? 0;
    const pickupIssues = row.pickup_issues ?? 0;
    const reportsCleaned = row.reports_cleaned ?? 0;
    const reportIssues = row.report_issues ?? 0;

    const pickupCompletionRate = safeRate(pickupsCompleted, pickupsAssigned);
    const pickupIssueRate = safeRate(pickupIssues, pickupsAssigned);
    const pickupCancellationRate = safeRate(pickupsCancelled, pickupsAssigned);

    const reportsHandled = reportsCleaned + reportIssues;
    const reportIssueRate = safeRate(reportIssues, reportsHandled);

    const volumeScore = clamp01(pickupsCompleted / 40);
    const activityScore = clamp01((pickupsCompleted + reportsCleaned) / 60);
    const speedScore =
      row.avg_pickup_completion_hours == null
        ? 0.5
        : clamp01(1 - row.avg_pickup_completion_hours / 8);
    const reportQualityScore = reportsHandled === 0 ? 0.6 : clamp01(1 - reportIssueRate);

    const positiveScore =
      pickupCompletionRate * 0.4 +
      volumeScore * 0.2 +
      speedScore * 0.2 +
      activityScore * 0.1 +
      reportQualityScore * 0.1;

    const penaltyScore =
      pickupIssueRate * 0.5 + pickupCancellationRate * 0.35 + reportIssueRate * 0.15;

    const score = round2(Math.max(0, Math.min(100, (positiveScore - penaltyScore) * 100)));

    const avgPickupCompletionHours =
      row.avg_pickup_completion_hours == null ? null : round2(row.avg_pickup_completion_hours);

    return {
      collector_id: row.collector_id,
      collector_name: row.collector_name,
      collector_email: row.collector_email,
      collector_phone: row.collector_phone,
      collector_area: row.collector_area,
      is_active: row.is_active,
      last_login_at: row.last_login_at,
      score,
      pickups_assigned: pickupsAssigned,
      pickups_completed: pickupsCompleted,
      pickup_completion_rate: round2(pickupCompletionRate * 100),
      avg_pickup_completion_hours: avgPickupCompletionHours,
      pickup_issues: pickupIssues,
      pickup_issue_rate: round2(pickupIssueRate * 100),
      pickups_cancelled: pickupsCancelled,
      pickup_cancellation_rate: round2(pickupCancellationRate * 100),
      reports_cleaned: reportsCleaned,
      report_issues: reportIssues,
      report_issue_rate: round2(reportIssueRate * 100),
      total_actions: pickupsCompleted + reportsCleaned,
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.pickups_completed !== left.pickups_completed) {
      return right.pickups_completed - left.pickups_completed;
    }
    const leftAvg = left.avg_pickup_completion_hours ?? Number.POSITIVE_INFINITY;
    const rightAvg = right.avg_pickup_completion_hours ?? Number.POSITIVE_INFINITY;
    if (leftAvg !== rightAvg) return leftAvg - rightAvg;
    return left.collector_name.localeCompare(right.collector_name);
  });

  return scored.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
};
