import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

import DataTable, { type Column } from '@/components/DataTable';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminPageHeader from '@/components/AdminPageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusBadge from '@/components/StatusBadge';
import StatusChip from '@/components/StatusChip';
import { getApiErrorMessage } from '@/api/axios';
import { userApi, type CollectorApplication, type SubscriptionPlan, type User } from '@/api/userApi';
import { PowerIcon, SearchIcon, TagIcon, TrashIcon, UsersIcon } from '@/components/icons';

const PLAN_OPTIONS: Array<{ value: SubscriptionPlan; label: string; description: string }> = [
  { value: 'free', label: 'Free', description: 'Essentiel – 3 pickups per month' },
  { value: 'plus', label: 'Plus', description: 'Unlimited pickups' },
  { value: 'pro', label: 'Pro', description: 'Unlimited pickups + priority' }
];

const formatRelativeLogin = (value: string | null): string => {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} h ago`;
  return `${Math.floor(diffMs / 86_400_000)} d ago`;
};

const formatAbsoluteLogin = (value: string | null): string => {
  if (!value) return 'No login yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export default function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState<string>('');
  const [applicationStatus, setApplicationStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<User[]>([]);
  const [collectorApplications, setCollectorApplications] = useState<CollectorApplication[]>([]);
  const [applicationCounts, setApplicationCounts] = useState<Record<'pending' | 'approved' | 'rejected', number>>({
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [target, setTarget] = useState<User | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);
  const [rejectingCollectorId, setRejectingCollectorId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [reviewingCollectorId, setReviewingCollectorId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState<boolean>(false);
  const [planModalTarget, setPlanModalTarget] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('free');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<boolean>(false);

  const load = async (override?: { q?: string; applicationStatus?: 'pending' | 'approved' | 'rejected' }) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const qValue = override?.q ?? q;
      const applicationStatusValue = override?.applicationStatus ?? applicationStatus;
      const [users, applications, pendingApps, approvedApps, rejectedApps] = await Promise.all([
        userApi.listUsers({
          q: qValue.trim().length > 0 ? qValue.trim() : undefined
        }),
        userApi.listCollectorApplications({ status: applicationStatusValue }),
        userApi.listCollectorApplications({ status: 'pending' }),
        userApi.listCollectorApplications({ status: 'approved' }),
        userApi.listCollectorApplications({ status: 'rejected' })
      ]);
      setRows(users);
      setCollectorApplications(applications);
      setApplicationCounts({
        pending: pendingApps.length,
        approved: approvedApps.length,
        rejected: rejectedApps.length
      });
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      const message = getApiErrorMessage(err);
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && qParam.trim().length > 0) {
      setQ(qParam);
      void load({ q: qParam, applicationStatus: 'pending' });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: Column<User>[] = useMemo(
    () => [
      { header: 'Name', cell: (u) => <div className="font-semibold text-slate-900">{u.name}</div> },
      { header: 'Email', cell: (u) => <span className="font-mono text-xs text-slate-700">{u.email}</span> },
      { header: 'Role', cell: (u) => <StatusBadge status={u.role} /> },
      {
        header: 'Plan',
        cell: (u) => (
          <StatusChip
            label={u.subscription_plan === 'plus' ? 'Plus' : u.subscription_plan === 'pro' ? 'Pro' : 'Free'}
            tone={u.subscription_plan === 'plus' ? 'info' : u.subscription_plan === 'pro' ? 'success' : 'neutral'}
          />
        )
      },
      { header: 'Area', cell: (u) => u.area ?? '-' },
      {
        header: 'Active',
        cell: (u) => (
          <span className={u.is_active ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
            {u.is_active ? 'Yes' : 'No'}
          </span>
        )
      },
      {
        header: 'Last login',
        cell: (u) => (
          <div className="leading-tight">
            <div className={u.last_login_at ? 'text-slate-800' : 'text-slate-500'}>{formatRelativeLogin(u.last_login_at)}</div>
            <div className="text-[11px] text-slate-500">{formatAbsoluteLogin(u.last_login_at)}</div>
          </div>
        )
      },
      {
        header: 'Actions',
        cell: (u) => (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-outline py-1.5"
              onClick={() => {
                setPlanModalTarget(u);
                setSelectedPlan(u.subscription_plan);
                setPlanModalOpen(true);
              }}
            >
              <TagIcon className="h-4 w-4" />
              Plan
            </button>
            <button
              type="button"
              className="btn btn-outline py-1.5"
              onClick={() => {
                setTarget(u);
                setConfirmOpen(true);
              }}
            >
              <PowerIcon className="h-4 w-4" />
              {u.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              className="btn py-1.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              onClick={() => {
                setDeleteTarget(u);
                setDeleteConfirmOpen(true);
              }}
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
        )
      }
    ],
    []
  );

  const visibleRows = useMemo(() => rows.filter((user) => user.role !== 'admin'), [rows]);
  const activeUsers = useMemo(() => visibleRows.filter((user) => user.is_active).length, [visibleRows]);
  const inactiveUsers = useMemo(() => visibleRows.length - activeUsers, [visibleRows, activeUsers]);
  const pendingCollectorCount = useMemo(
    () =>
      visibleRows.filter(
        (user) => user.role === 'collector' && user.collector_verification_status === 'pending'
      ).length,
    [visibleRows]
  );
  const filteredApplicationCount = collectorApplications.length;
  const activeIn24h = useMemo(
    () =>
      visibleRows.filter((user) => {
        if (!user.last_login_at) return false;
        const ts = new Date(user.last_login_at).getTime();
        return Number.isFinite(ts) && Date.now() - ts <= 86_400_000;
      }).length,
    [visibleRows]
  );

  const resetFilters = () => {
    setQ('');
    setApplicationStatus('pending');
    void load({ q: '', applicationStatus: 'pending' });
  };

  const onConfirm = async () => {
    if (!target) return;
    try {
      await userApi.setActive(target.id, !target.is_active);
      toast.success('Updated user');
      setConfirmOpen(false);
      setTarget(null);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const onConfirmPlan = async () => {
    if (!planModalTarget || !selectedPlan) return;
    setIsUpdatingPlan(true);
    try {
      await userApi.setPlan(planModalTarget.id, selectedPlan);
      toast.success('Plan updated');
      setPlanModalOpen(false);
      setPlanModalTarget(null);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeletingUser(true);
    try {
      const result = await userApi.deleteUser(deleteTarget.id);
      const summary =
        result.redispatchedPickups > 0 || result.redispatchedReports > 0
          ? ` Reassigned ${result.redispatchedPickups} pickup(s), ${result.redispatchedReports} report(s).`
          : '';
      toast.success(`User deleted.${summary}`);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await load({ applicationStatus });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsDeletingUser(false);
    }
  };

  const approveCollector = async (collectorId: string) => {
    setReviewingCollectorId(collectorId);
    try {
      await userApi.reviewCollectorApplication(collectorId, { status: 'approved' });
      toast.success('Collector approved');
      setRejectingCollectorId((current) => (current === collectorId ? null : current));
      setRejectionReason('');
      await load({ applicationStatus });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setReviewingCollectorId(null);
    }
  };

  const rejectCollector = async (collectorId: string) => {
    const reason = rejectionReason.trim();
    if (reason.length < 2) {
      toast.error('Please add a rejection reason');
      return;
    }

    setReviewingCollectorId(collectorId);
    try {
      await userApi.reviewCollectorApplication(collectorId, {
        status: 'rejected',
        rejection_reason: reason
      });
      toast.success('Collector rejected');
      setRejectingCollectorId(null);
      setRejectionReason('');
      await load({ applicationStatus });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setReviewingCollectorId(null);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Users"
        subtitle="Search, filter, and manage platform users."
        icon={<UsersIcon className="h-5 w-5" />}
        tone="brand"
        chips={(
          <>
            <StatusChip label={`Total ${visibleRows.length}`} tone="info" />
            <StatusChip label={`Active ${activeUsers}`} tone="success" />
            <StatusChip label={`Inactive ${inactiveUsers}`} tone={inactiveUsers > 0 ? 'warning' : 'neutral'} />
            <StatusChip label={`Logged in 24h ${activeIn24h}`} tone={activeIn24h > 0 ? 'info' : 'neutral'} />
            <StatusChip
              label={`Collector pending ${pendingCollectorCount}`}
              tone={pendingCollectorCount > 0 ? 'warning' : 'neutral'}
            />
          </>
        )}
        footer={(
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load({ applicationStatus })}
          />
        )}
      />

      <div className="card-solid p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email"
              className="field w-full pl-9 sm:w-64"
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </div>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Collector Applications</h3>
            <p className="text-sm text-slate-600">
              Review collector applications by status and approve/reject pending ones.
            </p>
          </div>
          <StatusChip
            label={
              applicationStatus === 'pending'
                ? `${filteredApplicationCount} pending`
                : applicationStatus === 'approved'
                  ? `${filteredApplicationCount} approved`
                  : `${filteredApplicationCount} rejected`
            }
            tone={
              applicationStatus === 'pending'
                ? (applicationCounts.pending > 0 ? 'warning' : 'neutral')
                : applicationStatus === 'approved'
                  ? 'success'
                  : 'danger'
            }
          />
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {([
            { key: 'pending' as const, label: 'Pending', tone: 'warning' as const },
            { key: 'approved' as const, label: 'Approved', tone: 'success' as const },
            { key: 'rejected' as const, label: 'Rejected', tone: 'danger' as const }
          ]).map((tab) => {
            const isActive = applicationStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => {
                  setApplicationStatus(tab.key);
                  setRejectingCollectorId(null);
                  setRejectionReason('');
                  void load({ applicationStatus: tab.key });
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      tab.tone === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : tab.tone === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {applicationCounts[tab.key]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {collectorApplications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            {applicationStatus === 'pending'
              ? 'No pending collector applications right now.'
              : applicationStatus === 'approved'
                ? 'No approved collector applications found.'
                : 'No rejected collector applications found.'}
          </div>
        ) : (
          <div className="space-y-3">
            {collectorApplications.map((application) => {
              const isRejectOpen = rejectingCollectorId === application.id;
              const isBusy = reviewingCollectorId === application.id;
              const canReview = application.collector_verification_status === 'pending';
              const cardAccentClass =
                application.collector_verification_status === 'approved'
                  ? 'border-emerald-200'
                  : application.collector_verification_status === 'rejected'
                    ? 'border-rose-200'
                    : 'border-amber-200';
              return (
                <div key={application.id} className={`rounded-xl border bg-white p-4 ${cardAccentClass}`}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{application.name}</p>
                      <p className="font-mono text-xs text-slate-700">{application.email}</p>
                      <p className="mt-1 text-xs text-slate-600">Phone: {application.phone || '-'}</p>
                      <p className="text-xs text-slate-600">Area: {application.area || '-'}</p>
                      <div className="mt-2">
                        <StatusBadge status={application.collector_verification_status} />
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 md:text-right">
                      <p>Submitted: {formatDateTime(application.collector_submitted_at ?? application.created_at)}</p>
                      <p>Reviewed: {formatDateTime(application.collector_verified_at)}</p>
                      {application.collector_verification_note ? (
                        <p className="mt-1 text-rose-700">Note: {application.collector_verification_note}</p>
                      ) : null}
                      <p>Application ID: {application.id}</p>
                    </div>
                  </div>

                  {canReview ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary py-1.5 px-3 text-xs"
                        disabled={isBusy}
                        onClick={() => void approveCollector(application.id)}
                      >
                        {isBusy ? 'Working...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline py-1.5 px-3 text-xs"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingCollectorId(application.id);
                          setRejectionReason('');
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}

                  {isRejectOpen && canReview ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-rose-700">
                        Rejection reason
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        className="field min-h-[90px] w-full"
                        placeholder="Explain why this application is rejected"
                      />
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-outline py-1.5 px-3 text-xs"
                          onClick={() => {
                            setRejectingCollectorId(null);
                            setRejectionReason('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary py-1.5 px-3 text-xs"
                          disabled={isBusy}
                          onClick={() => void rejectCollector(application.id)}
                        >
                          {isBusy ? 'Saving...' : 'Confirm rejection'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isLoading && visibleRows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && visibleRows.length === 0 ? (
        <ErrorState
          title="Could not load users"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : visibleRows.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Try changing your search terms."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable columns={columns} rows={visibleRows} isLoading={isLoading} emptyMessage="No users found." />
      )}

      <Modal
        open={confirmOpen}
        title={target?.is_active ? 'Deactivate user?' : 'Activate user?'}
        tone={target?.is_active ? 'danger' : 'success'}
        titleIcon={<PowerIcon className="h-5 w-5" />}
        onClose={() => setConfirmOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void onConfirm()}>
              Confirm
            </button>
          </div>
        }
      >
        <div className="text-sm text-slate-700">
          {target ? (
            <>
              This will {target.is_active ? 'deactivate' : 'activate'}{' '}
              <span className="font-semibold">{target.email}</span>.
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        title="Delete user?"
        tone="danger"
        titleIcon={<TrashIcon className="h-5 w-5" />}
        onClose={() => {
          if (isDeletingUser) return;
          setDeleteConfirmOpen(false);
          setDeleteTarget(null);
        }}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeletingUser}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void onConfirmDelete()}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      >
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            This will permanently delete <span className="font-semibold">{deleteTarget?.email}</span> and remove
            related account data.
          </p>
          <p className="text-xs text-slate-500">
            If this user is a collector, active assignments will be reassigned automatically.
          </p>
        </div>
      </Modal>

      <Modal
        open={planModalOpen}
        title="Change subscription plan?"
        tone="brand"
        titleIcon={<TagIcon className="h-5 w-5" />}
        onClose={() => {
          if (isUpdatingPlan) return;
          setPlanModalOpen(false);
          setPlanModalTarget(null);
        }}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPlanModalOpen(false)}
              disabled={isUpdatingPlan}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onConfirmPlan()}
              disabled={isUpdatingPlan || !planModalTarget || !selectedPlan}
            >
              {isUpdatingPlan ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3 text-sm text-slate-700">
          {planModalTarget ? (
            <p>
              Change plan for <span className="font-semibold">{planModalTarget.email}</span>.
            </p>
          ) : null}
          <div className="space-y-2">
            {PLAN_OPTIONS.map((option) => {
              const isSelected = selectedPlan === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedPlan(option.value)}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.description}</span>
                  </span>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? 'border-emerald-500' : 'border-slate-300'
                    }`}
                  >
                    {isSelected ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
