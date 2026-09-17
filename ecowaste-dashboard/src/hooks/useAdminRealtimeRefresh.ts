import { useEffect, useRef } from 'react';

export const ADMIN_REALTIME_REFRESH_EVENT = 'ecowaste:admin-realtime-refresh';

type UseAdminRealtimeRefreshOptions = {
  enabled?: boolean;
  throttleMs?: number;
};

export const useAdminRealtimeRefresh = (
  refresh: () => void | Promise<void>,
  options: UseAdminRealtimeRefreshOptions = {}
) => {
  const { enabled = true, throttleMs = 1200 } = options;
  const refreshRef = useRef(refresh);
  const lastTriggeredAtRef = useRef(0);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onRefreshSignal = () => {
      const now = Date.now();
      if (now - lastTriggeredAtRef.current < throttleMs) return;
      lastTriggeredAtRef.current = now;
      void refreshRef.current();
    };

    window.addEventListener(ADMIN_REALTIME_REFRESH_EVENT, onRefreshSignal);
    return () => {
      window.removeEventListener(ADMIN_REALTIME_REFRESH_EVENT, onRefreshSignal);
    };
  }, [enabled, throttleMs]);
};
