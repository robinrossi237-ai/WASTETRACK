import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { apiRequest } from '@/lib/api-client';
import * as storage from '@/lib/storage';

type PushPlatform = 'ios' | 'android' | 'web';
type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

type ConstantsWithEas = typeof Constants & {
  easConfig?: {
    projectId?: string | null;
  };
};

export type PushNavigationTarget = {
  path?: string;
  params?: Record<string, string>;
};

let notificationHandlerConfigured = false;
let notificationsModulePromise: Promise<NotificationsModule> | null = null;

const normalizeProjectId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveProjectId = (): string | undefined => {
  const fromEnv = normalizeProjectId(process.env.EXPO_PUBLIC_EAS_PROJECT_ID);
  if (fromEnv) return fromEnv;

  const fromEas = normalizeProjectId((Constants as ConstantsWithEas).easConfig?.projectId);
  if (fromEas) return fromEas;

  const maybeExtra = Constants.expoConfig?.extra as
    | {
        eas?: {
          projectId?: string | null;
        };
      }
    | undefined;
  return normalizeProjectId(maybeExtra?.eas?.projectId);
};

const resolvePlatform = (): PushPlatform => {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
};

const isExpoGoRuntime = (): boolean => Constants.appOwnership === 'expo';

const loadNotificationsModule = async (): Promise<NotificationsModule | null> => {
  if (Platform.OS === 'web' || isExpoGoRuntime()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  return notificationsModulePromise;
};

const parsePathParams = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entry]) => typeof entry === 'string' && entry.length > 0
  );
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Record<string, string>;
};

const extractData = (response: NotificationResponse): Record<string, unknown> => {
  const data = response.notification.request.content.data;
  if (!data || typeof data !== 'object') return {};
  return data as Record<string, unknown>;
};

export const ensurePushNotificationHandler = async (): Promise<void> => {
  if (notificationHandlerConfigured) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });

  notificationHandlerConfigured = true;
};

export const registerPushTokenWithBackend = async (
  options?: { forcePrompt?: boolean }
): Promise<string | null> => {
  if (Platform.OS === 'web' || isExpoGoRuntime()) {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return null;
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermission.status;
    if (finalStatus !== 'granted') {
      if (!options?.forcePrompt) {
        return null;
      }
      const requestedPermission = await Notifications.requestPermissionsAsync();
      await storage.setPushPrompted(true);
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0D9668'
      });
    }

    const projectId = resolveProjectId();
    if (!projectId && !isExpoGoRuntime()) {
      return null;
    }

    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResult.data;
    const existingToken = await storage.getPushToken();

    if (existingToken && existingToken !== token) {
      try {
        await unregisterPushTokenFromBackend(existingToken);
      } catch {
        // Best effort: continue with registering current token.
      }
    }

    await apiRequest<{ success: true }>('POST', '/push-tokens', {
      token,
      platform: resolvePlatform()
    });
    await storage.savePushToken(token);

    return token;
  } catch (err) {
    console.warn('Push registration failed', err);
    return null;
  }
};

export const unregisterPushTokenFromBackend = async (token: string): Promise<void> => {
  await apiRequest<{ success: true }>('DELETE', `/push-tokens/${encodeURIComponent(token)}`);
};

export const unregisterSavedPushTokenFromBackend = async (): Promise<void> => {
  const token = await storage.getPushToken();
  if (!token) {
    return;
  }

  try {
    await unregisterPushTokenFromBackend(token);
  } finally {
    await storage.clearPushToken();
  }
};

export const getPushNavigationTarget = (
  response: NotificationResponse
): PushNavigationTarget => {
  const data = extractData(response);
  const explicitPath = typeof data.path === 'string' && data.path.startsWith('/') ? data.path : undefined;
  const explicitParams = parsePathParams(data.params);

  if (explicitPath) {
    return { path: explicitPath, params: explicitParams };
  }

  const type = typeof data.type === 'string' ? data.type : '';
  if (type === 'assignment.updated') {
    const assignmentId = typeof data.assignment_id === 'string' ? data.assignment_id : undefined;
    if (assignmentId) {
      return { path: '/(collector)/detail', params: { id: assignmentId, kind: 'pickup' } };
    }
  }

  if (type === 'report.updated') {
    const reportId = typeof data.report_id === 'string' ? data.report_id : undefined;
    if (reportId) {
      return { path: '/(collector)/detail', params: { id: reportId, kind: 'report' } };
    }
  }

  return {};
};

export const getLastPushResponse = async (): Promise<NotificationResponse | null> => {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return null;
  }

  return Notifications.getLastNotificationResponseAsync();
};

export const addPushResponseListener = (
  listener: (response: NotificationResponse) => void
): Promise<() => void> => {
  return loadNotificationsModule().then((Notifications) => {
    if (!Notifications) {
      return () => undefined;
    }

    const responseListener = Notifications.addNotificationResponseReceivedListener(listener);
    return () => {
      responseListener.remove();
    };
  });
};
