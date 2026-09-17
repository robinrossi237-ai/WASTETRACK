import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { useApp } from '@/lib/context';
import * as storage from '@/lib/storage';
import {
  addPushResponseListener,
  ensurePushNotificationHandler,
  getLastPushResponse,
  getPushNavigationTarget,
  registerPushTokenWithBackend
} from '@/lib/push-notifications';

export function PushNotificationsGate() {
  const { user } = useApp();
  const userId = user?.id;
  const router = useRouter();
  const didHandleInitialResponse = useRef(false);

  const navigateFromResponse = useCallback(
    (response: Parameters<typeof getPushNavigationTarget>[0]) => {
      const target = getPushNavigationTarget(response);
      if (target.path) {
        if (target.params) {
          router.push({
            pathname: target.path as any,
            params: target.params
          });
          return;
        }
        router.push(target.path as any);
        return;
      }
    },
    [router]
  );

  useEffect(() => {
    void ensurePushNotificationHandler();
  }, []);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    void addPushResponseListener((response) => {
      navigateFromResponse(response);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unsubscribe = cleanup;
    });

    if (!didHandleInitialResponse.current) {
      didHandleInitialResponse.current = true;
      void getLastPushResponse().then((response) => {
        if (response) {
          navigateFromResponse(response);
        }
      });
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [navigateFromResponse]);

useEffect(() => {
    if (!userId || Platform.OS === 'web') {
      return;
    }

    let cancelled = false;
    void storage.getPushEnabled(userId).then((enabled) => {
      if (!enabled || cancelled) return;
      void registerPushTokenWithBackend();
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
