import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { userApi, type AdminStats } from '@/api/userApi';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';

const INITIAL_STATS: AdminStats = {
  totalUsers: 0,
  totalWasteReports: 0,
  pendingPickupRequests: 0,
  overduePickups: 0,
  completedPickups: 0,
  activeCollectors: 0,
  avgHoursToAssign: null,
  avgHoursToStart: null,
  avgHoursToComplete: null,
  collectorCompleted: 0,
  collectorAvgHoursPerJob: null,
  collectorCancellations: 0
};

const formatHours = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '-';
  return `${Math.round(value * 10) / 10}h`;
};

type AdminOperationsCockpitProps = {
  title?: string;
  subtitle?: string;
};

export default function AdminOperationsCockpit({
  title = 'Operations Cockpit',
  subtitle = 'Live queue health and collector execution metrics'
}: AdminOperationsCockpitProps) {
  const [stats, setStats] = useState<AdminStats>(INITIAL_STATS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await userApi.getAdminStats();
      setStats(next);
    } catch {
      // Keep stale stats when request fails.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useAdminRealtimeRefresh(() => void loadStats());

  return (
    <section className="card-solid border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
        <span className={`text-xs ${isLoading ? 'text-slate-500' : 'text-emerald-700'}`}>
          {isLoading ? 'Refreshing...' : 'Live metrics'}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Queue health</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
            <Link to="/admin/pickups?pickupStatus=pending" className="rounded-lg border border-amber-200 bg-white p-2">
              <div className="text-slate-500">Pending pickups</div>
              <div className="mt-1 text-base font-semibold text-amber-900">{stats.pendingPickupRequests}</div>
            </Link>
            <Link to="/admin/pickups?pickupStatus=overdue" className="rounded-lg border border-amber-200 bg-white p-2">
              <div className="text-slate-500">Overdue pickups</div>
              <div className="mt-1 text-base font-semibold text-rose-700">{stats.overduePickups}</div>
            </Link>
            <Link to="/admin/reports" className="rounded-lg border border-amber-200 bg-white p-2">
              <div className="text-slate-500">Waste reports</div>
              <div className="mt-1 text-base font-semibold text-sky-900">{stats.totalWasteReports}</div>
            </Link>
            <Link to="/admin/pickups?pickupStatus=completed" className="rounded-lg border border-amber-200 bg-white p-2">
              <div className="text-slate-500">Completed pickups</div>
              <div className="mt-1 text-base font-semibold text-emerald-700">{stats.completedPickups}</div>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-900">Collector utilization</div>
            <Link to="/admin/assignments" className="text-xs font-semibold text-brand-700 hover:underline">
              Drill down
            </Link>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
            <Link to="/admin/assignments" className="rounded-lg border border-sky-200 bg-white p-2">
              <div className="text-slate-500">Active</div>
              <div className="mt-1 text-base font-semibold text-sky-900">{stats.activeCollectors}</div>
            </Link>
            <Link to="/admin/assignments" className="rounded-lg border border-sky-200 bg-white p-2">
              <div className="text-slate-500">Jobs done</div>
              <div className="mt-1 text-base font-semibold text-sky-900">{stats.collectorCompleted}</div>
            </Link>
            <Link to="/admin/assignments" className="rounded-lg border border-sky-200 bg-white p-2">
              <div className="text-slate-500">Avg/job</div>
              <div className="mt-1 text-base font-semibold text-sky-900">
                {formatHours(stats.collectorAvgHoursPerJob)}
              </div>
            </Link>
            <Link to="/admin/assignments" className="rounded-lg border border-sky-200 bg-white p-2">
              <div className="text-slate-500">Cancellations</div>
              <div className="mt-1 text-base font-semibold text-rose-700">{stats.collectorCancellations}</div>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="text-slate-500">Avg time to assign</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(stats.avgHoursToAssign)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="text-slate-500">Avg time to start</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(stats.avgHoursToStart)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="text-slate-500">Avg time to complete</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(stats.avgHoursToComplete)}</div>
        </div>
      </div>
    </section>
  );
}
