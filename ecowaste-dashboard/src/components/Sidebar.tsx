import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import logo from '@/assets/WasteTrack.jpg';

export type SidebarItem = {
  label: string;
  to: string;
  icon?: ReactNode;
  hasUpdate?: boolean;
};

export default function Sidebar({
  title,
  items
}: {
  title: string;
  items: SidebarItem[];
}) {
  return (
    <aside className="sticky top-0 h-screen w-72 shrink-0 self-start overflow-y-auto border-r border-slate-200/80 bg-white/70 backdrop-blur">
      <div className="border-b border-slate-200/80 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <img src={logo} alt="WasteTrack logo" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">WasteTrack</div>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
            </div>
          </div>
          <span className="rounded-full bg-brand-100 px-2 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-600/10">
            Web
          </span>
        </div>
        <div className="mt-3 h-1 w-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 opacity-60" />
      </div>

      <nav className="p-2">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        'grid h-9 w-9 place-items-center rounded-md ring-1 ring-inset transition',
                        isActive
                          ? 'bg-brand-50 text-brand-700 ring-brand-600/20'
                          : 'bg-white/60 text-slate-600 ring-slate-200 group-hover:bg-white group-hover:text-slate-900'
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className={clsx('font-medium', isActive ? 'text-slate-900' : 'text-slate-800')}>
                      {item.label}
                    </span>
                    {item.hasUpdate && !isActive ? (
                      <>
                        <span
                          className="update-attention ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white shadow-sm"
                          aria-hidden="true"
                        >
                          !
                        </span>
                        <span className="sr-only">New updates</span>
                      </>
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
