import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import DataTable, { type Column } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import DetailDrawer from '@/components/DetailDrawer';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusBadge from '@/components/StatusBadge';
import StatusChip from '@/components/StatusChip';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminOperationsCockpit from '@/components/AdminOperationsCockpit';
import { getApiErrorMessage } from '@/api/axios';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';
import {
  reportsApi,
  type CollectorUser,
  type ReportDispatchOffer,
  type ReportStatus,
  type WasteReport
} from '@/api/reportsApi';
import { CheckIcon, DownloadIcon, ReportIcon, SearchIcon, UserPlusIcon } from '@/components/icons';

const FILTER_PRESET_STORAGE_KEY = 'admin_reports_filter_presets_v1';

type FilterPreset = {
  id: string;
  name: string;
  query: string;
  statusFilter: ReportStatus | 'all';
  fromDate: string;
  toDate: string;
};

const formatOfferDistance = (distanceKm?: number | null): string => {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) return 'N/A';
  return `${distanceKm.toFixed(1)} km`;
};

const formatOfferTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'N/A';
  return new Date(value).toLocaleString();
};

const getAutoOffers = (report: WasteReport): ReportDispatchOffer[] => {
  if (!Array.isArray(report.auto_offer_collectors)) return [];
  return report.auto_offer_collectors.slice(0, 3);
};

export default function AdminReportsPage() {
  const [rows, setRows] = useState<WasteReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [collectorModalOpen, setCollectorModalOpen] = useState<boolean>(false);
  const [collectors, setCollectors] = useState<CollectorUser[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState<string>('');
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [detailReportId, setDetailReportId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
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
        r.user_name ?? '',
        r.user_email ?? '',
        r.user_id ?? '',
        r.description ?? '',
        r.assigned_collector_name ?? '',
        r.assigned_collector_email ?? '',
        r.assigned_collector_id ?? '',
        r.assigned_at ?? '',
        ...getAutoOffers(r).flatMap((offer) => [
          offer.collector_name ?? '',
          offer.collector_email ?? '',
          offer.collector_id ?? '',
          offer.status ?? ''
        ])
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, fromDate, toDate, query, statusFilter]);

  const detailReport = useMemo(
    () => rows.find((report) => report.id === detailReportId) ?? null,
    [rows, detailReportId]
  );

  useEffect(() => {
    if (!detailReportId) return;
    if (rows.some((report) => report.id === detailReportId)) return;
    setDetailReportId(null);
  }, [rows, detailReportId]);

  const unassignedCount = useMemo(
    () => rows.filter((report) => !report.assigned_collector_id).length,
    [rows]
  );
  const cleanedCount = useMemo(
    () => rows.filter((report) => report.status === 'cleaned').length,
    [rows]
  );
  const pendingCount = useMemo(
    () => rows.filter((report) => report.status === 'reported' || report.status === 'verified').length,
    [rows]
  );

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    setSelectedPresetId('');
  };

  useEffect(() => {
    setSelectedReports(new Set());
  }, [fromDate, toDate, query, statusFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(FILTER_PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FilterPreset[];
      if (!Array.isArray(parsed)) return;
      const safeStatus = new Set<ReportStatus | 'all'>([
        'all',
        'reported',
        'verified',
        'assigned',
        'cleaned',
        'approved',
        'rejected',
        'cancelled'
      ]);
      setPresets(
        parsed
          .filter(
            (preset) =>
              typeof preset?.id === 'string' &&
              typeof preset?.name === 'string' &&
              typeof preset?.query === 'string' &&
              typeof preset?.fromDate === 'string' &&
              typeof preset?.toDate === 'string'
          )
          .map((preset) => ({
            ...preset,
            statusFilter: safeStatus.has(preset.statusFilter) ? preset.statusFilter : 'all'
          }))
      );
    } catch {
      // Ignore malformed local storage values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_PRESET_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // Ignore storage write failures.
    }
  }, [presets]);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const reports = await reportsApi.listReports();
      setRows(
        reports.map((report) => ({
          ...report,
          auto_offer_collectors: getAutoOffers(report)
        }))
      );
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

  const toggleReport = (id: string) => {
    setSelectedReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportReportsCsv = () => {
    const header = [
      'id',
      'status',
      'user_name',
      'user_email',
      'assigned_collector_name',
      'assigned_collector_email',
      'assigned_at',
      'description',
      'created_at'
    ];
    const csv = [header, ...filteredRows.map((r) => [
      r.id,
      r.status,
      r.user_name ?? '',
      r.user_email ?? '',
      r.assigned_collector_name ?? '',
      r.assigned_collector_email ?? '',
      r.assigned_at ?? '',
      r.description ?? '',
      r.created_at
    ])]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const bulkAssign = async () => {
    if (!selectedCollectorId || selectedReports.size === 0) {
      toast.error('Select reports and a collector');
      return;
    }
    try {
      for (const id of Array.from(selectedReports)) {
        await reportsApi.assignCollector(id, selectedCollectorId);
      }
      toast.success('Collector assigned to selected reports');
      setSelectedReports(new Set());
      setSelectedCollectorId('');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const openAssignCollectorModal = (reportId: string) => {
    setSelectedReportId(reportId);
    setSelectedCollectorId('');
    setCollectorModalOpen(true);
    void (async () => {
      try {
        const list = await reportsApi.listCollectors();
        setCollectors(list.filter((collector) => collector.is_active));
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      }
    })();
  };

  const updateReportStatus = async (reportId: string, nextStatus: ReportStatus) => {
    try {
      await reportsApi.updateStatus(reportId, nextStatus);
      toast.success('Status updated');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const signalNearestCollectors = async (reportId: string) => {
    try {
      const response = await reportsApi.signalNearestCollectors(reportId, 3);
      if (!response.dispatched || response.offers_created === 0) {
        toast(response.reason.replace(/_/g, ' '));
      } else {
        toast.success(`Signaled ${response.offers_created} nearest collector(s)`);
      }
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const saveCurrentPreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const id = `${Date.now()}`;
    const preset: FilterPreset = {
      id,
      name,
      query,
      statusFilter,
      fromDate,
      toDate
    };
    setPresets((prev) => [...prev, preset]);
    setPresetName('');
    setSelectedPresetId(id);
    toast.success('Filter preset saved');
  };

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    setQuery(preset.query);
    setStatusFilter(preset.statusFilter);
    setFromDate(preset.fromDate);
    setToDate(preset.toDate);
  };

  const deletePreset = (presetId: string) => {
    setPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    if (selectedPresetId === presetId) {
      setSelectedPresetId('');
    }
    toast.success('Filter preset removed');
  };

  const columns: Column<WasteReport>[] = useMemo(
    () => [
      {
        header: (
          <input
            type="checkbox"
            aria-label="select all"
            checked={selectedReports.size > 0 && selectedReports.size === filteredRows.length}
            onChange={(e) => {
              if (e.target.checked) setSelectedReports(new Set(filteredRows.map((r) => r.id)));
              else setSelectedReports(new Set());
            }}
          />
        ),
        cell: (r) => (
          <input
            type="checkbox"
            checked={selectedReports.has(r.id)}
            onChange={() => toggleReport(r.id)}
          />
        ),
        width: '40px'
      },
      {
        header: 'Status',
        cell: (r) => <StatusBadge status={r.status} />
      },
      {
        header: 'Resident',
        cell: (r) => (
          <div>
            <div className="text-sm font-semibold text-slate-900">{r.user_name ?? 'Unknown'}</div>
            <div className="text-xs text-slate-600">{r.user_email ?? r.user_id}</div>
          </div>
        )
      },
      {
        header: 'Collector',
        cell: (r) => {
          const autoOffers = getAutoOffers(r);
          return (
            <div className="space-y-2">
              {r.assigned_collector_name ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.assigned_collector_name}</div>
                  <div className="text-xs text-slate-600">{r.assigned_collector_email ?? r.assigned_collector_id}</div>
                  {r.assigned_at ? (
                    <div className="text-[11px] text-slate-500">Assigned {new Date(r.assigned_at).toLocaleString()}</div>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-slate-500">Unassigned</span>
              )}
              {autoOffers.length > 0 ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                    Auto-signaled collectors
                  </div>
                  <div className="mt-1 space-y-1">
                    {autoOffers.map((offer) => (
                      <div key={offer.offer_id} className="text-[11px] text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {offer.collector_name ?? offer.collector_email ?? offer.collector_id}
                        </span>
                        <span className="text-slate-600">
                          {' '}
                          {offer.status} - {formatOfferDistance(offer.distance_km)} - {formatOfferTime(offer.offered_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        }
      },
      {
        header: 'Description',
        cell: (r) => (
          <div className="max-w-md">
            <div className="text-sm font-semibold text-slate-900">{r.description ?? '-'}</div>
            <div className="mt-0.5 text-xs text-slate-600">
              {r.location_text || 'No location'}
            </div>
          </div>
        )
      },
      {
        header: 'Photo',
        cell: (r) =>
          r.photo_url ? (
            <a href={r.photo_url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
              View
            </a>
          ) : (
            '-'
          )
      },
      {
        header: 'Actions',
        cell: (r) => (
          <div className="flex flex-wrap gap-2">
            <select
              value={r.status}
              onChange={(e) => {
                const next = e.target.value as ReportStatus;
                void updateReportStatus(r.id, next);
              }}
              className="select w-44 py-1.5"
            >
              <option value="reported">reported</option>
              <option value="verified">verified</option>
              <option value="assigned">assigned</option>
              <option value="cleaned">cleaned</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="cancelled">cancelled</option>
            </select>
            <button
              type="button"
              className="btn btn-outline py-1.5"
              onClick={() => openAssignCollectorModal(r.id)}
            >
              <UserPlusIcon className="h-4 w-4" />
              Assign collector
            </button>
            <button
              type="button"
              className="btn btn-outline py-1.5 disabled:opacity-60"
              disabled={!(r.status === 'reported' || r.status === 'verified')}
              onClick={() => void signalNearestCollectors(r.id)}
            >
              Signal nearest 3
            </button>
          </div>
        )
      }
    ],
    [filteredRows, selectedReports, openAssignCollectorModal, signalNearestCollectors, updateReportStatus]
  );

  const onAssign = async () => {
    if (!selectedReportId || !selectedCollectorId) return;
    try {
      await reportsApi.assignCollector(selectedReportId, selectedCollectorId);
      toast.success('Collector assigned');
      setCollectorModalOpen(false);
      setSelectedCollectorId('');
      setSelectedReportId(null);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Waste Reports"
        subtitle="Review reports, update status, and assign collectors."
        icon={<ReportIcon className="h-5 w-5" />}
        tone="amber"
        chips={(
          <>
            <StatusChip label={`Total ${rows.length}`} tone="info" />
            <StatusChip label={`Pending ${pendingCount}`} tone="warning" />
            <StatusChip label={`Unassigned ${unassignedCount}`} tone={unassignedCount > 0 ? 'danger' : 'success'} />
            <StatusChip label={`Cleaned ${cleanedCount}`} tone="success" />
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

      <AdminOperationsCockpit />

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Reports Queue</div>
          <div className="flex flex-wrap gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports"
              className="field w-full pl-9 sm:w-52"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReportStatus | 'all')}
            className="select w-full sm:w-40"
          >
            <option value="all">All statuses</option>
            <option value="reported">reported</option>
            <option value="verified">verified</option>
            <option value="assigned">assigned</option>
            <option value="cleaned">cleaned</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="cancelled">cancelled</option>
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
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="field w-full sm:w-40"
          />
          <button
            type="button"
            className="btn btn-outline py-1.5 disabled:opacity-60"
            disabled={!query.trim() && statusFilter === 'all' && !fromDate && !toDate}
            onClick={saveCurrentPreset}
          >
            Save preset
          </button>
          <select
            value={selectedPresetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="select w-full sm:w-48"
          >
            <option value="">Load preset</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          {selectedPresetId ? (
            <button
              type="button"
              className="btn btn-outline py-1.5"
              onClick={() => deletePreset(selectedPresetId)}
            >
              Remove preset
            </button>
          ) : null}
          <button type="button" className="btn btn-outline py-1.5" onClick={() => void exportReportsCsv()}>
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
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
          title="Could not load reports"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No reports found"
          description="Try changing filters or search terms to find matching reports."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredRows}
          isLoading={isLoading}
          emptyMessage="No reports found."
          stickyHeader
          scrollContainerClassName="max-h-[65vh]"
          onRowClick={(row) => setDetailReportId(row.id)}
        />
      )}

      {selectedReports.size > 0 && (
        <div className="card-solid p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Bulk assign collector</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCollectorId}
              onChange={(e) => setSelectedCollectorId(e.target.value)}
              className="select w-64"
              onFocus={() => {
                if (collectors.length > 0) return;
                void (async () => {
                  try {
                    const list = await reportsApi.listCollectors();
                    setCollectors(list);
                  } catch (err) {
                    toast.error(getApiErrorMessage(err));
                  }
                })();
              }}
            >
              <option value="">Select collector</option>
              {collectors.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={!selectedCollectorId}
              onClick={() => void bulkAssign()}
            >
              <CheckIcon className="h-4 w-4" />
              Assign to {selectedReports.size} report(s)
            </button>
          </div>
        </div>
      )}

      <DetailDrawer
        open={Boolean(detailReport)}
        title={detailReport ? `Report ${detailReport.id}` : 'Report details'}
        onClose={() => setDetailReportId(null)}
        footer={
          detailReport ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setDetailReportId(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDetailReportId(null);
                  openAssignCollectorModal(detailReport.id);
                }}
              >
                <UserPlusIcon className="h-4 w-4" />
                Assign collector
              </button>
            </div>
          ) : undefined
        }
      >
        {detailReport ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={detailReport.status} />
              <span className="text-xs text-slate-600">
                Created {new Date(detailReport.created_at).toLocaleString()}
              </span>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resident</div>
                <div className="mt-1 text-slate-900">{detailReport.user_name ?? 'Unknown'}</div>
                <div className="text-slate-600">{detailReport.user_email ?? detailReport.user_id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collector</div>
                {detailReport.assigned_collector_name ? (
                  <>
                    <div className="mt-1 text-slate-900">{detailReport.assigned_collector_name}</div>
                    <div className="text-slate-600">
                      {detailReport.assigned_collector_email ?? detailReport.assigned_collector_id}
                    </div>
                    <div className="text-xs text-slate-500">
                      Assigned {detailReport.assigned_at ? new Date(detailReport.assigned_at).toLocaleString() : 'N/A'}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-slate-500">Unassigned</div>
                )}
              </div>
            </div>

            {getAutoOffers(detailReport).length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Auto-signaled collectors
                </div>
                <div className="grid gap-2">
                  {getAutoOffers(detailReport).map((offer) => (
                    <div
                      key={offer.offer_id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="font-semibold text-slate-900">
                        {offer.collector_name ?? offer.collector_email ?? offer.collector_id}
                      </div>
                      <div>
                        Status {offer.status} - {formatOfferDistance(offer.distance_km)}
                      </div>
                      <div>Offered {formatOfferTime(offer.offered_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</div>
              <p className="mt-1 text-sm text-slate-800">{detailReport.description ?? 'No description provided.'}</p>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</div>
              <p className="mt-1 text-sm text-slate-800">
                {detailReport.location_text || 'No coordinates provided'}
              </p>
            </div>

            {detailReport.photo_url ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Photo evidence</div>
                <a
                  href={detailReport.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-700 hover:underline"
                >
                  Open full image
                </a>
                <img
                  src={detailReport.photo_url}
                  alt="Report evidence"
                  className="w-full rounded-xl border border-slate-200 object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update status</div>
              <select
                value={detailReport.status}
                onChange={(e) => {
                  const next = e.target.value as ReportStatus;
                  void updateReportStatus(detailReport.id, next);
                }}
                className="select w-full"
              >
                <option value="reported">reported</option>
                <option value="verified">verified</option>
                <option value="assigned">assigned</option>
                <option value="cleaned">cleaned</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </div>
        ) : null}
      </DetailDrawer>

      <Modal
        open={collectorModalOpen}
        title="Assign collector"
        tone="brand"
        titleIcon={<UserPlusIcon className="h-5 w-5" />}
        onClose={() => setCollectorModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setCollectorModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary disabled:opacity-60"
              disabled={!selectedCollectorId}
              onClick={() => void onAssign()}
            >
              Assign
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700">Select an active collector:</div>
          <select value={selectedCollectorId} onChange={(e) => setSelectedCollectorId(e.target.value)} className="select">
            <option value="">Select collector</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
