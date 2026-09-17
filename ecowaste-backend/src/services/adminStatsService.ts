import { query } from '../config/db';
import { markOverduePickups } from './pickupLifecycleService';

export type AdminStats = {
  totalUsers: number;
  totalWasteReports: number;
  pendingPickupRequests: number;
  overduePickups: number;
  completedPickups: number;
  activeCollectors: number;
  avgHoursToAssign: number | null;
  avgHoursToStart: number | null;
  avgHoursToComplete: number | null;
  pendingPayments: number;
  overduePayments48h: number;
  collectorCompleted: number;
  collectorAvgHoursPerJob: number | null;
  collectorCancellations: number;
};

type CountRow = { count: number };

const getCount = async (sql: string, params?: unknown[]): Promise<number> => {
  const res = await query<CountRow>(sql, params);
  return res.rows[0]?.count ?? 0;
};

const getNumber = async (sql: string, params?: unknown[]): Promise<number | null> => {
  const res = await query<{ value: number | null }>(sql, params);
  return res.rows[0]?.value ?? null;
};

const refreshMaterialized = async (): Promise<void> => {
  // Using non-concurrent refresh to avoid requiring unique indexes on views.
  await query(`REFRESH MATERIALIZED VIEW mv_pickup_sla`);
  await query(`REFRESH MATERIALIZED VIEW mv_collector_perf`);
  await query(`REFRESH MATERIALIZED VIEW mv_neighborhoods`);
};

export const getAdminStats = async (): Promise<AdminStats> => {
  await markOverduePickups();
  await refreshMaterialized();

  const [
    totalUsers,
    totalWasteReports,
    pendingPickupRequests,
    overduePickups,
    completedPickups,
    activeCollectors,
  ] = await Promise.all([
    getCount('SELECT count(*)::int AS count FROM users'),
    getCount('SELECT count(*)::int AS count FROM waste_reports'),
    getCount(
      `SELECT count(*)::int AS count
         FROM pickup_requests
         WHERE status IN ('pending', 'approved')`
    ),
    getCount(`SELECT count(*)::int AS count FROM pickup_requests WHERE status = 'overdue'`),
    getCount(`SELECT count(*)::int AS count FROM pickup_requests WHERE status = 'completed'`),
    getCount(
      `SELECT count(*)::int AS count FROM users WHERE role = 'collector' AND is_active = true`
    ),
  ]);

  const [
    avgHoursToAssign,
    avgHoursToStart,
    avgHoursToComplete,
    collectorCompleted,
    collectorAvgHoursPerJob,
    collectorCancellations,
  ] = await Promise.all([
    getNumber(
      `SELECT AVG(hours_to_assign) AS value FROM mv_pickup_sla WHERE hours_to_assign IS NOT NULL`
    ),
    getNumber(
      `SELECT AVG(hours_to_start) AS value FROM mv_pickup_sla WHERE hours_to_start IS NOT NULL`
    ),
    getNumber(
      `SELECT AVG(hours_to_complete) AS value FROM mv_pickup_sla WHERE hours_to_complete IS NOT NULL`
    ),
    getCount(`SELECT COALESCE(SUM(completed_jobs),0)::int AS count FROM mv_collector_perf`),
    getNumber(
      `SELECT AVG(avg_hours_per_job) AS value FROM mv_collector_perf WHERE avg_hours_per_job IS NOT NULL`
    ),
    getCount(`SELECT COALESCE(SUM(cancellations),0)::int AS count FROM mv_collector_perf`),
  ]);

  return {
    totalUsers,
    totalWasteReports,
    pendingPickupRequests,
    overduePickups,
    completedPickups,
    activeCollectors,
    avgHoursToAssign,
    avgHoursToStart,
    avgHoursToComplete,
    pendingPayments: 0,
    overduePayments48h: 0,
    collectorCompleted,
    collectorAvgHoursPerJob,
    collectorCancellations,
  };
};
