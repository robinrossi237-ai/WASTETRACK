import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User, PickupRequest, Report, ScheduleItem } from './types';

export type ThemePreference = {
  mode: 'auto' | 'manual';
  manualTheme: 'light' | 'dark';
};

export type SchedulePreference = {
  timeWindow: string | null;
};

const KEYS = {
  USER: 'ecowaste_user',
  TOKEN: 'ecowaste_token',
  PUSH_TOKEN: 'ecowaste_push_token',
  PUSH_PROMPTED: 'ecowaste_push_prompted',
  PUSH_ENABLED: 'ecowaste_push_enabled',
  PICKUPS: 'ecowaste_pickups',
  REPORTS: 'ecowaste_reports',
  SCHEDULE: 'ecowaste_schedule',
  LAST_SEEN_REWARD_ID: 'ecowaste_last_seen_reward_id',
  LAST_SEEN_NOTIFICATION_ID: 'ecowaste_last_seen_notification_id',
  THEME_PREFERENCE: 'ecowaste_theme_preference',
  SCHEDULE_PREFERENCE: 'ecowaste_schedule_preference',
  COLLECTOR_ACTION_QUEUE: 'ecowaste_collector_action_queue',
  LANGUAGE_PREFERENCE: 'ecowaste_language_preference',
  COLLECTOR_APPROVAL_SEEN: 'ecowaste_collector_approval_seen',
  EDUCATION_CONTENT: 'ecowaste_education_content',
  EDUCATION_CONTENT_TS: 'ecowaste_education_content_ts',
};

const rewardKeyForUser = (userId?: string | null) =>
  userId ? `${KEYS.LAST_SEEN_REWARD_ID}:${userId}` : KEYS.LAST_SEEN_REWARD_ID;
const notificationKeyForUser = (userId?: string | null) =>
  userId ? `${KEYS.LAST_SEEN_NOTIFICATION_ID}:${userId}` : KEYS.LAST_SEEN_NOTIFICATION_ID;

const schedulePreferenceKeyForUser = (userId?: string | null) =>
  userId ? `${KEYS.SCHEDULE_PREFERENCE}:${userId}` : KEYS.SCHEDULE_PREFERENCE;

const pushEnabledKeyForUser = (userId?: string | null) =>
  userId ? `${KEYS.PUSH_ENABLED}:${userId}` : KEYS.PUSH_ENABLED;

const collectorApprovalSeenKeyForUser = (userId?: string | null) =>
  userId ? `${KEYS.COLLECTOR_APPROVAL_SEEN}:${userId}` : KEYS.COLLECTOR_APPROVAL_SEEN;

const isLanguageCode = (value: unknown): value is 'en' | 'fr' =>
  value === 'en' || value === 'fr';

export async function getLanguagePreference(): Promise<'en' | 'fr' | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LANGUAGE_PREFERENCE);
    return isLanguageCode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveLanguagePreference(value: 'en' | 'fr'): Promise<void> {
  await AsyncStorage.setItem(KEYS.LANGUAGE_PREFERENCE, value);
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(KEYS.TOKEN);
    if (secureToken) {
      return secureToken;
    }
    const legacyToken = await AsyncStorage.getItem(KEYS.TOKEN);
    if (legacyToken) {
      await SecureStore.setItemAsync(KEYS.TOKEN, legacyToken);
      await AsyncStorage.removeItem(KEYS.TOKEN);
      return legacyToken;
    }
    return null;
  } catch {
    try {
      return await AsyncStorage.getItem(KEYS.TOKEN);
    } catch {
      return null;
    }
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEYS.TOKEN, token);
    await AsyncStorage.removeItem(KEYS.TOKEN);
  } catch {
    await AsyncStorage.setItem(KEYS.TOKEN, token);
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEYS.TOKEN);
  } catch {
    // Best effort clear.
  }
  await AsyncStorage.removeItem(KEYS.TOKEN);
}

export async function getPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.PUSH_TOKEN);
  } catch {
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.PUSH_TOKEN, token);
}

export async function clearPushToken(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.PUSH_TOKEN);
}

export async function getPushPrompted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEYS.PUSH_PROMPTED)) === 'true';
  } catch {
    return false;
  }
}

export async function setPushPrompted(value: boolean): Promise<void> {
  if (!value) {
    await AsyncStorage.removeItem(KEYS.PUSH_PROMPTED);
    return;
  }
  await AsyncStorage.setItem(KEYS.PUSH_PROMPTED, 'true');
}

export async function getPushEnabled(userId?: string | null): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(pushEnabledKeyForUser(userId));
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const existingToken = await getPushToken();
    return !!existingToken;
  } catch {
    return false;
  }
}

export async function setPushEnabled(value: boolean, userId?: string | null): Promise<void> {
  const key = pushEnabledKeyForUser(userId);
  if (!value) {
    await AsyncStorage.setItem(key, 'false');
    return;
  }
  await AsyncStorage.setItem(key, 'true');
}

export async function getCollectorApprovalSeen(userId?: string | null): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(collectorApprovalSeenKeyForUser(userId));
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setCollectorApprovalSeen(value: boolean, userId?: string | null): Promise<void> {
  const key = collectorApprovalSeenKeyForUser(userId);
  if (!value) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, 'true');
}

export async function getUser(): Promise<User | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.USER);
}

export async function getPickups(): Promise<PickupRequest[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PICKUPS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function savePickup(pickup: PickupRequest): Promise<void> {
  const pickups = await getPickups();
  const index = pickups.findIndex(p => p.id === pickup.id);
  if (index >= 0) {
    pickups[index] = pickup;
  } else {
    pickups.unshift(pickup);
  }
  await AsyncStorage.setItem(KEYS.PICKUPS, JSON.stringify(pickups));
}

export async function savePickups(pickups: PickupRequest[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.PICKUPS, JSON.stringify(pickups));
}

export async function deletePickup(id: string): Promise<void> {
  const pickups = await getPickups();
  const filtered = pickups.filter(p => p.id !== id);
  await AsyncStorage.setItem(KEYS.PICKUPS, JSON.stringify(filtered));
}

export async function clearPickups(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.PICKUPS);
}

export async function getReports(): Promise<Report[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.REPORTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveReport(report: Report): Promise<void> {
  const reports = await getReports();
  const index = reports.findIndex(r => r.id === report.id);
  if (index >= 0) {
    reports[index] = report;
  } else {
    reports.unshift(report);
  }
  await AsyncStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
}

export async function saveReports(reports: Report[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
}

export async function clearReports(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.REPORTS);
}

export async function getSchedule(neighborhood: string): Promise<ScheduleItem[]> {
  const defaultSchedule: ScheduleItem[] = [
    { id: '1', neighborhood, wasteType: 'household', dayOfWeek: 1, time: '08:00' },
    { id: '2', neighborhood, wasteType: 'plastic', dayOfWeek: 2, time: '08:00' },
    { id: '3', neighborhood, wasteType: 'organic', dayOfWeek: 3, time: '08:00' },
    { id: '4', neighborhood, wasteType: 'electronic', dayOfWeek: 4, time: '14:00' },
    { id: '5', neighborhood, wasteType: 'household', dayOfWeek: 5, time: '08:00' },
  ];
  return defaultSchedule;
}

export async function updateUserPoints(points: number): Promise<void> {
  const user = await getUser();
  if (user) {
    user.points += points;
    await saveUser(user);
  }
}

export async function addBadgeToUser(badgeId: string): Promise<void> {
  const user = await getUser();
  if (user && !user.badges.includes(badgeId)) {
    user.badges.push(badgeId);
    await saveUser(user);
  }
}

export async function getLastSeenRewardId(userId?: string | null): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(rewardKeyForUser(userId));
  } catch {
    return null;
  }
}

export async function saveLastSeenRewardId(id: string | null, userId?: string | null): Promise<void> {
  if (!id) {
    await AsyncStorage.removeItem(rewardKeyForUser(userId));
    return;
  }
  await AsyncStorage.setItem(rewardKeyForUser(userId), id);
}

export async function getLastSeenNotificationId(userId?: string | null): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(notificationKeyForUser(userId));
  } catch {
    return null;
  }
}

export async function saveLastSeenNotificationId(id: string | null, userId?: string | null): Promise<void> {
  if (!id) {
    await AsyncStorage.removeItem(notificationKeyForUser(userId));
    return;
  }
  await AsyncStorage.setItem(notificationKeyForUser(userId), id);
}

const isThemePreference = (value: unknown): value is ThemePreference => {
  if (typeof value !== 'object' || value === null) return false;
  const maybe = value as Record<string, unknown>;
  const mode = maybe.mode;
  const manualTheme = maybe.manualTheme;
  return (
    (mode === 'auto' || mode === 'manual') &&
    (manualTheme === 'light' || manualTheme === 'dark')
  );
};

const isSchedulePreference = (value: unknown): value is SchedulePreference => {
  if (typeof value !== 'object' || value === null) return false;
  const maybe = value as Record<string, unknown>;
  const timeWindow = maybe.timeWindow;
  return timeWindow === null || typeof timeWindow === 'string';
};

export async function getThemePreference(): Promise<ThemePreference | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.THEME_PREFERENCE);
    if (!data) return null;
    const parsed = JSON.parse(data) as unknown;
    return isThemePreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME_PREFERENCE, JSON.stringify(pref));
}

export async function getSchedulePreference(userId?: string | null): Promise<SchedulePreference | null> {
  try {
    const data = await AsyncStorage.getItem(schedulePreferenceKeyForUser(userId));
    if (!data) return null;
    const parsed = JSON.parse(data) as unknown;
    return isSchedulePreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSchedulePreference(
  pref: SchedulePreference | null,
  userId?: string | null
): Promise<void> {
  const key = schedulePreferenceKeyForUser(userId);
  if (!pref) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(pref));
}

export type CollectorQueuedActionType =
  | 'pickup_start'
  | 'pickup_complete'
  | 'pickup_issue'
  | 'report_clean'
  | 'report_issue';

export type CollectorQueuedAction = {
  id: string;
  type: CollectorQueuedActionType;
  targetId: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export async function getCollectorActionQueue(): Promise<CollectorQueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.COLLECTOR_ACTION_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry === 'object' && entry !== null)
      .map((entry) => {
        const value = entry as Partial<CollectorQueuedAction>;
        return {
          id: typeof value.id === 'string' ? value.id : `${Date.now()}-${Math.random()}`,
          type: value.type as CollectorQueuedActionType,
          targetId: typeof value.targetId === 'string' ? value.targetId : '',
          payload: typeof value.payload === 'object' && value.payload !== null ? value.payload : undefined,
          createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
          attempts: typeof value.attempts === 'number' && Number.isFinite(value.attempts) ? value.attempts : 0,
          lastError: typeof value.lastError === 'string' ? value.lastError : undefined,
        };
      })
      .filter((entry) => !!entry.targetId);
  } catch {
    return [];
  }
}

export async function saveCollectorActionQueue(queue: CollectorQueuedAction[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.COLLECTOR_ACTION_QUEUE, JSON.stringify(queue));
}

export async function enqueueCollectorAction(
  action: Omit<CollectorQueuedAction, 'id' | 'createdAt' | 'attempts'>
): Promise<CollectorQueuedAction> {
  const queue = await getCollectorActionQueue();
  const existing = queue.find(
    (item) =>
      item.type === action.type &&
      item.targetId === action.targetId &&
      JSON.stringify(item.payload ?? {}) === JSON.stringify(action.payload ?? {})
  );
  if (existing) {
    return existing;
  }

  const next: CollectorQueuedAction = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: action.type,
    targetId: action.targetId,
    payload: action.payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: action.lastError,
  };
  await saveCollectorActionQueue([...queue, next]);
  return next;
}

export async function replaceCollectorActionQueue(queue: CollectorQueuedAction[]): Promise<void> {
  await saveCollectorActionQueue(queue);
}

export async function clearCollectorActionQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.COLLECTOR_ACTION_QUEUE);
}

export type EducationContentItem = {
  id: string;
  title: string;
  body: string;
  media_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function getEducationContent(): Promise<EducationContentItem[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.EDUCATION_CONTENT);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveEducationContent(content: EducationContentItem[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.EDUCATION_CONTENT, JSON.stringify(content));
  await AsyncStorage.setItem(KEYS.EDUCATION_CONTENT_TS, Date.now().toString());
}

export async function getEducationContentTs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.EDUCATION_CONTENT_TS);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export async function clearEducationContent(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.EDUCATION_CONTENT);
  await AsyncStorage.removeItem(KEYS.EDUCATION_CONTENT_TS);
}
