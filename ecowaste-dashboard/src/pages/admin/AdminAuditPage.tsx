import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { api, getApiErrorMessage } from '@/api/axios';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminPageHeader from '@/components/AdminPageHeader';
import DataTable, { type Column } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusBadge from '@/components/StatusBadge';
import StatusChip from '@/components/StatusChip';
import FilterChips from '@/components/FilterChips';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';
import { ClipboardIcon, ClockIcon, SearchIcon, TagIcon, UsersIcon } from '@/components/icons';

type AuditLog = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const formatAction = (value: string): string => {
  const cleaned = value.replace(/[:_]/g, ' ').trim();
  if (!cleaned) return value;
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

const formatEntity = (value: string): string => {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ success: true; logs: AuditLog[] }>('/admin/audit');
      setLogs(res.data.logs);
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

  const copyToClipboard = useCallback(async (value: string, label = 'ID') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const entityOptions = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.entity_type))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false;
      if (!q) return true;
      const haystack = [
        log.action,
        log.entity_type,
        log.entity_id,
        log.actor_id ?? '',
        log.actor_name ?? '',
        log.actor_email ?? '',
        log.actor_role ?? '',
        log.metadata ? JSON.stringify(log.metadata) : ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query, actionFilter, entityFilter]);

  const systemEventsCount = useMemo(
    () => logs.filter((log) => !log.actor_id).length,
    [logs]
  );
  const userEventsCount = useMemo(
    () => logs.length - systemEventsCount,
    [logs, systemEventsCount]
  );

  const filterChips = useMemo(() => {
    const chips = [];
    if (query.trim()) {
      chips.push({ id: 'query', label: `Search: ${query.trim()}`, onClear: () => setQuery('') });
    }
    if (actionFilter !== 'all') {
      chips.push({
        id: 'action',
        label: `Action: ${actionFilter}`,
        onClear: () => setActionFilter('all')
      });
    }
    if (entityFilter !== 'all') {
      chips.push({
        id: 'entity',
        label: `Entity: ${entityFilter}`,
        onClear: () => setEntityFilter('all')
      });
    }
    return chips;
  }, [query, actionFilter, entityFilter]);

  const columns: Column<AuditLog>[] = useMemo(
    () => [
      {
        header: (
          <span className="inline-flex items-center gap-2">
            <ClipboardIcon className="h-3.5 w-3.5 text-slate-400" />
            Action
          </span>
        ),
        cell: (log) => (
          <div className="space-y-1">
            <StatusBadge status={log.action} />
            <div className="text-xs text-slate-500">{log.action}</div>
          </div>
        )
      },
      {
        header: (
          <span className="inline-flex items-center gap-2">
            <TagIcon className="h-3.5 w-3.5 text-slate-400" />
            Entity
          </span>
        ),
        cell: (log) => (
          <div className="space-y-1">
            <StatusBadge status={log.entity_type} />
            <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
              <span>{log.entity_id}</span>
              <button
                type="button"
                className="icon-btn h-6 w-6"
                onClick={() => void copyToClipboard(log.entity_id, 'Entity ID')}
                aria-label="Copy entity ID"
              >
                <ClipboardIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      },
      {
        header: (
          <span className="inline-flex items-center gap-2">
            <UsersIcon className="h-3.5 w-3.5 text-slate-400" />
            Actor
          </span>
        ),
        cell: (log) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {log.actor_name || (log.actor_id ? 'User' : 'System')}
            </div>
            {log.actor_email ? (
              <div className="text-xs text-slate-500">{log.actor_email}</div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {log.actor_role ? <StatusBadge status={log.actor_role} /> : null}
              {log.actor_id ? (
                <div className="flex items-center gap-2 font-mono">
                  <span>{log.actor_id}</span>
                  <button
                    type="button"
                    className="icon-btn h-6 w-6"
                    onClick={() => void copyToClipboard(log.actor_id ?? '', 'Actor ID')}
                    aria-label="Copy actor ID"
                  >
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span>System event</span>
              )}
            </div>
          </div>
        )
      },
      {
        header: (
          <span className="inline-flex items-center gap-2">
            <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
            Time
          </span>
        ),
        cell: (log) => (
          <div className="text-sm text-slate-700">
            {new Date(log.created_at).toLocaleString()}
          </div>
        )
      },
      {
        header: 'Details',
        cell: (log) =>
          log.metadata ? (
            <button
              type="button"
              className="btn btn-ghost px-3 py-1 text-xs"
              onClick={() => setSelectedLog(log)}
            >
              View
            </button>
          ) : (
            <span className="text-xs text-slate-400">--</span>
          )
      }
    ],
    [copyToClipboard]
  );

  return (
    <div className="space-y-5 pt-2 sm:pt-4">
      <AdminPageHeader
        title="Audit Log"
        subtitle="Status changes and administrative actions across the platform."
        icon={<ClipboardIcon className="h-5 w-5" />}
        tone="slate"
        chips={(
          <>
            <StatusChip label={`Entries ${logs.length}`} tone="info" />
            <StatusChip label={`User events ${userEventsCount}`} tone="success" />
            <StatusChip label={`System events ${systemEventsCount}`} tone="neutral" />
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

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action, entity, actor, metadata..."
              className="field w-full pl-9 sm:w-64"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="select w-full sm:w-44"
          >
            <option value="all">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="select w-full sm:w-44"
          >
            <option value="all">All entities</option>
            {entityOptions.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FilterChips
        chips={filterChips}
        onClearAll={() => {
          setQuery('');
          setActionFilter('all');
          setEntityFilter('all');
        }}
      />

      {isLoading && logs.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && logs.length === 0 ? (
        <ErrorState
          title="Could not load audit log"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="Try changing filters or clearing search terms."
          actionLabel="Reset filters"
          onAction={() => {
            setQuery('');
            setActionFilter('all');
            setEntityFilter('all');
          }}
        />
      ) : (
        <DataTable columns={columns} rows={filteredLogs} isLoading={isLoading} emptyMessage="No audit entries." />
      )}

      <Modal
        open={!!selectedLog}
        title="Audit details"
        tone="neutral"
        titleIcon={<ClipboardIcon className="h-5 w-5" />}
        onClose={() => setSelectedLog(null)}
        footer={
          <div className="flex justify-end">
            <button type="button" className="btn btn-outline" onClick={() => setSelectedLog(null)}>
              Close
            </button>
          </div>
        }
      >
        {selectedLog ? (
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</div>
              <div className="font-semibold text-slate-900">{formatAction(selectedLog.action)}</div>
              <div className="text-xs text-slate-500">{selectedLog.action}</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entity</div>
                <div className="text-sm text-slate-900">{formatEntity(selectedLog.entity_type)}</div>
                <div className="font-mono text-xs text-slate-500">{selectedLog.entity_id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actor</div>
                <div className="text-sm text-slate-900">
                  {selectedLog.actor_name || (selectedLog.actor_id ? 'User' : 'System')}
                </div>
                {selectedLog.actor_email ? (
                  <div className="text-xs text-slate-500">{selectedLog.actor_email}</div>
                ) : null}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamp</div>
              <div className="text-sm text-slate-900">{new Date(selectedLog.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata</div>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

