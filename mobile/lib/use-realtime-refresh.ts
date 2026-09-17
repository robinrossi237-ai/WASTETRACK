import { useEffect, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { connectRealtimeStream } from '@/lib/realtime-client';

type UseRealtimeRefreshOptions = {
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
  pollMs?: number;
  eventTypes?: string[];
};

const DEFAULT_POLL_MS = 30_000;

export const useRealtimeRefresh = ({
  enabled,
  onRefresh,
  pollMs = DEFAULT_POLL_MS,
  eventTypes
}: UseRealtimeRefreshOptions) => {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const eventFilterKey = useMemo(
    () => (eventTypes && eventTypes.length > 0 ? eventTypes.slice().sort().join('|') : ''),
    [eventTypes]
  );

  useEffect(() => {
    if (!enabled) return;

    let isCancelled = false;
    let disconnect: (() => void) | null = null;

    const triggerRefresh = () => {
      if (isCancelled) return;
      if (appStateRef.current !== 'active') return;
      if (isRefreshingRef.current) {
        pendingRefreshRef.current = true;
        return;
      }

      isRefreshingRef.current = true;
      void Promise.resolve(onRefreshRef.current())
        .catch(() => {
          // Best effort refresh.
        })
        .finally(() => {
          isRefreshingRef.current = false;
          if (pendingRefreshRef.current && !isCancelled) {
            pendingRefreshRef.current = false;
            triggerRefresh();
          }
        });
    };

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      if (!wasActive && nextState === 'active') {
        triggerRefresh();
      }
    });

    const pollingId = pollMs > 0
      ? setInterval(() => {
        triggerRefresh();
      }, pollMs)
      : null;

    void connectRealtimeStream({
      onEvent: (event) => {
        if (event.type === 'heartbeat' || event.type === 'connected') {
          return;
        }
        const filterTypes = eventFilterKey.length > 0 ? eventFilterKey.split('|') : null;
        if (filterTypes !== null && !filterTypes.includes(event.type)) {
          return;
        }
        triggerRefresh();
      }
    }).then((cleanup) => {
      if (isCancelled) {
        cleanup?.();
        return;
      }
      disconnect = cleanup;
    });

    return () => {
      isCancelled = true;
      if (pollingId) {
        clearInterval(pollingId);
      }
      appStateSubscription.remove();
      disconnect?.();
      pendingRefreshRef.current = false;
      isRefreshingRef.current = false;
    };
  }, [enabled, pollMs, eventFilterKey]);
};
