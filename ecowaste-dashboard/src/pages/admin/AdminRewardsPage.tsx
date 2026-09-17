import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import DataTable, { type Column } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusBadge from '@/components/StatusBadge';
import StatusChip from '@/components/StatusChip';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminPageHeader from '@/components/AdminPageHeader';
import { getApiErrorMessage } from '@/api/axios';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';
import { rewardsApi, type Reward, type RewardReason } from '@/api/rewardsApi';
import { userApi, type User } from '@/api/userApi';
import { ClipboardIcon, GiftIcon, SearchIcon } from '@/components/icons';

export default function AdminRewardsPage() {
  const [rows, setRows] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [open, setOpen] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const [points, setPoints] = useState<number>(10);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<RewardReason | 'all'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const copyToClipboard = useCallback(async (value: string, label = 'ID') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await rewardsApi.listRewards();
      setRows(list);
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
    void load();
  }, []);

  useAdminRealtimeRefresh(() => void load());

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setIsLoadingUsers(true);
      try {
        const list = await userApi.listUsers({ active: true });
        setUsers(list);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setIsLoadingUsers(false);
      }
    })();
  }, [open]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;
      const ts = new Date(r.created_at).getTime();
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        if (!Number.isNaN(fromTs) && ts < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime();
        if (!Number.isNaN(toTs) && ts > toTs + 86_399_000) return false;
      }
      if (!q) return true;
      const haystack = [
        r.id,
        r.user_id,
        r.user_name ?? '',
        r.user_email ?? '',
        r.reason
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, reasonFilter, fromDate, toDate]);

  const totalPoints = useMemo(
    () => rows.reduce((sum, reward) => sum + reward.points, 0),
    [rows]
  );
  const bonusCount = useMemo(
    () => rows.filter((reward) => reward.reason === 'bonus').length,
    [rows]
  );
  const activityCount = useMemo(
    () => rows.length - bonusCount,
    [rows, bonusCount]
  );

  const resetFilters = () => {
    setQuery('');
    setReasonFilter('all');
    setFromDate('');
    setToDate('');
  };

  const columns: Column<Reward>[] = useMemo(
    () => [
      {
        header: 'User',
        cell: (r) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {r.user_name ?? 'Unknown user'}
            </div>
            {r.user_email ? <div className="text-xs text-slate-500">{r.user_email}</div> : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {r.user_role ? <StatusBadge status={r.user_role} /> : null}
              <span className="font-mono">{r.user_id}</span>
              <button
                type="button"
                className="icon-btn h-6 w-6"
                onClick={() => void copyToClipboard(r.user_id, 'User ID')}
                aria-label="Copy user ID"
              >
                <ClipboardIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      },
      { header: 'Points', cell: (r) => <span className="text-base font-semibold text-slate-900">{r.points}</span> },
      { header: 'Reason', cell: (r) => <StatusBadge status={r.reason} /> },
      { header: 'Created', cell: (r) => new Date(r.created_at).toLocaleString() },
      {
        header: 'Actions',
        cell: (r) => {
          const searchValue = r.user_email ?? r.user_id;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/admin/users?q=${encodeURIComponent(searchValue)}`}
                className="btn btn-ghost px-3 py-1 text-xs"
              >
                View user
              </Link>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1 text-xs"
                onClick={() => void copyToClipboard(r.id, 'Reward ID')}
              >
                Copy reward ID
              </button>
            </div>
          );
        }
      }
    ],
    [copyToClipboard]
  );

  const onGrant = async () => {
    try {
      await rewardsApi.grantBonus({ user_id: userId, points, reason: 'bonus' });
      toast.success('Bonus reward granted');
      setOpen(false);
      setUserId('');
      setPoints(10);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Rewards"
        subtitle="Track points activity and grant manual bonus rewards."
        icon={<GiftIcon className="h-5 w-5" />}
        tone="emerald"
        chips={(
          <>
            <StatusChip label={`Entries ${rows.length}`} tone="info" />
            <StatusChip label={`Total points ${totalPoints}`} tone="success" />
            <StatusChip label={`Bonus ${bonusCount}`} tone="warning" />
            <StatusChip label={`Activity ${activityCount}`} tone="neutral" />
          </>
        )}
        actions={(
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <GiftIcon className="h-4 w-4" />
            Grant bonus
          </button>
        )}
        footer={(
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load()}
          />
        )}
      />

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rewards"
              className="field w-full pl-9 sm:w-56"
            />
          </div>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value as RewardReason | 'all')}
            className="select w-full sm:w-48"
          >
            <option value="all">All reasons</option>
            <option value="waste_report">waste_report</option>
            <option value="pickup_participation">pickup_participation</option>
            <option value="cleanup_verified">cleanup_verified</option>
            <option value="bonus">bonus</option>
          </select>
          <input
            type="date"
            className="field w-36"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            className="field w-36"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && rows.length === 0 ? (
        <ErrorState
          title="Could not load rewards"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No rewards found"
          description="Try changing search terms, date range, or reason filters."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable columns={columns} rows={filteredRows} isLoading={isLoading} emptyMessage="No rewards found." />
      )}

      <Modal
        open={open}
        title="Grant bonus reward"
        tone="success"
        titleIcon={<GiftIcon className="h-5 w-5" />}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={userId.trim().length === 0 || points <= 0}
              onClick={() => void onGrant()}
            >
              Grant
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="select mt-1"
              onFocus={() => {
                if (users.length > 0 || isLoadingUsers) return;
                void (async () => {
                  setIsLoadingUsers(true);
                  try {
                    const list = await userApi.listUsers({ active: true });
                    setUsers(list);
                  } catch (err) {
                    toast.error(getApiErrorMessage(err));
                  } finally {
                    setIsLoadingUsers(false);
                  }
                })();
              }}
            >
              <option value="">
                {isLoadingUsers ? 'Loading users...' : users.length === 0 ? 'No users available' : 'Select user'}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Points</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="field mt-1"
              min={1}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
