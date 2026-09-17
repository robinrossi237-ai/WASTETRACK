import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '@/auth/AuthContext';
import logo from '@/assets/WasteTrack.jpg';
import { LogoutIcon } from './icons';

export default function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.email ?? user?.id ?? 'U')
    .split('@')[0]
    .split(/[.\s_-]+/g)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/60 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <img src={logo} alt="WasteTrack logo" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-600">Admin Web Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-slate-900">{user?.email ?? user?.id}</div>
            <div className="text-xs text-slate-600 capitalize">{user?.role}</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-xs font-semibold text-white shadow-sm ring-1 ring-white/40">
            {initials}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              logout();
              toast.success('Signed out');
              navigate('/login', { replace: true });
            }}
          >
            <LogoutIcon className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
