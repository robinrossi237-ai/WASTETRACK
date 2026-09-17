import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import DataTable, { type Column } from '@/components/DataTable';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminPageHeader from '@/components/AdminPageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusChip from '@/components/StatusChip';
import { contentApi, type EducationContent } from '@/api/contentApi';
import { getApiErrorMessage } from '@/api/axios';
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from '@/components/icons';

export default function AdminContentPage() {
  const [rows, setRows] = useState<EducationContent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [open, setOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<EducationContent | null>(null);
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'with_media' | 'no_media'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await contentApi.list();
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (mediaFilter === 'with_media' && !c.media_url) return false;
      if (mediaFilter === 'no_media' && c.media_url) return false;
      const ts = new Date(c.updated_at).getTime();
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        if (!Number.isNaN(fromTs) && ts < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime();
        if (!Number.isNaN(toTs) && ts > toTs + 86_399_000) return false;
      }
      if (!q) return true;
      const haystack = [c.title, c.body ?? '', c.media_url ?? ''].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, mediaFilter, fromDate, toDate]);

  const withMediaCount = useMemo(() => rows.filter((item) => Boolean(item.media_url)).length, [rows]);
  const withoutMediaCount = useMemo(() => rows.length - withMediaCount, [rows, withMediaCount]);

  const resetFilters = () => {
    setQuery('');
    setMediaFilter('all');
    setFromDate('');
    setToDate('');
  };

  const columns: Column<EducationContent>[] = useMemo(
    () => [
      { header: 'Title', cell: (c) => <div className="font-semibold text-slate-900">{c.title}</div> },
      {
        header: 'Media',
        cell: (c) =>
          c.media_url ? (
            <a href={c.media_url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
              Open
            </a>
          ) : (
            '-'
          )
      },
      { header: 'Updated', cell: (c) => new Date(c.updated_at).toLocaleString() },
      {
        header: 'Actions',
        cell: (c) => (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline py-1.5"
              onClick={() => {
                setEditing(c);
                setTitle(c.title);
                setBody(c.body);
                setMediaUrl(c.media_url ?? '');
                setOpen(true);
              }}
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            <button type="button" className="btn btn-danger py-1.5" onClick={() => void onDelete(c.id)}>
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
        )
      }
    ],
    []
  );

  const onDelete = async (id: string) => {
    if (!confirm('Delete this content item?')) return;
    try {
      await contentApi.remove(id);
      toast.success('Deleted');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const onSave = async () => {
    try {
      if (editing) {
        await contentApi.update(editing.id, { title, body, media_url: mediaUrl || null });
        toast.success('Updated');
      } else {
        await contentApi.create({ title, body, media_url: mediaUrl || null });
        toast.success('Created');
      }
      setOpen(false);
      setEditing(null);
      setTitle('');
      setBody('');
      setMediaUrl('');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Education Content"
        subtitle="Create and manage educational articles and media."
        icon={<PencilIcon className="h-5 w-5" />}
        tone="brand"
        chips={(
          <>
            <StatusChip label={`Total ${rows.length}`} tone="info" />
            <StatusChip label={`With media ${withMediaCount}`} tone="success" />
            <StatusChip label={`No media ${withoutMediaCount}`} tone="neutral" />
          </>
        )}
        actions={(
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setTitle('');
              setBody('');
              setMediaUrl('');
              setOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" />
            New content
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
              placeholder="Search content"
              className="field w-full pl-9 sm:w-56"
            />
          </div>
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value as 'all' | 'with_media' | 'no_media')}
            className="select w-full sm:w-44"
          >
            <option value="all">All media</option>
            <option value="with_media">With media</option>
            <option value="no_media">No media</option>
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
          title="Could not load education content"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No content found"
          description="Try changing search, media filters, or date range."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable columns={columns} rows={filteredRows} isLoading={isLoading} emptyMessage="No content found." />
      )}

      <Modal
        open={open}
        title={editing ? 'Edit content' : 'Create content'}
        tone="brand"
        titleIcon={editing ? <PencilIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={title.trim().length === 0 || body.trim().length === 0}
              onClick={() => void onSave()}
            >
              Save
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field mt-1"
              placeholder="e.g., How to separate plastic waste"
            />
          </div>

          <div>
            <label className="label">Media URL (optional)</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="field mt-1"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="label">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="field mt-1"
              placeholder="Write the content here..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
