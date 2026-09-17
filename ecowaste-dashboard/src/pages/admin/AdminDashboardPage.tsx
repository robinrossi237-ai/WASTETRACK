import { useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@/api/axios';
import { userApi, type AdminStats } from '@/api/userApi';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import { CheckIcon, ClockIcon, ReportIcon, TruckIcon, UsersIcon, XIcon } from '@/components/icons';

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

type StatCardProps = {
  label: string;
  value: string | number;
  icon: ReactNode;
  accentClassName: string;
  iconClassName: string;
  to?: string;
};

const StatCard = ({ label, value, icon, accentClassName, iconClassName, to }: StatCardProps) => {
  const content = (
    <>
      <div className={clsx('absolute inset-x-0 top-0 h-1', accentClassName)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        </div>
        <div className={clsx('grid h-10 w-10 place-items-center rounded-xl ring-1 ring-inset', iconClassName)}>
          {icon}
        </div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="card-solid relative block overflow-hidden p-4 transition hover:-translate-y-0.5">
        {content}
      </Link>
    );
  }
  return <div className="card-solid relative overflow-hidden p-4">{content}</div>;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>(INITIAL_STATS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const hasSlaRisk = stats.overduePickups > 0;
  const queueSummary = useMemo(() => {
    if (stats.pendingPickupRequests === 0 && stats.overduePickups === 0) return 'Queue is healthy';
    if (stats.overduePickups > 0) return `${stats.overduePickups} overdue pickup(s) need attention`;
    return `${stats.pendingPickupRequests} pickup(s) waiting for assignment`;
  }, [stats.overduePickups, stats.pendingPickupRequests]);

  const load = async () => {
    setIsLoading(true);
    try {
      const next = await userApi.getAdminStats();
      setStats(next);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <section className="card-solid overflow-hidden border border-slate-200 p-0">
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Admin Control Center</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">WasteTrack Operations Dashboard</h2>
              <p className="mt-2 text-sm text-white/85">
                Essentials only: live dispatch queue, assignment health, and collector throughput.
              </p>
              <div className={clsx('mt-3 text-sm font-medium', hasSlaRisk ? 'text-amber-200' : 'text-emerald-200')}>
                {queueSummary}
              </div>
              <AdminRefreshPanel isLoading={isLoading} lastRefreshedAt={lastRefreshedAt} onRetryAll={() => void load()} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link to="/admin/pickups" className="btn border-white/30 bg-white/10 py-1.5 text-white hover:bg-white/20">
                Manage pickups
              </Link>
              <Link to="/admin/reports" className="btn border-white/30 bg-white/10 py-1.5 text-white hover:bg-white/20">
                Review reports
              </Link>
              <Link
                to="/admin/assignments"
                className="btn border-white/30 bg-white/10 py-1.5 text-white hover:bg-white/20"
              >
                Open assignments
              </Link>
              <Link to="/admin/map" className="btn border-white/30 bg-white/10 py-1.5 text-white hover:bg-white/20">
                Open live map
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          label="Pending pickups"
          value={stats.pendingPickupRequests}
          icon={<TruckIcon className="h-5 w-5" />}
          accentClassName="bg-gradient-to-r from-amber-500 to-orange-500"
          iconClassName="bg-amber-50 text-amber-700 ring-amber-600/20"
          to="/admin/pickups?pickupStatus=pending"
        />
        <StatCard
          label="Overdue pickups"
          value={stats.overduePickups}
          icon={<XIcon className="h-5 w-5" />}
          accentClassName="bg-gradient-to-r from-rose-500 to-orange-500"
          iconClassName="bg-rose-50 text-rose-700 ring-rose-600/20"
          to="/admin/pickups?pickupStatus=overdue"
        />
        <StatCard
          label="Completed pickups"
          value={stats.completedPickups}
          icon={<CheckIcon className="h-5 w-5" />}
          accentClassName="bg-gradient-to-r from-emerald-500 to-brand-500"
          iconClassName="bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          to="/admin/pickups?pickupStatus=completed"
        />
        <StatCard
          label="Active collectors"
          value={stats.activeCollectors}
          icon={<UsersIcon className="h-5 w-5" />}
          accentClassName="bg-gradient-to-r from-brand-600 to-brand-500"
          iconClassName="bg-brand-50 text-brand-700 ring-brand-600/20"
          to="/admin/assignments"
        />
        <StatCard
          label="Waste reports"
          value={stats.totalWasteReports}
          icon={<ReportIcon className="h-5 w-5" />}
          accentClassName="bg-gradient-to-r from-brand-500 to-emerald-500"
          iconClassName="bg-brand-50 text-brand-700 ring-brand-600/20"
          to="/admin/reports"
        />
        <StatCard
          label="Total users"
          value={stats.totalUsers}
          icon={<UsersIcon className="h-5 w-5" />}
          accentClassName="bg-gradient-to-r from-brand-600 to-brand-400"
          iconClassName="bg-brand-50 text-brand-700 ring-brand-600/20"
          to="/admin/users"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card-solid border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Dispatch Service Levels</h3>
          <p className="mt-1 text-xs text-slate-600">Average processing times from request to completion.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-slate-500">Assign</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatHours(stats.avgHoursToAssign)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-slate-500">Start</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatHours(stats.avgHoursToStart)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-slate-500">Complete</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatHours(stats.avgHoursToComplete)}</div>
            </div>
          </div>
        </div>

        <div className="card-solid border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Collector Performance</h3>
          <p className="mt-1 text-xs text-slate-600">Execution reliability and throughput indicators.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-slate-500">Jobs done</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{stats.collectorCompleted}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-slate-500">Avg/job</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatHours(stats.collectorAvgHoursPerJob)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-slate-500">Cancellations</div>
              <div className="mt-1 text-base font-semibold text-rose-700">{stats.collectorCancellations}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-solid border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClockIcon className="h-4 w-4 text-brand-700" />
            SLA reminder
          </div>
          <Link to="/admin/pickups?pickupStatus=overdue" className="text-xs font-semibold text-brand-700 hover:underline">
            Open overdue queue
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Keep overdue pickups at zero by reassigning quickly from the Pickups and Assignments pages.
        </p>
      </div>
    </div>
  );
}

