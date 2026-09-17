import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import DataTable, { type Column } from '@/components/DataTable';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import SkeletonCard from '@/components/SkeletonCard';
import StatusChip from '@/components/StatusChip';
import { getApiErrorMessage } from '@/api/axios';
import { userApi, type CollectorRankingEntry, type User } from '@/api/userApi';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';
import { SearchIcon, UsersIcon } from '@/components/icons';

const formatMaybeNumber = (value: number | null | undefined, fallback = '--') => {
  if (value == null || Number.isNaN(value)) return fallback;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const formatDateTime = (value: string | null) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export default function AdminCollectorRankingPage() {
  const [rows, setRows] = useState<CollectorRankingEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  const load = async (opts?: { includeInactive?: boolean }) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const includeInactiveFlag = opts?.includeInactive ?? includeInactive;
      const [ranking, allUsers] = await Promise.all([
        userApi.listCollectorRanking({
          include_inactive: includeInactiveFlag
        }),
        userApi.listUsers({
          role: 'resident',
          active: includeInactiveFlag ? undefined : true
        }),
      ]);
      setRows(ranking);
      setUsers(allUsers);
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
    void load({ includeInactive });
  }, [includeInactive]);

  useAdminRealtimeRefresh(() => void load());

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.collector_name,
        row.collector_email,
        row.collector_phone ?? '',
        row.collector_area ?? '',
        row.collector_id
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const rankedUsers = useMemo(() => {
    const sorted = [...users]
      .filter((user) => user.role === 'resident')
      .sort((left, right) => {
        if (right.points !== left.points) return right.points - left.points;
        const leftCreatedAt = new Date(left.created_at).getTime();
        const rightCreatedAt = new Date(right.created_at).getTime();
        if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 12);

    return sorted.map((user, index) => ({
      rank: index + 1,
      ...user,
    }));
  }, [users]);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return {
        total: 0,
        active: 0,
        averageScore: 0,
        topScore: 0,
        averageCompletionRate: 0
      };
    }

    const total = rows.length;
    const active = rows.filter((row) => row.is_active).length;
    const averageScore = rows.reduce((sum, row) => sum + row.score, 0) / total;
    const topScore = rows.reduce((max, row) => Math.max(max, row.score), 0);
    const averageCompletionRate =
      rows.reduce((sum, row) => sum + row.pickup_completion_rate, 0) / total;

    return {
      total,
      active,
      averageScore,
      topScore,
      averageCompletionRate
    };
  }, [rows]);

  const resetFilters = () => {
    setQuery('');
  };

  const columns: Column<CollectorRankingEntry>[] = useMemo(
    () => [
      {
        header: 'Rank',
        width: '72px',
        cell: (row) => <span className="text-sm font-semibold text-slate-900">#{row.rank}</span>
      },
      {
        header: 'Collector',
        cell: (row) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{row.collector_name}</div>
            <div className="text-xs text-slate-600">{row.collector_email}</div>
            <div className="text-[11px] text-slate-500">
              {row.collector_area ? row.collector_area : 'Area not set'}
            </div>
          </div>
        )
      },
      {
        header: 'Score',
        width: '92px',
        cell: (row) => (
          <div className="text-sm font-semibold text-brand-700">
            {formatMaybeNumber(row.score)}
          </div>
        )
      },
      {
        header: 'Pickups',
        cell: (row) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {row.pickups_completed} / {row.pickups_assigned}
            </div>
            <div className="text-xs text-slate-600">
              Completion {formatMaybeNumber(row.pickup_completion_rate)}%
            </div>
          </div>
        )
      },
      {
        header: 'Avg Time (h)',
        width: '120px',
        cell: (row) => <span>{formatMaybeNumber(row.avg_pickup_completion_hours)}</span>
      },
      {
        header: 'Issues',
        cell: (row) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{row.pickup_issues}</div>
            <div className="text-xs text-slate-600">{formatMaybeNumber(row.pickup_issue_rate)}%</div>
          </div>
        )
      },
      {
        header: 'Cancellations',
        cell: (row) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{row.pickups_cancelled}</div>
            <div className="text-xs text-slate-600">{formatMaybeNumber(row.pickup_cancellation_rate)}%</div>
          </div>
        )
      },
      {
        header: 'Reports',
        cell: (row) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Cleaned {row.reports_cleaned}
            </div>
            <div className="text-xs text-slate-600">
              Issues {row.report_issues} ({formatMaybeNumber(row.report_issue_rate)}%)
            </div>
          </div>
        )
      },
      {
        header: 'Last Login',
        cell: (row) => <span className="text-xs text-slate-700">{formatDateTime(row.last_login_at)}</span>
      },
      {
        header: 'Active',
        width: '90px',
        cell: (row) => (
          <StatusChip
            label={row.is_active ? 'ACTIVE' : 'INACTIVE'}
            tone={row.is_active ? 'success' : 'neutral'}
          />
        )
      }
    ],
    []
  );

  const userRankingColumns: Column<(User & { rank: number })>[] = useMemo(
    () => [
      {
        header: 'Rank',
        width: '72px',
        cell: (row) => <span className="text-sm font-semibold text-slate-900">#{row.rank}</span>
      },
      {
        header: 'User',
        cell: (row) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-600">{row.email}</div>
            <div className="text-[11px] text-slate-500">{row.area ?? 'Area not set'}</div>
          </div>
        )
      },
      {
        header: 'Role',
        width: '110px',
        cell: (row) => (
          <StatusChip
            label={row.role.toUpperCase()}
            tone={row.role === 'collector' ? 'info' : 'neutral'}
          />
        )
      },
      {
        header: 'Points',
        width: '110px',
        cell: (row) => <span className="text-sm font-semibold text-brand-700">{row.points.toLocaleString()}</span>
      },
      {
        header: 'Active',
        width: '90px',
        cell: (row) => (
          <StatusChip
            label={row.is_active ? 'ACTIVE' : 'INACTIVE'}
            tone={row.is_active ? 'success' : 'neutral'}
          />
        )
      }
    ],
    []
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="User Rankings"
        subtitle="Resident points leaderboard and collector operational performance ranking."
        icon={<UsersIcon className="h-5 w-5" />}
        tone="brand"
        chips={(
          <>
            <StatusChip label={`Collectors ${summary.total}`} tone="info" />
            <StatusChip label={`Active ${summary.active}`} tone="success" />
            <StatusChip label={`Avg score ${formatMaybeNumber(summary.averageScore)}`} tone="warning" />
            <StatusChip label={`Top score ${formatMaybeNumber(summary.topScore)}`} tone="success" />
            <StatusChip
              label={`Avg completion ${formatMaybeNumber(summary.averageCompletionRate)}%`}
              tone="neutral"
            />
          </>
        )}
        footer={(
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load()}
          />
        )}
      />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Resident Ranking by Points</h3>
            <p className="text-xs text-slate-600">
              Top residents ranked by total reward points.
            </p>
          </div>
          <StatusChip
            label={rankedUsers[0] ? `Top points ${rankedUsers[0].points.toLocaleString()}` : 'Top points --'}
            tone="success"
          />
        </div>
        <DataTable
          columns={userRankingColumns}
          rows={rankedUsers}
          isLoading={isLoading && rankedUsers.length === 0}
          emptyMessage="No ranked residents yet."
          getRowKey={(row) => row.id}
        />
      </section>

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search collector"
              className="field w-full pl-9 sm:w-56"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include inactive collectors
          </label>
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
          title="Could not load collector ranking"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No collector ranking data"
          description="Try adjusting your search filters."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredRows}
          isLoading={isLoading}
          emptyMessage="No collector ranking data found."
          stickyHeader
          scrollContainerClassName="max-h-[70vh]"
        />
      )}
    </div>
  );
}
