import type { ReactNode } from 'react';

export type Column<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  width?: string;
};

export default function DataTable<T>({
  columns,
  rows,
  isLoading,
  emptyMessage = 'No data found.',
  getRowKey,
  getRowClassName,
  onRowClick,
  stickyHeader = false,
  scrollContainerClassName
}: {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string;
  getRowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  scrollContainerClassName?: string;
}) {
  return (
    <div className="card-solid overflow-hidden">
      <div className={['overflow-x-auto', scrollContainerClassName].filter(Boolean).join(' ')}>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className={stickyHeader ? 'sticky top-0 z-10 bg-slate-50/90 backdrop-blur' : 'bg-slate-50/80 backdrop-blur'}>
            <tr>
              {columns.map((col, colIdx) => (
                <th
                  key={colIdx}
                  scope="col"
                  className={[col.className ?? 'px-4 py-3', 'text-left text-xs font-semibold uppercase tracking-wide text-slate-600'].join(' ')}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={col.className ?? 'px-4 py-3'}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    >
                      <div className="h-4 w-full max-w-[240px] rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-600">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={getRowKey ? getRowKey(row, idx) : idx}
                  className={
                    [
                      idx % 2 === 0
                        ? 'bg-white/70 hover:bg-brand-50/40'
                        : 'bg-slate-50/50 hover:bg-brand-50/40',
                      onRowClick ? 'cursor-pointer' : null,
                      getRowClassName ? getRowClassName(row, idx) : null
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                  onClick={(e) => {
                    if (!onRowClick) return;
                    const el = e.target as HTMLElement | null;
                    if (el?.closest('button,a,input,select,textarea')) return;
                    onRowClick(row);
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={col.className ?? 'px-4 py-3 text-sm text-slate-700'}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
