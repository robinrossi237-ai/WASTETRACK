import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireRole } from './auth/RequireRole';
import { useAuth } from './auth/AuthContext';
import AdminLayout from './layouts/AdminLayout';

import LoginPage from './pages/auth/LoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminPickupsPage from './pages/admin/AdminPickupsPage';
import AdminAssignmentsPage from './pages/admin/AdminAssignmentsPage';
import AdminRewardsPage from './pages/admin/AdminRewardsPage';
import AdminMapPage from './pages/admin/AdminMapPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import AdminCollectorRankingPage from './pages/admin/AdminCollectorRankingPage';

import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

const RoleRedirect = () => <Navigate to="/login" replace />;

export default function App() {
  const { isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="map" element={<AdminMapPage />} />
        <Route path="pickups" element={<AdminPickupsPage />} />
        <Route path="assignments" element={<AdminAssignmentsPage />} />
        <Route path="rewards" element={<AdminRewardsPage />} />
        <Route path="user-rankings" element={<AdminCollectorRankingPage />} />
        <Route path="collector-ranking" element={<Navigate to="/admin/user-rankings" replace />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
