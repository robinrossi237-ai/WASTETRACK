import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { getApiErrorMessage } from '@/api/axios';
import { useAuth } from '@/auth/AuthContext';
import logo from '@/assets/WasteTrack.jpg';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = await login({ email, password });

      if (user.role === 'admin') {
        toast.success('Signed in');
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      toast.error('This web dashboard is for admins only. Collectors and residents should use the mobile app.');
      logout();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-50 via-slate-50 to-brand-50 p-6">
      <div className="w-full max-w-md">
        <div className="card-solid overflow-hidden">
          <div className="relative px-6 pb-6 pt-7">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 opacity-[0.08]" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  <img src={logo} alt="WasteTrack logo" className="h-9 w-9 object-contain" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">WasteTrack</div>
                  <h1 className="text-lg font-semibold text-slate-900">Admin Portal</h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Sign in with an admin account to manage the platform and oversee operations.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 border-t border-slate-200/70 bg-white/80 px-6 py-6">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field mt-1"
                placeholder="admin@ecowaste.com"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field mt-1"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            {/* <button
              type="button"
              className="btn btn-outline w-full"
              onClick={() => {
                logout();
                toast.success('Signed out');
              }}
            >
              Clear session
            </button> */}
          </form>

          <div className="border-t border-slate-200/70 bg-white/80 px-6 py-4 text-xs text-slate-600">
          <center>WasteTrack lets keep our country clean</center>
          </div>
        </div>
      </div>
    </div>
  );
}
