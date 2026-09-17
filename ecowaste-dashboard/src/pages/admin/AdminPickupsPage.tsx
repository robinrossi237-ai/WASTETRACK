import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '@/api/axios';
import { pickupApi, type PickupRequest, type PickupStatus } from '@/api/pickupApi';
import { reportsApi } from '@/api/reportsApi';
import AdminOperationsCockpit from '@/components/AdminOperationsCockpit';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import DataTable, { type Column } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import SkeletonCard from '@/components/SkeletonCard';
import StatusBadge from '@/components/StatusBadge';
import StatusChip from '@/components/StatusChip';
import { DownloadIcon, RefreshIcon, SearchIcon, TruckIcon, UserPlusIcon } from '@/components/icons';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';

type OperationalPickupStatus = 'pending' | 'assigned' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';

type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

const OPERATIONAL_STATUS_OPTIONS: OperationalPickupStatus[] = [
  'pending',
  'assigned',
  'overdue',
  'in_progress',
  'completed',
  'cancelled'
];

const OPERATIONAL_STATUS_TRANSITIONS: Record<OperationalPickupStatus, OperationalPickupStatus[]> = {
  pending: ['assigned', 'overdue', 'cancelled'],
  assigned: ['in_progress', 'overdue', 'pending', 'cancelled'],
  overdue: ['assigned', 'in_progress', 'pending', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const normalizePickupStatus = (status: PickupStatus): OperationalPickupStatus => {
  if (status === 'payment_uploaded' || status === 'approved') return 'pending';
  return status;
};

const isOperationalStatus = (value: string): value is OperationalPickupStatus => {
  return OPERATIONAL_STATUS_OPTIONS.includes(value as OperationalPickupStatus);
};

const getAllowedStatusOptions = (currentRawStatus: PickupStatus): OperationalPickupStatus[] => {
  const current = normalizePickupStatus(currentRawStatus);
  const next = OPERATIONAL_STATUS_TRANSITIONS[current] ?? [];
  return [current, ...next.filter((status) => status !== current)];
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '-';
  return new Date(value).toLocaleString();
};

const formatOfferStatus = (status?: string | null): string => {
  if (!status) return 'pending';
  return status.replace(/_/g, ' ');
};

export default function AdminPickupsPage() {
  const [searchParams] = useSearchParams();
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [isLoadingPickups, setIsLoadingPickups] = useState<boolean>(true);
  const [pickupLoadError, setPickupLoadError] = useState<string | null>(null);
  const [selectedPickupIds, setSelectedPickupIds] = useState<Set<string>>(new Set());
  const [bulkCollectorId, setBulkCollectorId] = useState<string>('');
  const [collectors, setCollectors] = useState<{ id: string; name: string; email: string; is_active: boolean }[]>([]);
  const [assigningPickupId, setAssigningPickupId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [pickupQuery, setPickupQuery] = useState<string>('');
  const [pickupStatusFilter, setPickupStatusFilter] = useState<OperationalPickupStatus | 'all'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    const pickupStatus = searchParams.get('pickupStatus');
    if (pickupStatus) {
      if (pickupStatus === 'approved' || pickupStatus === 'payment_uploaded') {
        setPickupStatusFilter('pending');
      } else if (isOperationalStatus(pickupStatus)) {
        setPickupStatusFilter(pickupStatus);
      }
    }

    const q = searchParams.get('q');
    if (typeof q === 'string' && q.trim().length > 0) {
      setPickupQuery(q);
    }
  }, [searchParams]);

  const loadPickups = async () => {
    setIsLoadingPickups(true);
    setPickupLoadError(null);
    try {
      const data = await pickupApi.listPickups({ from: fromDate || undefined, to: toDate || undefined });
      setPickups(data);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      const message = getApiErrorMessage(err);
      setPickupLoadError(message);
      toast.error(message);
    } finally {
      setIsLoadingPickups(false);
    }
  };

  const loadCollectors = async () => {
    try {
      const list = await reportsApi.listCollectors();
      setCollectors(list.filter((collector) => collector.is_active));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const retryAll = async () => {
    await Promise.all([loadPickups(), loadCollectors()]);
  };

  useEffect(() => {
    void retryAll();
  }, []);

  useAdminRealtimeRefresh(() => void retryAll());

  const filteredPickups = useMemo(() => {
    const q = pickupQuery.trim().toLowerCase();
    return pickups.filter((pickup) => {
      const operationalStatus = normalizePickupStatus(pickup.status);
      if (pickupStatusFilter !== 'all' && operationalStatus !== pickupStatusFilter) return false;

      if (assignmentFilter === 'assigned' && !pickup.assigned_collector_id) return false;
      if (assignmentFilter === 'unassigned' && pickup.assigned_collector_id) return false;

      if (!q) return true;
      const haystack = [
        pickup.id,
        pickup.waste_type,
        pickup.user_name ?? '',
        pickup.user_email ?? '',
        pickup.assigned_collector_name ?? '',
        pickup.assigned_collector_email ?? '',
        pickup.auto_offer_collector_name ?? '',
        pickup.auto_offer_collector_email ?? '',
        pickup.auto_offer_status ?? '',
        pickup.address ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pickups, pickupQuery, pickupStatusFilter, assignmentFilter]);

  useEffect(() => {
    setSelectedPickupIds(new Set());
  }, [filteredPickups]);

  const statusCounts = useMemo(() => {
    const initial: Record<OperationalPickupStatus, number> = {
      pending: 0,
      assigned: 0,
      overdue: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0
    };

    for (const pickup of pickups) {
      const key = normalizePickupStatus(pickup.status);
      initial[key] += 1;
    }
    return initial;
  }, [pickups]);

  const unassignedCount = useMemo(
    () => pickups.filter((pickup) => !pickup.assigned_collector_id).length,
    [pickups]
  );

  const updatePickupStatus = async (pickupId: string, nextStatus: OperationalPickupStatus) => {
    try {
      await pickupApi.updatePickupStatus(pickupId, nextStatus);
      toast.success('Pickup status updated');
      await loadPickups();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const assignPickupToCollector = async (pickupId: string, collectorId: string) => {
    setAssigningPickupId(pickupId);
    try {
      await pickupApi.assignCollector(pickupId, collectorId);
      toast.success('Collector assigned');
      await loadPickups();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setAssigningPickupId(null);
    }
  };

  const exportPickupsCsv = () => {
    const header = [
      'id',
      'waste_type',
      'status',
      'scheduled_date',
      'resident_name',
      'resident_email',
      'address',
      'assigned_collector_name',
      'assigned_collector_email',
      'assigned_at',
      'auto_offer_collector_name',
      'auto_offer_collector_email',
      'auto_offer_status',
      'auto_offer_distance_km',
      'auto_offer_offered_at',
      'created_at'
    ];
    const rows = filteredPickups.map((pickup) => [
      pickup.id,
      pickup.waste_type,
      normalizePickupStatus(pickup.status),
      pickup.scheduled_date,
      pickup.user_name ?? '',
      pickup.user_email ?? '',
      pickup.address ?? '',
      pickup.assigned_collector_name ?? '',
      pickup.assigned_collector_email ?? '',
      pickup.assigned_at ?? '',
      pickup.auto_offer_collector_name ?? '',
      pickup.auto_offer_collector_email ?? '',
      pickup.auto_offer_status ?? '',
      pickup.auto_offer_distance_km ?? '',
      pickup.auto_offer_offered_at ?? '',
      pickup.created_at
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pickups-operations.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetPickupFilters = () => {
    setPickupQuery('');
    setPickupStatusFilter('all');
    setAssignmentFilter('all');
    setFromDate('');
    setToDate('');
  };

  const pickupColumns: Column<PickupRequest>[] = useMemo(
    () => [
      {
        header: (
          <input
            type="checkbox"
            aria-label="select all pickups"
            checked={selectedPickupIds.size > 0 && selectedPickupIds.size === filteredPickups.length}
            onChange={(event) => {
              if (event.target.checked) {
                setSelectedPickupIds(new Set(filteredPickups.map((pickup) => pickup.id)));
              } else {
                setSelectedPickupIds(new Set());
              }
            }}
          />
        ),
        cell: (pickup) => (
          <input
            type="checkbox"
            checked={selectedPickupIds.has(pickup.id)}
            onChange={() =>
              setSelectedPickupIds((previous) => {
                const next = new Set(previous);
                next.has(pickup.id) ? next.delete(pickup.id) : next.add(pickup.id);
                return next;
              })
            }
          />
        ),
        width: '40px'
      },
      {
        header: 'Request',
        cell: (pickup) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{pickup.waste_type}</div>
            <div className="text-xs text-slate-600">{pickup.id}</div>
            <div className="text-[11px] text-slate-500">Created {formatDateTime(pickup.created_at)}</div>
          </div>
        )
      },
      {
        header: 'Resident',
        cell: (pickup) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{pickup.user_name ?? 'Unknown resident'}</div>
            <div className="text-xs text-slate-600">{pickup.user_email ?? pickup.user_id}</div>
          </div>
        )
      },
      {
        header: 'Schedule & Location',
        cell: (pickup) => (
          <div>
            <div className="text-sm text-slate-900">{formatDateTime(pickup.scheduled_date)}</div>
            <div className="text-xs text-slate-600">{pickup.address?.trim() || 'Location not provided'}</div>
          </div>
        )
      },
      {
        header: 'Collector',
        cell: (pickup) => (
          <div className="space-y-2">
            {pickup.assigned_collector_name ? (
              <div>
                <div className="text-sm font-semibold text-slate-900">{pickup.assigned_collector_name}</div>
                <div className="text-xs text-slate-600">{pickup.assigned_collector_email ?? pickup.assigned_collector_id}</div>
                <div className="text-[11px] text-slate-500">Assigned {formatDateTime(pickup.assigned_at)}</div>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Unassigned</span>
            )}
            {pickup.auto_offer_collector_name
              && normalizePickupStatus(pickup.status) !== 'completed'
              && (
                !pickup.assigned_collector_id
                || pickup.auto_offer_collector_id !== pickup.assigned_collector_id
                || pickup.auto_offer_status === 'pending'
              ) ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Auto-selected by app</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{pickup.auto_offer_collector_name}</div>
                <div className="text-xs text-slate-600">
                  {pickup.auto_offer_collector_email ?? pickup.auto_offer_collector_id}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Offer {formatOfferStatus(pickup.auto_offer_status)}{pickup.auto_offer_distance_km != null
                    ? ` • ${pickup.auto_offer_distance_km.toFixed(1)} km`
                    : ''} • {formatDateTime(pickup.auto_offer_offered_at)}
                </div>
              </div>
            ) : null}
            <select
              value={pickup.assigned_collector_id ?? ''}
              className="select w-52 py-1.5 text-xs"
              onFocus={() => void loadCollectors()}
              disabled={assigningPickupId === pickup.id}
              onChange={(event) => {
                const nextCollectorId = event.target.value;
                if (!nextCollectorId || nextCollectorId === pickup.assigned_collector_id) return;
                void assignPickupToCollector(pickup.id, nextCollectorId);
              }}
            >
              <option value="">{collectors.length === 0 ? 'No active collectors' : 'Assign collector'}</option>
              {collectors.map((collector) => (
                <option key={collector.id} value={collector.id}>
                  {collector.name} ({collector.email})
                </option>
              ))}
            </select>
          </div>
        )
      },
      {
        header: 'Status',
        cell: (pickup) => <StatusBadge status={normalizePickupStatus(pickup.status)} />
      },
      {
        header: 'Action',
        cell: (pickup) => (
          <select
            value={normalizePickupStatus(pickup.status)}
            className="select w-44 py-1.5"
            onChange={(event) => {
              void updatePickupStatus(pickup.id, event.target.value as OperationalPickupStatus);
            }}
          >
            {getAllowedStatusOptions(pickup.status).map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        )
      }
    ],
    [assigningPickupId, collectors, filteredPickups, selectedPickupIds]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pickup Operations"
        subtitle="Manage pickup queue, assignment, and completion lifecycle."
        icon={<TruckIcon className="h-5 w-5" />}
        tone="emerald"
        chips={(
          <>
            <StatusChip label={`Pending ${statusCounts.pending}`} tone="warning" />
            <StatusChip label={`Assigned ${statusCounts.assigned}`} tone="info" />
            <StatusChip label={`In progress ${statusCounts.in_progress}`} tone="info" />
            <StatusChip label={`Overdue ${statusCounts.overdue}`} tone={statusCounts.overdue > 0 ? 'danger' : 'success'} />
            <StatusChip label={`Completed ${statusCounts.completed}`} tone="success" />
            <StatusChip label={`Unassigned ${unassignedCount}`} tone={unassignedCount > 0 ? 'warning' : 'success'} />
          </>
        )}
        footer={(
          <AdminRefreshPanel
            isLoading={isLoadingPickups}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void retryAll()}
          />
        )}
      />

      <AdminOperationsCockpit />

      <div className="space-y-3">
        <div className="card-solid p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Pickup Queue</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={pickupQuery}
                onChange={(event) => setPickupQuery(event.target.value)}
                placeholder="Search pickups"
                className="field w-full pl-9 sm:w-52"
              />
            </div>
            <select
              value={pickupStatusFilter}
              onChange={(event) => setPickupStatusFilter(event.target.value as OperationalPickupStatus | 'all')}
              className="select w-full sm:w-44"
            >
              <option value="all">All statuses</option>
              <option value="pending">pending</option>
              <option value="assigned">assigned</option>
              <option value="overdue">overdue</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
            <select
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
              className="select w-full sm:w-40"
            >
              <option value="all">All assignments</option>
              <option value="assigned">Assigned only</option>
              <option value="unassigned">Unassigned only</option>
            </select>
            <input
              type="date"
              className="field w-36"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
            <input
              type="date"
              className="field w-36"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
            <button type="button" className="btn btn-outline py-1.5" onClick={() => void exportPickupsCsv()}>
              <DownloadIcon className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" className="btn btn-outline py-1.5" onClick={() => void loadPickups()}>
              <RefreshIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
        </div>

        {isLoadingPickups && pickups.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        ) : pickupLoadError && pickups.length === 0 ? (
          <ErrorState title="Could not load pickups" description={pickupLoadError} onRetry={() => void retryAll()} />
        ) : filteredPickups.length === 0 ? (
          <EmptyState
            title="No pickups found"
            description="Try adjusting your queue filters or date range."
            actionLabel="Reset filters"
            onAction={resetPickupFilters}
          />
        ) : (
          <DataTable
            columns={pickupColumns}
            rows={filteredPickups}
            isLoading={isLoadingPickups}
            emptyMessage="No pickups found."
            stickyHeader
            scrollContainerClassName="max-h-[60vh]"
          />
        )}

        {selectedPickupIds.size > 0 ? (
          <div className="card-solid space-y-2 p-3">
            <div className="text-sm font-semibold text-slate-900">Bulk assign collector</div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkCollectorId}
                onChange={(event) => setBulkCollectorId(event.target.value)}
                className="select w-64"
                onFocus={() => void loadCollectors()}
              >
                <option value="">Select collector</option>
                {collectors.map((collector) => (
                  <option key={collector.id} value={collector.id}>
                    {collector.name} ({collector.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary disabled:opacity-60"
                disabled={!bulkCollectorId}
                onClick={async () => {
                  if (!bulkCollectorId) return;
                  try {
                    for (const pickupId of Array.from(selectedPickupIds)) {
                      await pickupApi.assignCollector(pickupId, bulkCollectorId);
                    }
                    toast.success('Assigned selected pickups');
                    setSelectedPickupIds(new Set());
                    setBulkCollectorId('');
                    await loadPickups();
                  } catch (err) {
                    toast.error(getApiErrorMessage(err));
                  }
                }}
              >
                <UserPlusIcon className="h-4 w-4" />
                Assign {selectedPickupIds.size}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
