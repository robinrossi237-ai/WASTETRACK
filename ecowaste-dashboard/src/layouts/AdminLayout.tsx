import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { connectRealtimeStream } from '@/api/realtimeApi';
import { useAuth } from '@/auth/AuthContext';
import { userApi, type AdminStats } from '@/api/userApi';
import { ClipboardIcon, DashboardIcon, GiftIcon, MapIcon, MegaphoneIcon, ReportIcon, ShieldIcon, TagIcon, TruckIcon, TrophyIcon, UsersIcon } from '@/components/icons';
import { ADMIN_REALTIME_REFRESH_EVENT } from '@/hooks/useAdminRealtimeRefresh';

const EVENT_TAB_MAP: Record<string, string[]> = {
  'report.updated': ['/admin/reports', '/admin/user-rankings'],
  'pickup.updated': ['/admin/pickups', '/admin/user-rankings'],
  'assignment.updated': ['/admin/assignments', '/admin/user-rankings'],
  'reward.updated': ['/admin/rewards'],
  'notification.created': ['/admin/notifications'],
  'notification.read': ['/admin/notifications'],
  'user.login': ['/admin/users'],
  'collector.application.submitted': ['/admin/users'],
  'collector.application.reviewed': ['/admin/users']
};

const toSidebarTabPath = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'admin' || !segments[1]) return pathname;
  return `/admin/${segments[1]}`;
};

const getTabsForEvent = (eventType: string): string[] => {
  const mapped = EVENT_TAB_MAP[eventType] ?? [];
  return ['/admin/dashboard', ...mapped];
};

export default function AdminLayout() {
  const { token, user } = useAuth();
  const previousStatsRef = useRef<AdminStats | null>(null);
  const activeTabRef = useRef<string>('/admin/dashboard');
  const [tabsWithUpdates, setTabsWithUpdates] = useState<Record<string, true>>({});
  const location = useLocation();

  useEffect(() => {
    const activeTab = toSidebarTabPath(location.pathname);
    activeTabRef.current = activeTab;
    setTabsWithUpdates((prev) => {
      if (!prev[activeTab]) return prev;
      const next = { ...prev };
      delete next[activeTab];
      return next;
    });
  }, [location.pathname]);

  const markTabUpdates = useCallback((tabs: string[]) => {
    setTabsWithUpdates((prev) => {
      const activeTab = activeTabRef.current;
      let changed = false;
      const next = { ...prev };
      for (const tab of tabs) {
        if (tab === activeTab) continue;
        if (!next[tab]) {
          next[tab] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const hasTabUpdate = useCallback((tabPath: string) => Boolean(tabsWithUpdates[tabPath]), [tabsWithUpdates]);

  useEffect(() => {
    if (!token || !user || user.role !== 'admin') {
      previousStatsRef.current = null;
      setTabsWithUpdates({});
      return;
    }

    let cancelled = false;
    let pollingId: number | null = null;
    const dispatchRealtimeRefresh = () => {
      window.dispatchEvent(new Event(ADMIN_REALTIME_REFRESH_EVENT));
    };

    const stopPolling = () => {
      if (pollingId == null) return;
      window.clearInterval(pollingId);
      pollingId = null;
    };

    const startPolling = () => {
      if (pollingId != null) return;
      pollingId = window.setInterval(() => void poll(), 15_000);
    };

    const poll = async () => {
      try {
        const next = await userApi.getAdminStats();
        if (cancelled) return;

        const previous = previousStatsRef.current;
        previousStatsRef.current = next;
        if (!previous) return;

        const newReports = next.totalWasteReports - previous.totalWasteReports;
        const newPickups = next.pendingPickupRequests - previous.pendingPickupRequests;
        const newOverduePickups = next.overduePickups - previous.overduePickups;
        const newUsers = next.totalUsers - previous.totalUsers;

        if (newReports > 0) {
          toast.success(newReports === 1 ? 'New waste report received' : `${newReports} new waste reports received`);
          markTabUpdates(['/admin/dashboard', '/admin/reports']);
        }

        if (newPickups > 0) {
          toast.success(newPickups === 1 ? 'New pickup request submitted' : `${newPickups} new pickup requests submitted`);
          markTabUpdates(['/admin/dashboard', '/admin/pickups']);
        }

        if (newOverduePickups > 0) {
          toast.error(
            newOverduePickups === 1
              ? '1 pickup request became overdue'
              : `${newOverduePickups} pickup requests became overdue`
          );
          markTabUpdates(['/admin/dashboard', '/admin/pickups']);
        }

        if (newUsers > 0) {
          markTabUpdates(['/admin/dashboard', '/admin/users']);
        }

        dispatchRealtimeRefresh();
      } catch {
        // Ignore polling errors to avoid toast spam.
      }
    };

    startPolling();
    void poll();

    const disconnectRealtime = connectRealtimeStream({
      token,
      onOpen: () => {
        stopPolling();
      },
      onError: () => {
        startPolling();
      },
      onEvent: (event) => {
        if (event.type === 'connected' || event.type === 'heartbeat') {
          return;
        }
        if (event.type === 'collector.application.submitted') {
          toast.success('New collector application pending validation');
        }
        if (event.type === 'collector.application.reviewed') {
          toast.success('Collector application review updated');
        }
        markTabUpdates(getTabsForEvent(event.type));
        dispatchRealtimeRefresh();
        void poll();
      }
    });

    return () => {
      cancelled = true;
      stopPolling();
      disconnectRealtime?.();
    };
  }, [markTabUpdates, token, user?.id, user?.role]);

  return (
    <div className="min-h-screen flex">
      <Sidebar
        title="Admin"
        items={[
          { label: 'Dashboard', to: '/admin/dashboard', icon: <DashboardIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/dashboard') },
          { label: 'Users', to: '/admin/users', icon: <UsersIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/users') },
          { label: 'Waste Reports', to: '/admin/reports', icon: <ReportIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/reports') },
          { label: 'Pickups', to: '/admin/pickups', icon: <TruckIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/pickups') },
          { label: 'Assignments', to: '/admin/assignments', icon: <ClipboardIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/assignments') },
          { label: 'User Rankings', to: '/admin/user-rankings', icon: <TrophyIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/user-rankings') },
          { label: 'Map', to: '/admin/map', icon: <MapIcon className="h-5 w-5" /> },
          { label: 'Rewards', to: '/admin/rewards', icon: <GiftIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/rewards') },
          { label: 'Plans', to: '/admin/plans', icon: <TagIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/plans') },
          { label: 'Subscriptions', to: '/admin/subscription-requests', icon: <ClipboardIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/subscription-requests') },
          { label: 'Notifications', to: '/admin/notifications', icon: <MegaphoneIcon className="h-5 w-5" />, hasUpdate: hasTabUpdate('/admin/notifications') },
          { label: 'Audit Log', to: '/admin/audit', icon: <ShieldIcon className="h-5 w-5" /> }
        ]}
      />
      <div className="flex-1 min-w-0">
        <Topbar title="WasteTrack Operations" />
        <main className="p-6">
          <div className="mx-auto max-w-7xl">
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
