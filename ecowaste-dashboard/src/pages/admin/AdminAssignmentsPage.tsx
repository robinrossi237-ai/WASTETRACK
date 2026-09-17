import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import DataTable, { type Column } from '@/components/DataTable';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminOperationsCockpit from '@/components/AdminOperationsCockpit';
import AdminPageHeader from '@/components/AdminPageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusBadge from '@/components/StatusBadge';
import StatusChip from '@/components/StatusChip';
import { getApiErrorMessage } from '@/api/axios';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';
import { reportsApi, type CollectorUser } from '@/api/reportsApi';
import { pickupApi, type Assignment, type PickupRequest, type PickupStatus } from '@/api/pickupApi';
import { PlusIcon, SearchIcon } from '@/components/icons';

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PickupStatus | 'all'>('all');

  const [open, setOpen] = useState<boolean>(false);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [collectors, setCollectors] = useState<CollectorUser[]>([]);
  const [pickupId, setPickupId] = useState<string>('');
  const [collectorId, setCollectorId] = useState<string>('');

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await pickupApi.listAssignments();
      setAssignments(list);
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

  const filteredAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        a.pickup_request_id,
        a.pickup_waste_type,
        a.resident_name,
        a.resident_email,
        a.collector_name,
        a.collector_email
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [assignments, query, statusFilter]);

  const assignedCount = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'assigned').length,
    [assignments]
  );
  const inProgressCount = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'in_progress').length,
    [assignments]
  );
  const completedCount = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'completed').length,
    [assignments]
  );

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const columns: Column<Assignment>[] = useMemo(
    () => [
      { header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
      {
        header: 'Pickup',
        cell: (a) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{a.pickup_waste_type}</div>
            <div className="text-xs text-slate-600">{new Date(a.pickup_scheduled_date).toLocaleString()}</div>
            <div className="text-[11px] text-slate-500">{a.pickup_request_id}</div>
          </div>
        )
      },
      {
        header: 'Resident',
        cell: (a) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{a.resident_name}</div>
            <div className="text-xs text-slate-600">{a.resident_email}</div>
          </div>
        )
      },
      {
        header: 'Collector',
        cell: (a) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{a.collector_name}</div>
            <div className="text-xs text-slate-600">{a.collector_email}</div>
          </div>
        )
      },
      { header: 'Assigned At', cell: (a) => new Date(a.assigned_at).toLocaleString() }
    ],
    []
  );

  const openAssignModal = async () => {
    setOpen(true);
    setPickupId('');
    setCollectorId('');
    try {
      const [pickupList, collectorList] = await Promise.all([pickupApi.listPickups(), reportsApi.listCollectors()]);
      setPickups(pickupList);
      setCollectors(collectorList.filter((c) => c.is_active));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const onAssign = async () => {
    if (!pickupId || !collectorId) return;
    try {
      await pickupApi.assignCollector(pickupId, collectorId);
      toast.success('Assignment created');
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4 pt-2 sm:pt-4">
      <AdminPageHeader
        title="Collector Assignments"
        subtitle="Assign pickup requests to available collectors."
        icon={<PlusIcon className="h-5 w-5" />}
        tone="brand"
        chips={(
          <>
            <StatusChip label={`Total ${assignments.length}`} tone="info" />
            <StatusChip label={`Assigned ${assignedCount}`} tone="warning" />
            <StatusChip label={`In progress ${inProgressCount}`} tone="info" />
            <StatusChip label={`Completed ${completedCount}`} tone="success" />
          </>
        )}
        actions={(
          <button type="button" className="btn btn-primary" onClick={() => void openAssignModal()}>
            <PlusIcon className="h-4 w-4" />
            New assignment
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

      <AdminOperationsCockpit />

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assignments"
              className="field w-full pl-9 sm:w-56"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PickupStatus | 'all')}
            className="select w-full sm:w-44"
          >
            <option value="all">All statuses</option>
            <option value="assigned">assigned</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
      </div>

      {isLoading && assignments.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && assignments.length === 0 ? (
        <ErrorState
          title="Could not load assignments"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredAssignments.length === 0 ? (
        <EmptyState
          title="No assignments found"
          description="Try adjusting search or status filters."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable columns={columns} rows={filteredAssignments} isLoading={isLoading} emptyMessage="No assignments found." />
      )}

      <Modal
        open={open}
        title="Create assignment"
        tone="brand"
        titleIcon={<PlusIcon className="h-5 w-5" />}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={!pickupId || !collectorId}
              onClick={() => void onAssign()}
            >
              Assign
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Pickup request</label>
            <select value={pickupId} onChange={(e) => setPickupId(e.target.value)} className="select mt-1">
              <option value="">Select pickup</option>
              {pickups.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.waste_type} | {p.user_name ?? 'Resident'} | {new Date(p.scheduled_date).toLocaleDateString()} | {p.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Collector</label>
            <select value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className="select mt-1">
              <option value="">Select collector</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} | {c.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
