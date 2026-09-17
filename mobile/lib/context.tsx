import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef } from 'react';
import {
  BADGES,
  type CollectorApplicationSubmission,
  PickupRequest,
  type PickupQuota,
  type RegisterResult,
  Report,
  ReportPriority,
  type SubscriptionPlan,
  User,
  UserRole,
  WasteType
} from './types';
import * as storage from './storage';
import { ApiError, apiRequest, setSessionExpiredHandler, resetSessionExpiredState } from './api-client';
import { RewardCelebrationModal } from '@/components/RewardCelebrationModal';
import { useToast } from '@/lib/toast-context';
import { useRealtimeRefresh } from '@/lib/use-realtime-refresh';
import { unregisterSavedPushTokenFromBackend } from '@/lib/push-notifications';
import { uploadOptionalMediaUri } from '@/lib/media-upload';
import { normalizeMediaUrl } from '@/lib/media-url';
import { isReasonablePhoneStyleLocation, toPhoneStyleLocation } from '@/lib/location-label';

type ApiResidentPickupRow = {
  id: string;
  user_id: string;
  waste_type: string;
  scheduled_date: string;
  pickup_category: string | null;
  distance_km: number | null;
  description: string | null;
  address: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  assigned_collector_id?: string | null;
  assigned_collector_name?: string | null;
  assigned_collector_phone?: string | null;
  resident_confirmation_status?: 'pending' | 'approved' | 'rejected' | null;
  resident_confirmed_at?: string | null;
  resident_rejection_note?: string | null;
  completion_submitted_at?: string | null;
  completion_photo_url?: string | null;
  completion_note?: string | null;
  completed_at?: string | null;
  status: PickupRequest['status'];
  created_at: string;
};

type ApiResidentReportRow = {
  id: string;
  user_id: string;
  photo_url: string | null;
  report_type: string | null;
  location_text: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  priority?: ReportPriority;
  assigned_collector_id?: string | null;
  assigned_collector_name?: string | null;
  assigned_collector_phone?: string | null;
  resident_confirmation_status?: 'pending' | 'approved' | 'rejected' | null;
  resident_confirmed_at?: string | null;
  resident_rejection_note?: string | null;
  cleaned_photo_url?: string | null;
  cleaned_note?: string | null;
  cleaned_at?: string | null;
  status: Report['status'];
  created_at: string;
};

type ApiResidentRewardRow = {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  related_entity_id: string | null;
  created_at: string;
};

type ApiNotificationRow = {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type ApiPickupQuotaRow = {
  plan: SubscriptionPlan;
  limit: number | null;
  used: number;
  remaining: number;
  isUnlimited: boolean;
};

const isWasteType = (value: string): value is WasteType =>
  (['household', 'plastic', 'organic', 'electronic', 'hazardous', 'metal', 'mixed'] as const).includes(value as WasteType);

const isSubscriptionPlan = (value: string | undefined | null): value is SubscriptionPlan =>
  (['free', 'plus', 'pro'] as const).includes(value as SubscriptionPlan);

const isReportType = (value: string): value is Report['type'] =>
  (['illegal_dumping', 'overflowing_bin', 'other'] as const).includes(value as Report['type']);

const normalizeReportType = (value?: string | null): Report['type'] | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const slug = trimmed.replace(/[-\s]+/g, '_');
  if (isReportType(slug)) return slug;

  const hasIllegal = slug.includes('illegal');
  const hasDump = slug.includes('dump');
  const hasUnauthorized = slug.includes('unauthor') || slug.includes('unauthorized');
  if (hasDump && (hasIllegal || hasUnauthorized)) {
    return 'illegal_dumping';
  }

  const hasOverflow = slug.includes('overflow');
  const hasBin = slug.includes('bin');
  if (hasOverflow && hasBin) {
    return 'overflowing_bin';
  }

  if (slug.includes('other')) {
    return 'other';
  }

  return null;
};

const inferReportTypeFromText = (value?: string | null): Report['type'] | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if ((normalized.includes('illegal') || normalized.includes('unauthor')) && normalized.includes('dump')) {
    return 'illegal_dumping';
  }
  if (normalized.includes('overflow') && normalized.includes('bin')) {
    return 'overflowing_bin';
  }
  if (normalized.includes('other')) {
    return 'other';
  }
  return null;
};

const extractLocationFromDescription = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const legacyTagged = value.match(/\[location\]\s*([^\n]+)/i)?.[1]?.trim();
  if (legacyTagged && legacyTagged.length > 0) {
    return legacyTagged;
  }
  const match = value.match(/^\s*location\s*[:\-]\s*(.+)$/im);
  const resolved = match?.[1]?.trim();
  if (resolved && resolved.length > 0) {
    return resolved;
  }
  const looseMatch = value.match(/\b(?:at|near|around|in)\s+([a-z0-9][a-z0-9,\s.'-]{2,80})/i)?.[1]?.trim();
  return looseMatch && looseMatch.length > 0 ? looseMatch : null;
};

const parseLegacyReportDescription = (
  value?: string | null
): { cleanDescription: string; locationFromDescription: string | null; typeFromDescription: Report['type'] | null } => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return { cleanDescription: '', locationFromDescription: null, typeFromDescription: null };
  }

  const lines = normalized.split(/\r?\n/);
  let cursor = 0;
  let locationFromDescription: string | null = null;
  let typeFromDescription: Report['type'] | null = null;

  while (cursor < lines.length) {
    const line = lines[cursor]?.trim() ?? '';
    const typeMatch = line.match(/^\[type\]\s+(.+)$/i);
    if (typeMatch) {
      typeFromDescription = normalizeReportType(typeMatch[1]?.trim());
      cursor += 1;
      continue;
    }

    const locationMatch = line.match(/^\[location\]\s+(.+)$/i);
    if (locationMatch) {
      locationFromDescription = locationMatch[1]?.trim() || null;
      cursor += 1;
      continue;
    }

    break;
  }

  if (cursor === 0) {
    return { cleanDescription: normalized, locationFromDescription: null, typeFromDescription: null };
  }

  const cleanDescription = lines.slice(cursor).join('\n').trim();
  return { cleanDescription, locationFromDescription, typeFromDescription };
};

const isCoordinateLikeText = (value?: string | null): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(normalized);
};

const normalizeReadableLocation = (value?: string | null): string => {
  const normalized = toPhoneStyleLocation(value);
  if (!normalized || isCoordinateLikeText(normalized) || !isReasonablePhoneStyleLocation(normalized)) {
    return '';
  }
  return normalized;
};

const isReportStatus = (value: string): value is Report['status'] =>
  (['reported', 'verified', 'assigned', 'cleaned', 'approved', 'rejected', 'cancelled'] as const).includes(
    value as Report['status']
  );

const formatScheduledDateTime = (value: string): { scheduledDate: string; scheduledTime: string } => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { scheduledDate: value, scheduledTime: "" };
  }

  return {
    scheduledDate: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    scheduledTime: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
};

const deriveBadges = (input: { points: number; pickupsCount: number; reportsCount: number }): string[] => {
  const earned = new Set<string>();

  if (input.pickupsCount > 0) {
    earned.add('first_pickup');
  }

  if (input.reportsCount >= 5) {
    earned.add('reporter');
  }

  for (const badge of BADGES) {
    if (badge.pointsRequired > 0 && input.points >= badge.pointsRequired) {
      earned.add(badge.id);
    }
  }

  return Array.from(earned);
};

const buildScheduledDateTimeIso = (scheduledDate: string, scheduledTime: string): string => {
  const datePart = scheduledDate.trim();
  const timePart = scheduledTime.trim();

  const candidate = timePart ? `${datePart}T${timePart}` : datePart;
  let parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime()) && timePart) {
    parsed = new Date(`${datePart}T${timePart}:00`);
  }

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid pickup date/time. Use YYYY-MM-DD and HH:mm.');
  }

  return parsed.toISOString();
};

const normalizeCachedPickupMedia = (pickup: PickupRequest): PickupRequest => {
  const normalizedPhotoUri = normalizeMediaUrl(pickup.photoUri);
  const normalizedCompletionPhotoUri = normalizeMediaUrl(pickup.completionPhotoUri);

  return {
    ...pickup,
    photoUri: normalizedPhotoUri,
    completionPhotoUri:
      pickup.completionPhotoUri === undefined
        ? undefined
        : normalizedCompletionPhotoUri ?? null,
  };
};

const normalizeCachedReportMedia = (report: Report): Report => {
  const normalizedPhotoUri = normalizeMediaUrl(report.photoUri);
  const normalizedCleanedPhotoUri = normalizeMediaUrl(report.cleanedPhotoUri);

  return {
    ...report,
    photoUri: normalizedPhotoUri,
    cleanedPhotoUri:
      report.cleanedPhotoUri === undefined
        ? undefined
        : normalizedCleanedPhotoUri ?? null,
  };
};

interface AppContextValue {
  user: User | null;
  pickups: PickupRequest[];
  reports: Report[];
  pickupQuota: PickupQuota | null;
  schedulePreference: storage.SchedulePreference | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    phone: string,
    role: UserRole,
    neighborhood: string
  ) => Promise<RegisterResult>;
  switchRole: (role: 'resident') => Promise<User>;
  updateProfile: (updates: { name?: string; phone?: string; neighborhood?: string }) => Promise<void>;
  setCollectorAutoLocationTracking: (enabled: boolean) => Promise<void>;
  setCollectorExitLocationCaptureEnabled: (enabled: boolean) => Promise<void>;
  createPickup: (pickup: Omit<PickupRequest, 'id' | 'userId' | 'createdAt' | 'status'>) => Promise<void>;
  updatePickup: (pickup: PickupRequest) => Promise<void>;
  deletePickup: (id: string) => Promise<void>;
  reschedulePickup: (id: string, isoDate: string) => Promise<void>;
  cancelPickup: (id: string) => Promise<void>;
  confirmPickupCompletion: (id: string, approved: boolean, note?: string) => Promise<void>;
  cancelReport: (id: string) => Promise<void>;
  confirmReportCleanup: (id: string, approved: boolean, note?: string) => Promise<void>;
  createReport: (report: Omit<Report, 'id' | 'userId' | 'createdAt' | 'status'>) => Promise<void>;
  addPoints: (points: number) => Promise<void>;
  updateSchedulePreference: (pref: storage.SchedulePreference | null) => Promise<void>;
  refreshPickupQuota: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [pickupQuota, setPickupQuota] = useState<PickupQuota | null>(null);
  const [schedulePreference, setSchedulePreference] = useState<storage.SchedulePreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rewardQueue, setRewardQueue] = useState<ApiResidentRewardRow[]>([]);
  const rewardsTrackingReady = useRef(false);
  const lastSeenRewardId = useRef<string | null>(null);
  const notificationsTrackingReady = useRef(false);
  const lastSeenNotificationId = useRef<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void (async () => {
        await Promise.all([
          storage.clearUser(),
          storage.clearAuthToken(),
          storage.clearPushToken(),
          storage.clearPickups(),
          storage.clearReports(),
          storage.clearCollectorActionQueue(),
        ]);
        setUser(null);
        setPickups([]);
        setReports([]);
        setPickupQuota(null);
        setSchedulePreference(null);
        setRewardQueue([]);
        toast.error("Your session has expired. Please sign in again.");
      })();
    });
    return () => setSessionExpiredHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
    }
    const [loadedUser, token] = await Promise.all([
      storage.getUser(),
      storage.getAuthToken(),
    ]);

    const storedSchedulePreference = loadedUser
      ? await storage.getSchedulePreference(loadedUser.id)
      : null;
    setSchedulePreference(storedSchedulePreference);

    if (!loadedUser || !token) {
      if (loadedUser && !token) {
        await Promise.all([
          storage.clearUser(),
          storage.clearPickups(),
          storage.clearReports(),
        ]);
      }

      setUser(null);
      setPickups([]);
      setReports([]);
      setPickupQuota(null);
      setSchedulePreference(null);
      if (!opts?.silent) {
        setIsLoading(false);
      }
      return;
    }

    setUser(loadedUser);
    let currentUser = loadedUser;
    let userNeedsSave = false;

    const [loadedPickups, loadedReports] = await Promise.all([
      storage.getPickups(),
      storage.getReports(),
    ]);
    const normalizedStoredPickups = loadedPickups.map(normalizeCachedPickupMedia);
    const normalizedStoredReports = loadedReports.map(normalizeCachedReportMedia);
    const didNormalizeStoredPickups = normalizedStoredPickups.some((pickup, index) => {
      const original = loadedPickups[index];
      return pickup.photoUri !== original?.photoUri || pickup.completionPhotoUri !== original?.completionPhotoUri;
    });
    const didNormalizeStoredReports = normalizedStoredReports.some((report, index) => {
      const original = loadedReports[index];
      return report.photoUri !== original?.photoUri || report.cleanedPhotoUri !== original?.cleanedPhotoUri;
    });
    setPickups(normalizedStoredPickups);
    setReports(normalizedStoredReports);

    if (loadedUser.role !== 'resident') {
      if (!opts?.silent) {
        setIsLoading(false);
      }
      return;
    }

    try {
      const [meResult, pickupsResult, reportsResult, rewardsResult, quotaResult] = await Promise.allSettled([
        apiRequest<ApiMeResponse>("GET", "/auth/me"),
        apiRequest<{ success: true; pickups: ApiResidentPickupRow[] }>("GET", "/resident/pickups"),
        apiRequest<{ success: true; reports: ApiResidentReportRow[] }>("GET", "/resident/reports"),
        apiRequest<{ success: true; rewards: ApiResidentRewardRow[] }>("GET", "/resident/rewards"),
        apiRequest<{ success: true; quota: ApiPickupQuotaRow }>("GET", "/resident/pickups/quota"),
      ]);

      const authError = [meResult, pickupsResult, reportsResult, rewardsResult].find(
        (result) => result.status === 'rejected'
          && result.reason instanceof ApiError
          && result.reason.status === 401
      );
      if (authError) {
        await Promise.all([
          storage.clearUser(),
          storage.clearAuthToken(),
          storage.clearPushToken(),
          storage.clearPickups(),
          storage.clearReports(),
        ]);
        setUser(null);
        setPickups([]);
        setReports([]);
        setPickupQuota(null);
        return;
      }

      const failures: string[] = [];
      const mePayload = meResult.status === 'fulfilled' ? meResult.value.user : null;
      if (meResult.status === 'rejected') failures.push('Profile');
      if (mePayload) {
        const nextFromMe: User = {
          ...currentUser,
          name: mePayload.name ?? currentUser.name,
          email: mePayload.email ?? currentUser.email,
          role: mePayload.role ?? currentUser.role,
          phone: mePayload.phone ?? undefined,
          neighborhood: normalizeReadableLocation(mePayload.area) || undefined,
          subscriptionPlan:
            mePayload.subscription_plan && isSubscriptionPlan(mePayload.subscription_plan)
              ? mePayload.subscription_plan
              : currentUser.subscriptionPlan,
          collectorVerificationStatus: mePayload.collector_verification_status ?? undefined,
          collectorVerificationNote: mePayload.collector_verification_note ?? undefined,
          collectorSubmittedAt: mePayload.collector_submitted_at ?? undefined,
          collectorVerifiedAt: mePayload.collector_verified_at ?? undefined,
          collectorAutoLocationTracking:
            typeof mePayload.collector_auto_location_tracking === "boolean"
              ? mePayload.collector_auto_location_tracking
              : currentUser.collectorAutoLocationTracking,
          collectorExitLocationCaptureEnabled:
            typeof mePayload.collector_exit_location_capture_enabled === "boolean"
              ? mePayload.collector_exit_location_capture_enabled
              : currentUser.collectorExitLocationCaptureEnabled,
        };
        const didChange =
          nextFromMe.name !== currentUser.name ||
          nextFromMe.email !== currentUser.email ||
          nextFromMe.role !== currentUser.role ||
          nextFromMe.phone !== currentUser.phone ||
          nextFromMe.neighborhood !== currentUser.neighborhood ||
          nextFromMe.subscriptionPlan !== currentUser.subscriptionPlan ||
          nextFromMe.collectorVerificationStatus !== currentUser.collectorVerificationStatus ||
          nextFromMe.collectorVerificationNote !== currentUser.collectorVerificationNote ||
          nextFromMe.collectorSubmittedAt !== currentUser.collectorSubmittedAt ||
          nextFromMe.collectorVerifiedAt !== currentUser.collectorVerifiedAt ||
          nextFromMe.collectorAutoLocationTracking !== currentUser.collectorAutoLocationTracking ||
          nextFromMe.collectorExitLocationCaptureEnabled !== currentUser.collectorExitLocationCaptureEnabled;
        if (didChange) {
          currentUser = nextFromMe;
          userNeedsSave = true;
        }
      }

      const pickupsPayload = pickupsResult.status === 'fulfilled' ? pickupsResult.value.pickups : null;
      const pickupsData = Array.isArray(pickupsPayload) ? pickupsPayload : null;
      if (!pickupsData) failures.push('Pickups');
      const reportsPayload = reportsResult.status === 'fulfilled' ? reportsResult.value.reports : null;
      const reportsData = Array.isArray(reportsPayload) ? reportsPayload : null;
      if (!reportsData) failures.push('Reports');
      const rewardsPayload = rewardsResult.status === 'fulfilled' ? rewardsResult.value.rewards : null;
      const rewardsData = Array.isArray(rewardsPayload) ? rewardsPayload : null;
      if (!rewardsData) failures.push('Rewards');

      const nextPickups = pickupsData
        ? pickupsData.map((p): PickupRequest => {
          const { scheduledDate, scheduledTime } = formatScheduledDateTime(p.scheduled_date);
          const wasteType = isWasteType(p.waste_type) ? p.waste_type : 'household';
          const pickupCategory =
            typeof p.pickup_category === 'string'
              && (['standard', 'bulk', 'hazardous'] as const).includes(p.pickup_category as any)
              ? (p.pickup_category as PickupRequest['pickupCategory'])
              : undefined;

          return {
            id: p.id,
            userId: p.user_id,
            wasteType,
            description: p.description ?? '',
            photoUri: normalizeMediaUrl(p.photo_url),
            pickupCategory,
            distanceKm: typeof p.distance_km === 'number' ? p.distance_km : undefined,
            scheduledAt: p.scheduled_date,
            scheduledDate,
            scheduledTime,
            address: normalizeReadableLocation(p.address) || '',
            latitude: p.latitude ?? undefined,
            longitude: p.longitude ?? undefined,
            assignedCollectorId: p.assigned_collector_id ?? undefined,
            assignedCollectorName: p.assigned_collector_name ?? undefined,
            assignedCollectorPhone: p.assigned_collector_phone ?? undefined,
            residentConfirmationStatus: p.resident_confirmation_status ?? undefined,
            residentConfirmedAt: p.resident_confirmed_at ?? undefined,
            residentRejectionNote: p.resident_rejection_note ?? undefined,
            completionSubmittedAt: p.completion_submitted_at ?? undefined,
            completionPhotoUri: normalizeMediaUrl(p.completion_photo_url),
            completionNote: p.completion_note ?? undefined,
            completedAt: p.completed_at ?? undefined,
            status: p.status,
            createdAt: p.created_at,
          };
        })
        : null;

      const nextReports = reportsData
        ? reportsData.map((r): Report => {
          const reportRow = r as unknown as Record<string, unknown>;
          const rawReportType =
            typeof r.report_type === 'string'
              ? r.report_type
              : typeof reportRow.reportType === 'string'
                ? reportRow.reportType
                : typeof reportRow.type === 'string'
                  ? reportRow.type
                  : null;
          const cachedReport = normalizedStoredReports.find((report) => report.id === r.id);
          const legacyReport = parseLegacyReportDescription(r.description);
          const reportType =
            normalizeReportType(rawReportType)
            ?? legacyReport.typeFromDescription
            ?? inferReportTypeFromText(rawReportType)
            ?? inferReportTypeFromText(r.description)
            ?? cachedReport?.type
            ?? 'other';
          const locationText = normalizeReadableLocation(
            typeof r.location_text === 'string' ? r.location_text : ''
          );
          const locationFromDescription = normalizeReadableLocation(extractLocationFromDescription(r.description));
          const resolvedLocation = (
            locationText
            || normalizeReadableLocation(legacyReport.locationFromDescription)
            || locationFromDescription
            || normalizeReadableLocation(cachedReport?.location)
            || ''
          ).trim();
          const status = r.status && isReportStatus(r.status) ? r.status : 'reported';

          return {
            id: r.id,
            userId: r.user_id,
            type: reportType,
            description: legacyReport.cleanDescription,
            photoUri: normalizeMediaUrl(r.photo_url),
            location: resolvedLocation.length > 0 ? resolvedLocation : 'Location not provided',
            latitude: r.latitude ?? undefined,
            longitude: r.longitude ?? undefined,
            assignedCollectorId: r.assigned_collector_id ?? undefined,
            assignedCollectorName: r.assigned_collector_name ?? undefined,
            assignedCollectorPhone: r.assigned_collector_phone ?? undefined,
            residentConfirmationStatus: r.resident_confirmation_status ?? undefined,
            residentConfirmedAt: r.resident_confirmed_at ?? undefined,
            residentRejectionNote: r.resident_rejection_note ?? undefined,
            cleanedPhotoUri: normalizeMediaUrl(r.cleaned_photo_url),
            cleanedNote: r.cleaned_note ?? undefined,
            cleanedAt: r.cleaned_at ?? undefined,
            status,
            createdAt: r.created_at,
          };
        })
        : null;

      const pickupsForBadges = nextPickups ?? normalizedStoredPickups;
      const reportsForBadges = nextReports ?? normalizedStoredReports;
      let latestReward: ApiResidentRewardRow | null = null;
      let points = currentUser.points;
      let nextUser: User = currentUser;

      if (rewardsData) {
        latestReward = rewardsData[0] ?? null;
        if (!rewardsTrackingReady.current) {
          rewardsTrackingReady.current = true;
          lastSeenRewardId.current = await storage.getLastSeenRewardId(currentUser.id);
        }

        points = rewardsData.reduce((sum, reward) => sum + reward.points, 0);
        const badges = deriveBadges({
          points,
          pickupsCount: pickupsForBadges.length,
          reportsCount: reportsForBadges.length,
        });

        nextUser = {
          ...currentUser,
          points,
          badges,
        };
        userNeedsSave = true;
      }

      if (quotaResult.status === 'fulfilled' && quotaResult.value.quota) {
        setPickupQuota(quotaResult.value.quota);
      }

      const writes: Promise<void>[] = [];
      if (nextPickups) writes.push(storage.savePickups(nextPickups));
      if (nextReports) writes.push(storage.saveReports(nextReports));
      if (!nextPickups && didNormalizeStoredPickups) {
        writes.push(storage.savePickups(normalizedStoredPickups));
      }
      if (!nextReports && didNormalizeStoredReports) {
        writes.push(storage.saveReports(normalizedStoredReports));
      }
      if (userNeedsSave) writes.push(storage.saveUser(nextUser));
      if (writes.length > 0) {
        await Promise.all(writes);
      }

      if (nextPickups) setPickups(nextPickups);
      if (nextReports) setReports(nextReports);
      if (userNeedsSave) setUser(nextUser);

        if (rewardsData && latestReward && latestReward.id !== lastSeenRewardId.current) {
        const unseenRewards: ApiResidentRewardRow[] = [];
        if (!lastSeenRewardId.current) {
          unseenRewards.push(latestReward);
        } else {
          for (const reward of rewardsData) {
            if (reward.id === lastSeenRewardId.current) {
              break;
            }
            unseenRewards.push(reward);
          }
        }

        if (unseenRewards.length > 0) {
          const ordered = unseenRewards.slice().reverse();
          setRewardQueue((prev) => {
            const existing = new Set(prev.map((r) => r.id));
            const toAdd = ordered.filter((r) => !existing.has(r.id));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });

          lastSeenRewardId.current = unseenRewards[0].id;
          await storage.saveLastSeenRewardId(unseenRewards[0].id, loadedUser.id);
        }
      }

      if (!opts?.silent && failures.length > 0) {
        toast.error("Some data couldn't refresh", { message: failures.join(", ") });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await Promise.all([
          storage.clearUser(),
          storage.clearAuthToken(),
          storage.clearPushToken(),
          storage.clearPickups(),
          storage.clearReports(),
        ]);
        setUser(null);
        setPickups([]);
        setReports([]);
        setPickupQuota(null);
      } else if (!opts?.silent) {
        const message = err instanceof Error ? err.message : "Failed to refresh data";
        toast.error(message);
      }
    } finally {
      if (!opts?.silent) {
        setIsLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const syncNotificationPopups = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user || user.role === 'admin') {
      return;
    }

    try {
      if (!notificationsTrackingReady.current) {
        notificationsTrackingReady.current = true;
        lastSeenNotificationId.current = await storage.getLastSeenNotificationId(user.id);
      }

      const payload = await apiRequest<{ success: true; notifications: ApiNotificationRow[] }>(
        'GET',
        '/notifications'
      );
      const notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
      const latest = notifications[0];
      if (!latest?.id) {
        return;
      }

      const seenId = lastSeenNotificationId.current;
      if (!seenId) {
        toast.info('Notifications', { message: latest.message });
        lastSeenNotificationId.current = latest.id;
        await storage.saveLastSeenNotificationId(latest.id, user.id);
        return;
      }

      if (latest.id === seenId) {
        return;
      }

      const unseen: ApiNotificationRow[] = [];
      for (const item of notifications) {
        if (item.id === seenId) {
          break;
        }
        unseen.push(item);
      }

      const newestUnseen = unseen[0] ?? latest;
      toast.info('Notifications', { message: newestUnseen.message });
      lastSeenNotificationId.current = newestUnseen.id;
      await storage.saveLastSeenNotificationId(newestUnseen.id, user.id);
    } catch (err) {
      if (!opts?.silent) {
        const message = err instanceof Error ? err.message : 'Failed to load notifications';
        toast.error(message);
      }
    }
  }, [toast, user]);

  useEffect(() => {
    notificationsTrackingReady.current = false;
    lastSeenNotificationId.current = null;
  }, [user?.id, user?.role]);

  const { id: contextUserId, role: contextUserRole } = user ?? {};

  useEffect(() => {
    if (!contextUserId || contextUserRole === 'admin') return;
    void syncNotificationPopups({ silent: true });
  }, [contextUserId, contextUserRole, syncNotificationPopups]);

  useRealtimeRefresh({
    enabled: !!user && user.role === 'resident',
    onRefresh: () => loadData({ silent: true }),
    pollMs: 30_000,
    eventTypes: [
      'pickup.updated',
      'report.updated',
      'reward.updated',
      'notification.read'
    ]
  });

  useRealtimeRefresh({
    enabled: !!user && user.role !== 'admin',
    onRefresh: () => syncNotificationPopups({ silent: true }),
    pollMs: 30_000,
    eventTypes: ['notification.created']
  });

type ApiAuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  area?: string | null;
  subscription_plan?: SubscriptionPlan | null;
  collector_verification_status?: 'pending' | 'approved' | 'rejected' | null;
  collector_verification_note?: string | null;
  collector_submitted_at?: string | null;
  collector_verified_at?: string | null;
  collector_auto_location_tracking?: boolean | null;
  collector_exit_location_capture_enabled?: boolean | null;
};

  type ApiCollectorApplication = {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    area?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    submitted_at?: string | null;
  };

  type ApiAuthSuccessResponse = {
    success: true;
    token: string;
    user: ApiAuthUser;
  };

  type ApiRegisterPendingResponse = {
    success: true;
    pending_approval: true;
    collector_application: ApiCollectorApplication;
  };

  type ApiRegisterResponse = ApiAuthSuccessResponse | ApiRegisterPendingResponse;

  type ApiMeResponse = {
    success: true;
    user: ApiAuthUser;
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<ApiAuthSuccessResponse>("POST", "/auth/login", { email, password });

    const newUser: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      phone: data.user.phone ?? undefined,
      neighborhood: normalizeReadableLocation(data.user.area) || undefined,
      subscriptionPlan:
        data.user.subscription_plan && isSubscriptionPlan(data.user.subscription_plan)
          ? data.user.subscription_plan
          : undefined,
      collectorVerificationStatus: data.user.collector_verification_status ?? undefined,
      collectorVerificationNote: data.user.collector_verification_note ?? undefined,
      collectorSubmittedAt: data.user.collector_submitted_at ?? undefined,
      collectorVerifiedAt: data.user.collector_verified_at ?? undefined,
      collectorAutoLocationTracking:
        typeof data.user.collector_auto_location_tracking === "boolean"
          ? data.user.collector_auto_location_tracking
          : undefined,
      collectorExitLocationCaptureEnabled:
        typeof data.user.collector_exit_location_capture_enabled === "boolean"
          ? data.user.collector_exit_location_capture_enabled
          : undefined,
      points: 0,
      badges: [],
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      storage.saveAuthToken(data.token),
      storage.saveUser(newUser),
      storage.clearPickups(),
      storage.clearReports(),
      storage.clearCollectorActionQueue(),
    ]);

    setRewardQueue([]);
    rewardsTrackingReady.current = false;
    lastSeenRewardId.current = null;
    notificationsTrackingReady.current = false;
    lastSeenNotificationId.current = null;

    resetSessionExpiredState();
    await loadData();
    return newUser;
  }, [loadData]);

  const logout = useCallback(async () => {
    try {
      await unregisterSavedPushTokenFromBackend();
    } catch {
      // Best effort: continue local logout even if push-token unregister fails.
    }

    await Promise.all([
      storage.clearUser(),
      storage.clearAuthToken(),
      storage.clearPushToken(),
      storage.clearPickups(),
      storage.clearReports(),
      storage.clearCollectorActionQueue(),
    ]);
    setUser(null);
    setPickups([]);
    setReports([]);
    setPickupQuota(null);
    setSchedulePreference(null);
    setRewardQueue([]);
    rewardsTrackingReady.current = false;
    lastSeenRewardId.current = null;
    notificationsTrackingReady.current = false;
    lastSeenNotificationId.current = null;
  }, []);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    phone: string,
    role: UserRole,
    neighborhood: string
  ) => {
    const data = await apiRequest<ApiRegisterResponse>("POST", "/auth/register", {
      name,
      email,
      password,
      phone,
      neighborhood,
      role,
    });

    if ('pending_approval' in data && data.pending_approval) {
      const pendingApplication: CollectorApplicationSubmission = {
        id: data.collector_application.id,
        name: data.collector_application.name,
        email: data.collector_application.email,
        phone: data.collector_application.phone ?? (phone || undefined),
        area: normalizeReadableLocation(data.collector_application.area) || normalizeReadableLocation(neighborhood) || undefined,
        status: data.collector_application.status,
        submittedAt: data.collector_application.submitted_at ?? new Date().toISOString(),
      };

      await Promise.all([
        storage.clearUser(),
        storage.clearAuthToken(),
        storage.clearPickups(),
        storage.clearReports(),
        storage.clearCollectorActionQueue(),
      ]);

      setUser(null);
      setPickups([]);
      setReports([]);
      setPickupQuota(null);
      setSchedulePreference(null);
      setRewardQueue([]);
      rewardsTrackingReady.current = false;
      lastSeenRewardId.current = null;
      notificationsTrackingReady.current = false;
      lastSeenNotificationId.current = null;

      return { type: 'collector_pending' as const, application: pendingApplication };
    }

    if (!('token' in data) || !data.token || !('user' in data) || !data.user) {
      throw new Error('Invalid registration response');
    }

    const newUser: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      phone: phone || data.user.phone || undefined,
      neighborhood: normalizeReadableLocation(neighborhood) || normalizeReadableLocation(data.user.area) || undefined,
      subscriptionPlan:
        data.user.subscription_plan && isSubscriptionPlan(data.user.subscription_plan)
          ? data.user.subscription_plan
          : undefined,
      collectorVerificationStatus: data.user.collector_verification_status ?? undefined,
      collectorVerificationNote: data.user.collector_verification_note ?? undefined,
      collectorSubmittedAt: data.user.collector_submitted_at ?? undefined,
      collectorVerifiedAt: data.user.collector_verified_at ?? undefined,
      collectorAutoLocationTracking:
        typeof data.user.collector_auto_location_tracking === "boolean"
          ? data.user.collector_auto_location_tracking
          : undefined,
      collectorExitLocationCaptureEnabled:
        typeof data.user.collector_exit_location_capture_enabled === "boolean"
          ? data.user.collector_exit_location_capture_enabled
          : undefined,
      points: 0,
      badges: [],
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      storage.saveAuthToken(data.token),
      storage.saveUser(newUser),
      storage.clearPickups(),
      storage.clearReports(),
      storage.clearCollectorActionQueue(),
    ]);

    setRewardQueue([]);
    rewardsTrackingReady.current = false;
    lastSeenRewardId.current = null;
    notificationsTrackingReady.current = false;
    lastSeenNotificationId.current = null;

    await loadData();
    return { type: 'active' as const, user: newUser };
  }, [loadData]);

  const switchRole = useCallback(async (role: 'resident') => {
    if (!user) {
      throw new Error('Not signed in');
    }

    const data = await apiRequest<ApiAuthSuccessResponse>("POST", "/collector/switch-role", { role });

    const nextUser: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      phone: data.user.phone ?? undefined,
      neighborhood: normalizeReadableLocation(data.user.area) || undefined,
      subscriptionPlan:
        data.user.subscription_plan && isSubscriptionPlan(data.user.subscription_plan)
          ? data.user.subscription_plan
          : user.subscriptionPlan,
      collectorVerificationStatus: data.user.collector_verification_status ?? undefined,
      collectorVerificationNote: data.user.collector_verification_note ?? undefined,
      collectorSubmittedAt: data.user.collector_submitted_at ?? undefined,
      collectorVerifiedAt: data.user.collector_verified_at ?? undefined,
      collectorAutoLocationTracking:
        typeof data.user.collector_auto_location_tracking === "boolean"
          ? data.user.collector_auto_location_tracking
          : undefined,
      collectorExitLocationCaptureEnabled:
        typeof data.user.collector_exit_location_capture_enabled === "boolean"
          ? data.user.collector_exit_location_capture_enabled
          : undefined,
      points: 0,
      badges: [],
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      storage.saveAuthToken(data.token),
      storage.saveUser(nextUser),
      storage.clearPickups(),
      storage.clearReports(),
      storage.clearCollectorActionQueue(),
    ]);

    setRewardQueue([]);
    rewardsTrackingReady.current = false;
    lastSeenRewardId.current = null;
    notificationsTrackingReady.current = false;
    lastSeenNotificationId.current = null;

    await loadData();
    return nextUser;
  }, [user, loadData]);

  const updateProfile = useCallback(async (updates: { name?: string; phone?: string; neighborhood?: string }) => {
    if (!user) {
      throw new Error('Not signed in');
    }

    const body: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      body.name = updates.name;
    }

    if (updates.phone !== undefined) {
      const trimmed = updates.phone.trim();
      body.phone = trimmed ? trimmed : null;
    }

    if (updates.neighborhood !== undefined) {
      const trimmed = updates.neighborhood.trim();
      body.area = trimmed ? trimmed : null;
    }

    if (Object.keys(body).length === 0) {
      return;
    }

    const data = await apiRequest<ApiMeResponse>("PATCH", "/auth/me", body);

    const nextUser: User = {
      ...user,
      name: data.user.name,
      phone: data.user.phone ?? undefined,
      neighborhood: normalizeReadableLocation(data.user.area) || undefined,
      collectorVerificationStatus: data.user.collector_verification_status ?? user.collectorVerificationStatus,
      collectorVerificationNote: data.user.collector_verification_note ?? user.collectorVerificationNote,
      collectorSubmittedAt: data.user.collector_submitted_at ?? user.collectorSubmittedAt,
      collectorVerifiedAt: data.user.collector_verified_at ?? user.collectorVerifiedAt,
      collectorAutoLocationTracking:
        typeof data.user.collector_auto_location_tracking === "boolean"
          ? data.user.collector_auto_location_tracking
          : user.collectorAutoLocationTracking,
      collectorExitLocationCaptureEnabled:
        typeof data.user.collector_exit_location_capture_enabled === "boolean"
          ? data.user.collector_exit_location_capture_enabled
          : user.collectorExitLocationCaptureEnabled,
    };

    await storage.saveUser(nextUser);
    setUser(nextUser);
  }, [user]);

  const setCollectorAutoLocationTracking = useCallback(async (enabled: boolean) => {
    if (!user) {
      throw new Error("Not signed in");
    }

    const data = await apiRequest<ApiMeResponse>("PATCH", "/auth/me", {
      collector_auto_location_tracking: enabled,
    });

    const nextUser: User = {
      ...user,
      collectorVerificationStatus: data.user.collector_verification_status ?? user.collectorVerificationStatus,
      collectorVerificationNote: data.user.collector_verification_note ?? user.collectorVerificationNote,
      collectorSubmittedAt: data.user.collector_submitted_at ?? user.collectorSubmittedAt,
      collectorVerifiedAt: data.user.collector_verified_at ?? user.collectorVerifiedAt,
      collectorAutoLocationTracking:
        typeof data.user.collector_auto_location_tracking === "boolean"
          ? data.user.collector_auto_location_tracking
          : enabled,
      collectorExitLocationCaptureEnabled:
        typeof data.user.collector_exit_location_capture_enabled === "boolean"
          ? data.user.collector_exit_location_capture_enabled
          : user.collectorExitLocationCaptureEnabled,
    };

    await storage.saveUser(nextUser);
    setUser(nextUser);
  }, [user]);

  const setCollectorExitLocationCaptureEnabled = useCallback(async (enabled: boolean) => {
    if (!user) {
      throw new Error("Not signed in");
    }

    const data = await apiRequest<ApiMeResponse>("PATCH", "/auth/me", {
      collector_exit_location_capture_enabled: enabled,
    });

    const nextUser: User = {
      ...user,
      collectorVerificationStatus: data.user.collector_verification_status ?? user.collectorVerificationStatus,
      collectorVerificationNote: data.user.collector_verification_note ?? user.collectorVerificationNote,
      collectorSubmittedAt: data.user.collector_submitted_at ?? user.collectorSubmittedAt,
      collectorVerifiedAt: data.user.collector_verified_at ?? user.collectorVerifiedAt,
      collectorAutoLocationTracking:
        typeof data.user.collector_auto_location_tracking === "boolean"
          ? data.user.collector_auto_location_tracking
          : user.collectorAutoLocationTracking,
      collectorExitLocationCaptureEnabled:
        typeof data.user.collector_exit_location_capture_enabled === "boolean"
          ? data.user.collector_exit_location_capture_enabled
          : enabled,
    };

    await storage.saveUser(nextUser);
    setUser(nextUser);
  }, [user]);

  const createPickup = useCallback(async (
    pickupData: Omit<PickupRequest, 'id' | 'userId' | 'createdAt' | 'status'>
  ) => {
    if (!user) {
      throw new Error('Not signed in');
    }

    if (user.role !== 'resident') {
      throw new Error('Only residents can create pickup requests');
    }

    const scheduledDateTime = buildScheduledDateTimeIso(pickupData.scheduledDate, pickupData.scheduledTime);
    const pickupPhotoUrl = await uploadOptionalMediaUri(pickupData.photoUri ?? null, {
      category: 'pickup-photo'
    });

    const body: Record<string, unknown> = {
      waste_type: pickupData.wasteType,
      scheduled_date: scheduledDateTime,
    };

    if (pickupData.description?.trim()) {
      body.description = pickupData.description.trim();
    }

    if (pickupData.address?.trim()) {
      body.address = pickupData.address.trim();
    }

    if (pickupPhotoUrl) {
      body.photo_url = pickupPhotoUrl;
    }

    if (pickupData.pickupCategory) {
      body.pickup_category = pickupData.pickupCategory;
    }

    if (pickupData.distanceKm !== undefined) {
      body.distance_km = pickupData.distanceKm;
    }

    if (pickupData.latitude === undefined || pickupData.longitude === undefined) {
      throw new Error('Could not resolve location');
    }
    body.latitude = pickupData.latitude;
    body.longitude = pickupData.longitude;

    const data = await apiRequest<{ success: true; pickup: ApiResidentPickupRow }>("POST", "/resident/pickups", body);
    void data;

    await loadData();
  }, [user, loadData]);

  const updatePickup = useCallback(async (pickup: PickupRequest) => {
    void pickup;
    throw new Error('Updating pickup requests is not supported yet');
  }, []);

  const deletePickup = useCallback(async (id: string) => {
    void id;
    throw new Error('Deleting pickup requests is not supported yet');
  }, []);

  const reschedulePickup = useCallback(async (id: string, isoDate: string) => {
    await apiRequest<{ success: true }>("PATCH", `/resident/pickups/${id}/reschedule`, {
      scheduled_date: isoDate,
    });
    await loadData();
  }, [loadData]);

  const cancelPickup = useCallback(async (id: string) => {
    await apiRequest<{ success: true }>("PATCH", `/resident/pickups/${id}/cancel`);
    await loadData();
  }, [loadData]);

  const confirmPickupCompletion = useCallback(async (id: string, approved: boolean, note?: string) => {
    await apiRequest<{ success: true }>("POST", `/resident/pickups/${id}/confirm-completion`, {
      approved,
      note: note?.trim() ? note.trim() : undefined,
    });
    await loadData();
  }, [loadData]);

  const cancelReport = useCallback(async (id: string) => {
    await apiRequest<{ success: true }>("PATCH", `/resident/reports/${id}/cancel`);
    await loadData();
  }, [loadData]);

  const confirmReportCleanup = useCallback(async (id: string, approved: boolean, note?: string) => {
    await apiRequest<{ success: true }>("POST", `/resident/reports/${id}/confirm-cleanup`, {
      approved,
      note: note?.trim() ? note.trim() : undefined,
    });
    await loadData();
  }, [loadData]);

  const createReport = useCallback(async (
    reportData: Omit<Report, 'id' | 'userId' | 'createdAt' | 'status'>
  ) => {
    if (!user) {
      throw new Error('Not signed in');
    }

    if (user.role !== 'resident') {
      throw new Error('Only residents can create reports');
    }

    const reportPhotoUrl = await uploadOptionalMediaUri(reportData.photoUri ?? null, {
      category: 'report-photo'
    });

    const body: Record<string, unknown> = {
      report_type: reportData.type,
      location_text: reportData.location.trim(),
    };

    if (reportData.description?.trim()) {
      body.description = reportData.description.trim();
    }

    if (reportPhotoUrl) {
      body.photo_url = reportPhotoUrl;
    }
    if (reportData.latitude === undefined || reportData.longitude === undefined) {
      throw new Error('Could not resolve location');
    }
    body.latitude = reportData.latitude;
    body.longitude = reportData.longitude;
    if (reportData.priority) {
      body.priority = reportData.priority;
    }

    const created = await apiRequest<{ success: true; report: ApiResidentReportRow }>("POST", "/resident/reports", body);
    const createdReport = created?.report;
    if (createdReport) {
      const legacyReport = parseLegacyReportDescription(createdReport.description ?? reportData.description ?? '');
      const createdRow = createdReport as unknown as Record<string, unknown>;
      const rawReportType =
        typeof createdReport.report_type === 'string'
          ? createdReport.report_type
          : typeof createdRow.reportType === 'string'
            ? createdRow.reportType
            : typeof createdRow.type === 'string'
              ? createdRow.type
              : null;
      const reportType =
        normalizeReportType(rawReportType ?? reportData.type)
        ?? legacyReport.typeFromDescription
        ?? inferReportTypeFromText(rawReportType)
        ?? inferReportTypeFromText(createdReport.description ?? reportData.description ?? null)
        ?? reportData.type;
      const locationText = normalizeReadableLocation(createdReport.location_text ?? reportData.location ?? '');
      const locationFromDescription = normalizeReadableLocation(
        extractLocationFromDescription(createdReport.description ?? reportData.description ?? null)
      );
      const resolvedLocation =
        locationText
        || normalizeReadableLocation(legacyReport.locationFromDescription)
        || locationFromDescription
        || normalizeReadableLocation(reportData.location)
        || 'Location not provided';
      const status = createdReport.status && isReportStatus(createdReport.status)
        ? createdReport.status
        : 'reported';
      const nextReport: Report = {
        id: createdReport.id,
        userId: createdReport.user_id,
        type: reportType,
        description: legacyReport.cleanDescription,
        photoUri: normalizeMediaUrl(createdReport.photo_url ?? reportPhotoUrl ?? undefined),
        location: resolvedLocation,
        latitude: createdReport.latitude ?? reportData.latitude ?? undefined,
        longitude: createdReport.longitude ?? reportData.longitude ?? undefined,
        priority: createdReport.priority ?? reportData.priority ?? 'normal',
        assignedCollectorId: createdReport.assigned_collector_id ?? undefined,
        assignedCollectorName: createdReport.assigned_collector_name ?? undefined,
        assignedCollectorPhone: createdReport.assigned_collector_phone ?? undefined,
        residentConfirmationStatus: createdReport.resident_confirmation_status ?? undefined,
        residentConfirmedAt: createdReport.resident_confirmed_at ?? undefined,
        residentRejectionNote: createdReport.resident_rejection_note ?? undefined,
        cleanedPhotoUri: normalizeMediaUrl(createdReport.cleaned_photo_url),
        cleanedNote: createdReport.cleaned_note ?? undefined,
        cleanedAt: createdReport.cleaned_at ?? undefined,
        status,
        createdAt: createdReport.created_at ?? new Date().toISOString(),
      };
      await storage.saveReport(nextReport);
    }
    await loadData();
  }, [user, loadData]);

  const addPoints = useCallback(async (points: number) => {
    void points;
    throw new Error('Points are managed by the backend');
  }, []);

  const updateSchedulePreference = useCallback(async (pref: storage.SchedulePreference | null) => {
    if (!user) {
      throw new Error('Not signed in');
    }
    await storage.saveSchedulePreference(pref, user.id);
    setSchedulePreference(pref);
  }, [user]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const refreshPickupQuota = useCallback(async () => {
    if (!user || user.role !== 'resident') return;
    try {
      const data = await apiRequest<{ success: true; quota: ApiPickupQuotaRow }>(
        'GET',
        '/resident/pickups/quota',
      );
      if (data.quota) setPickupQuota(data.quota);
    } catch {
      // best effort: quota display is non-critical
    }
  }, [user]);

  const currentReward = rewardQueue[0] ?? null;

  const value = useMemo(() => ({
    user,
    pickups,
    reports,
    pickupQuota,
    schedulePreference,
    isLoading,
    login,
    logout,
    register,
    switchRole,
    updateProfile,
    setCollectorAutoLocationTracking,
    setCollectorExitLocationCaptureEnabled,
    createPickup,
    updatePickup,
    deletePickup,
    reschedulePickup,
    cancelPickup,
    confirmPickupCompletion,
    cancelReport,
    confirmReportCleanup,
    createReport,
    addPoints,
    updateSchedulePreference,
    refreshPickupQuota,
    refreshData,
  }), [user, pickups, reports, pickupQuota, schedulePreference, isLoading, login, logout, register, switchRole, updateProfile, setCollectorAutoLocationTracking, setCollectorExitLocationCaptureEnabled, createPickup, updatePickup, deletePickup, reschedulePickup, cancelPickup, confirmPickupCompletion, cancelReport, confirmReportCleanup, createReport, addPoints, updateSchedulePreference, refreshPickupQuota, refreshData]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <RewardCelebrationModal
        visible={!!currentReward && user?.role === 'resident'}
        points={currentReward?.points ?? 0}
        reason={currentReward?.reason ?? ''}
        totalPoints={user?.points ?? 0}
        onDismiss={() => setRewardQueue((prev) => prev.slice(1))}
      />
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
