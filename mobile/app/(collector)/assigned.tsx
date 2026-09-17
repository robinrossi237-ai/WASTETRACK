import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, RefreshControl, Linking, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/lib/toast-context";
import * as Haptics from "expo-haptics";
import { router, useIsFocused } from "expo-router";
import { useApp } from "@/lib/context";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { showConfirmDialog } from "@/lib/confirm-dialog";
import {
  collectorApi,
  getCollectorQueuedActionCount,
  syncCollectorActionQueue,
  type CollectorAssignment,
  type CollectorDispatchOffer,
  type CollectorOfferResponse,
  type CollectorWasteReport
} from "@/lib/collector-api";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

const ISSUE_REASONS = [
  { value: "Cannot access location", labelKey: "Cannot access location" },
  { value: "Resident not available", labelKey: "Resident not available" },
  { value: "Hazardous situation", labelKey: "Hazardous situation" },
  { value: "Wrong address", labelKey: "Wrong address" },
];
type AssignmentView = "all" | "pickups" | "reports";
type AssignmentBucket = "urgent" | "today" | "upcoming";

type AssignmentCard = {
  id: string;
  kind: "pickup" | "report";
  status: string;
  title: string;
  areaText: string;
  residentName: string | null;
  residentPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: string | null;
  fallbackAt: string | null;
  pickup?: CollectorAssignment;
  report?: CollectorWasteReport;
};

const resolveWasteAccent = (value?: string | null): string => {
  if (!value) return Colors.primary;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const byExact = (Colors.waste as Record<string, string>)[normalized];
  if (byExact) return byExact;
  const byPrefix = Object.entries(Colors.waste).find(([key]) => normalized.startsWith(key));
  return byPrefix?.[1] ?? Colors.primary;
};

const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const OFFER_WINDOW_FALLBACK_SECONDS = 120;
const OFFER_CRITICAL_SECONDS = 20;
const OFFER_SOON_SECONDS = 60;

type OfferUrgency = "expired" | "critical" | "soon" | "normal";

const getOfferResponseWindowSeconds = (offer: CollectorDispatchOffer): number => {
  if (
    typeof offer.response_window_seconds === "number"
    && Number.isFinite(offer.response_window_seconds)
    && offer.response_window_seconds > 0
  ) {
    return Math.floor(offer.response_window_seconds);
  }
  return OFFER_WINDOW_FALLBACK_SECONDS;
};

const getOfferExpiryMs = (offer: CollectorDispatchOffer): number | null => {
  const explicitExpiry = toDate(offer.expires_at)?.getTime();
  if (typeof explicitExpiry === "number" && Number.isFinite(explicitExpiry)) {
    return explicitExpiry;
  }
  const offeredAt = toDate(offer.offered_at)?.getTime();
  if (typeof offeredAt === "number" && Number.isFinite(offeredAt)) {
    return offeredAt + getOfferResponseWindowSeconds(offer) * 1000;
  }
  return null;
};

const getOfferSecondsLeft = (offer: CollectorDispatchOffer, nowMs: number): number => {
  const expiresAt = getOfferExpiryMs(offer);
  if (expiresAt === null) {
    return typeof offer.seconds_remaining === "number" && Number.isFinite(offer.seconds_remaining)
      ? Math.max(0, Math.floor(offer.seconds_remaining))
      : 0;
  }
  return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
};

const formatOfferCountdown = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const getOfferUrgency = (seconds: number): OfferUrgency => {
  if (seconds <= 0) return "expired";
  if (seconds <= OFFER_CRITICAL_SECONDS) return "critical";
  if (seconds <= OFFER_SOON_SECONDS) return "soon";
  return "normal";
};

export default function CollectorAssignedScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language, setLanguage, options } = useLanguage();
  const { user } = useApp();
  const isFocused = useIsFocused();
  const toast = useToast();
  const [view, setView] = useState<AssignmentView>("all");
  const [pickupAssignments, setPickupAssignments] = useState<CollectorAssignment[]>([]);
  const [reportAssignments, setReportAssignments] = useState<CollectorWasteReport[]>([]);
  const [pendingOffers, setPendingOffers] = useState<CollectorDispatchOffer[]>([]);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [todayCompletedCount, setTodayCompletedCount] = useState<number>(0);
  const [todayTargetCount, setTodayTargetCount] = useState<number>(0);
  const [liveLocation, setLiveLocation] = useState<string | null>(null);
  const [heroMeasuredHeight, setHeroMeasuredHeight] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [queuedActionsCount, setQueuedActionsCount] = useState<number>(0);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [offerClockMs, setOfferClockMs] = useState<number>(() => Date.now());
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pickups, reports, offers, pickupHistory, reportHistory] = await Promise.all([
        collectorApi.listAssigned(),
        collectorApi.listAssignedReports(),
        collectorApi.listPendingOffers(),
        collectorApi.listHistory(),
        collectorApi.listReportHistory(),
      ]);
      setPickupAssignments(pickups);
      setReportAssignments(reports);
      setPendingOffers(offers);
      const pickupHistoryRows = pickupHistory;
      const reportHistoryRows = reportHistory;
      const completedPickupCount = pickupHistoryRows.filter((item) => item.status === "completed").length;
      const completedReportCount = reportHistoryRows.filter((item) => item.status === "cleaned" || item.status === "approved").length;
      const totalCompleted = completedPickupCount + completedReportCount;
      const lifetimeAssignedCount = pickupHistoryRows.length + reportHistoryRows.length + pickups.length + reports.length;
      setCompletionRate(lifetimeAssignedCount > 0 ? Math.round((totalCompleted / lifetimeAssignedCount) * 100) : 0);

      const now = new Date();
      const assignedTodayCount =
        pickups.filter((item) => {
          const date = toDate(item.scheduled_date) ?? toDate(item.assigned_at);
          return date ? isSameDay(date, now) : false;
        }).length +
        reports.filter((item) => {
          const date = toDate(item.assigned_at) ?? toDate(item.created_at);
          return date ? isSameDay(date, now) : false;
        }).length;
      const completedTodayCountValue =
        pickupHistoryRows.filter((item) => {
          if (item.status !== "completed") return false;
          const date = toDate(item.completed_at) ?? toDate(item.started_at) ?? toDate(item.assigned_at);
          return date ? isSameDay(date, now) : false;
        }).length +
        reportHistoryRows.filter((item) => {
          if (!(item.status === "cleaned" || item.status === "approved")) return false;
          const date = toDate(item.cleaned_at) ?? toDate(item.updated_at) ?? toDate(item.assigned_at);
          return date ? isSameDay(date, now) : false;
        }).length;
      setTodayCompletedCount(completedTodayCountValue);
      setTodayTargetCount(Math.max(assignedTodayCount + completedTodayCountValue, completedTodayCountValue));
      setQueuedActionsCount(await getCollectorQueuedActionCount());
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to load assignments"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const loadLiveLocation = useCallback(async () => {
    if (Platform.OS === "web") {
      setLiveLocation(null);
      return;
    }

    const captured = await captureCurrentDeviceLocation({
      requestPermission: true,
      includeLabel: true,
      allowCoordinateFallback: false,
      retries: 2,
    });
    if (!captured) {
      setLiveLocation(null);
      return;
    }

    const label = captured.label.trim();
    setLiveLocation(label.length > 0 ? label : null);
  }, []);

  const refreshAll = async () => {
    await Promise.all([load(), loadLiveLocation()]);
  };

  useEffect(() => {
    void load();
    void loadLiveLocation();
  }, [load, loadLiveLocation]);

  useEffect(() => {
    if (pendingOffers.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      setOfferClockMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingOffers.length]);

  useEffect(() => {
    if (pendingOffers.length === 0) {
      return;
    }
    const hasExpiredOffer = pendingOffers.some((offer) => getOfferSecondsLeft(offer, offerClockMs) <= 0);
    if (!hasExpiredOffer) {
      return;
    }
    const timer = setTimeout(() => {
      void load();
    }, 1200);
    return () => clearTimeout(timer);
  }, [load, offerClockMs, pendingOffers]);

  useRealtimeRefresh({
    enabled: isFocused,
    onRefresh: refreshAll,
    pollMs: 20_000,
    eventTypes: [
      "assignment.updated",
      "pickup.updated",
      "report.updated",
      "notification.created",
      "collector.offer.created",
      "collector.offer.responded",
    ],
  });

  const openRouteTrace = (item: AssignmentCard) => {
    router.push({
      pathname: "/(collector)/map",
      params: { id: item.id, kind: item.kind },
    });
  };

  const contactResident = (phone?: string | null) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => toast.error(t("Cannot open dialer")));
  };

  const openRouteForTask = (taskId: string, kind: "pickup" | "report") => {
    router.push({
      pathname: "/(collector)/map",
      params: { id: taskId, kind },
    });
  };

  const resolveAcceptedOfferRouteTarget = async (
    result: CollectorOfferResponse
  ): Promise<{ kind: "pickup" | "report"; taskId: string } | null> => {
    const routeKind: "pickup" | "report" = result.entity_type === "pickup" ? "pickup" : "report";

    if (routeKind === "report") {
      return { kind: routeKind, taskId: result.entity_id };
    }

    if (result.assignment_id) {
      return { kind: routeKind, taskId: result.assignment_id };
    }

    const cachedMatch = pickupAssignments.find((item) => item.pickup_request_id === result.entity_id);
    if (cachedMatch?.id) {
      return { kind: routeKind, taskId: cachedMatch.id };
    }

    try {
      const latestAssignments = await collectorApi.listAssigned();
      const liveMatch = latestAssignments.find((item) => item.pickup_request_id === result.entity_id);
      if (liveMatch?.id) {
        return { kind: routeKind, taskId: liveMatch.id };
      }
    } catch {
      // Best effort only; fallback handled by caller.
    }

    return null;
  };

  const handoffFromAcceptedOffer = async (result: CollectorOfferResponse) => {
    const target = await resolveAcceptedOfferRouteTarget(result);
    if (!target) {
      toast.info(t("Request accepted. Open Collector Map to start navigation."));
      return;
    }

    const routeKind: "pickup" | "report" = result.entity_type === "pickup" ? "pickup" : "report";
    const routeTaskId = target.taskId;

    if (Platform.OS === "web") {
      openRouteForTask(routeTaskId, routeKind);
      return;
    }

    Alert.alert(
      t("Route ready"),
      t("Open route guidance now?"),
      [
        { text: t("Later"), style: "cancel" },
        { text: t("Start route"), onPress: () => openRouteForTask(routeTaskId, routeKind) },
      ]
    );
  };

  const startJob = async (id: string) => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await collectorApi.start(id);
      toast.success(t("Job started"));
      openRouteForTask(id, "pickup");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to start assignment");
      toast.info(message);
      await load();
    }
  };

  const reportPickupIssue = (id: string) => {
    Alert.alert(t("Report issue"), t("Select a reason"), [
      ...ISSUE_REASONS.map((reason) => ({
        text: t(reason.labelKey),
        onPress: () => {
          void (async () => {
            try {
              await collectorApi.issue(id, reason.value);
              toast.success(t("Issue reported"));
            } catch (err) {
              const message = err instanceof Error ? err.message : t("Issue saved to queue");
              toast.info(message);
            }
            await load();
          })();
        },
      })),
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const reportWasteIssue = (id: string) => {
    Alert.alert(t("Report issue"), t("Select a reason"), [
      ...ISSUE_REASONS.map((reason) => ({
        text: t(reason.labelKey),
        onPress: () => {
          void (async () => {
            try {
              await collectorApi.issueReport(id, reason.value);
              toast.success(t("Issue reported"));
            } catch (err) {
              const message = err instanceof Error ? err.message : t("Issue saved to queue");
              toast.info(message);
            }
            await load();
          })();
        },
      })),
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const acceptOffer = async (offer: CollectorDispatchOffer) => {
    const secondsLeft = getOfferSecondsLeft(offer, Date.now());
    if (secondsLeft <= 0) {
      toast.info(t("This offer just expired. Refreshing list..."));
      await load();
      return;
    }
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await collectorApi.acceptOffer(offer.id);
      toast.success(t("Request accepted"));
      await handoffFromAcceptedOffer(result);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to accept request");
      toast.error(message);
    }
  };

  const rejectOffer = (offer: CollectorDispatchOffer) => {
    if (getOfferSecondsLeft(offer, Date.now()) <= 0) {
      void load();
      return;
    }
    showConfirmDialog({
      title: t("Reject request?"),
      message: t("We'll immediately forward this request to another nearby collector."),
      cancelText: t("Cancel"),
      confirmText: t("Reject"),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await collectorApi.rejectOffer(offer.id, "Collector unavailable");
            toast.success(t("Request forwarded"));
          } catch (err) {
            const message = err instanceof Error ? err.message : t("Failed to reject request");
            toast.error(message);
          }
          await load();
        })();
      },
    });
  };

  const segments = useMemo(() => {
    const allCount = pickupAssignments.length + reportAssignments.length;
    return [
      { key: "all" as const, label: t("All ({count})", { count: allCount }) },
      { key: "pickups" as const, label: t("Pickups ({count})", { count: pickupAssignments.length }) },
      { key: "reports" as const, label: t("Reports ({count})", { count: reportAssignments.length }) },
    ];
  }, [pickupAssignments.length, reportAssignments.length, t]);

  const cards = useMemo<AssignmentCard[]>(() => {
    const pickupCards = pickupAssignments.map<AssignmentCard>((pickup) => ({
      id: pickup.id,
      kind: "pickup",
      status: pickup.status,
      title: pickup.waste_type || t("Pickup"),
      areaText: pickup.address || t("No address provided"),
      residentName: pickup.resident_name,
      residentPhone: pickup.resident_phone,
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      scheduledAt: pickup.scheduled_date,
      fallbackAt: pickup.assigned_at,
      pickup,
    }));

    const reportCards = reportAssignments.map<AssignmentCard>((report) => ({
      id: report.id,
      kind: "report",
      status: report.status,
      title: report.report_type || t("Waste Report"),
      areaText: report.location_text || t("No location provided"),
      residentName: report.resident_name,
      residentPhone: report.resident_phone,
      latitude: report.latitude,
      longitude: report.longitude,
      scheduledAt: report.assigned_at,
      fallbackAt: report.created_at,
      report,
    }));

    if (view === "pickups") return pickupCards;
    if (view === "reports") return reportCards;
    return [...pickupCards, ...reportCards];
  }, [pickupAssignments, reportAssignments, view, t]);

  const groupedCards = useMemo<Record<AssignmentBucket, AssignmentCard[]>>(() => {
    const now = new Date();
    const grouped: Record<AssignmentBucket, AssignmentCard[]> = { urgent: [], today: [], upcoming: [] };

    for (const card of cards) {
      const scheduledDate = toDate(card.scheduledAt);
      const referenceDate = scheduledDate ?? toDate(card.fallbackAt);
      if (!referenceDate) {
        grouped.upcoming.push(card);
        continue;
      }

      if (card.kind === "pickup" && card.status === "assigned" && scheduledDate && scheduledDate.getTime() < now.getTime()) {
        grouped.urgent.push(card);
        continue;
      }

      if (isSameDay(referenceDate, now)) {
        grouped.today.push(card);
        continue;
      }

      if (referenceDate.getTime() < now.getTime()) {
        grouped.urgent.push(card);
        continue;
      }

      grouped.upcoming.push(card);
    }

    const byDate = (a: AssignmentCard, b: AssignmentCard) => {
      const aTime = toDate(a.scheduledAt)?.getTime() ?? toDate(a.fallbackAt)?.getTime() ?? 0;
      const bTime = toDate(b.scheduledAt)?.getTime() ?? toDate(b.fallbackAt)?.getTime() ?? 0;
      return aTime - bTime;
    };

    grouped.urgent.sort(byDate);
    grouped.today.sort(byDate);
    grouped.upcoming.sort(byDate);
    return grouped;
  }, [cards]);

  const sectionMeta: { key: AssignmentBucket; label: string; color: string }[] = [
    { key: "urgent", label: t("Urgent"), color: Colors.error },
    { key: "today", label: t("Today"), color: Colors.primary },
    { key: "upcoming", label: t("Upcoming"), color: Colors.secondary },
  ];

  const collectorName = user?.name?.split(" ")[0] || t("Collector");
  const collectorLocation =
    liveLocation?.trim() ||
    user?.neighborhood?.trim() ||
    pickupAssignments.find((item) => item.address)?.address ||
    reportAssignments.find((item) => item.location_text)?.location_text ||
    t("Location unavailable");
  const activeAssignmentsCount = pickupAssignments.length + reportAssignments.length;
  const todayProgressLabel = `${todayCompletedCount}/${todayTargetCount}`;
  const quickRouteTarget = groupedCards.urgent[0] ?? groupedCards.today[0] ?? groupedCards.upcoming[0] ?? null;
  const headerTopPadding = insets.top + webTopInset + 20;
  const fixedHeaderHeight = headerTopPadding + (quickRouteTarget ? 214 : 186);
  const pendingOffersSorted = useMemo(
    () =>
      [...pendingOffers].sort(
        (left, right) => getOfferSecondsLeft(left, offerClockMs) - getOfferSecondsLeft(right, offerClockMs)
      ),
    [offerClockMs, pendingOffers]
  );
  const pendingOfferStats = useMemo(
    () =>
      pendingOffersSorted.reduce(
        (acc, offer) => {
          const urgency = getOfferUrgency(getOfferSecondsLeft(offer, offerClockMs));
          if (urgency === "critical") acc.critical += 1;
          else if (urgency === "soon") acc.soon += 1;
          else if (urgency === "expired") acc.expired += 1;
          return acc;
        },
        { critical: 0, soon: 0, expired: 0 }
      ),
    [offerClockMs, pendingOffersSorted]
  );
  const pendingOfferHint = useMemo(() => {
    if (pendingOfferStats.critical > 0) {
      return t("{count} request(s) need immediate action.", { count: pendingOfferStats.critical });
    }
    if (pendingOfferStats.soon > 0) {
      return t("{count} request(s) are ending soon. Prioritize these first.", { count: pendingOfferStats.soon });
    }
    return t("Accept quickly to lock nearby tasks before they are offered to others.");
  }, [pendingOfferStats.critical, pendingOfferStats.soon, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[Colors.secondary, "#06B6D4"]}
        style={[styles.heroHeader, styles.heroHeaderFloating, { paddingTop: headerTopPadding }]}
        onLayout={(event) => {
          setHeroMeasuredHeight(event.nativeEvent.layout.height);
        }}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextBlock}>
            <AppText style={styles.heroGreeting} color="#fff">{t("Hello, {name}!", { name: collectorName })}</AppText>
            <View style={styles.heroLocationRow}>
              <Ionicons name={liveLocation ? "locate-outline" : "location-outline"} size={14} color="rgba(255,255,255,0.95)" />
              <AppText style={styles.heroLocationText} color="rgba(255,255,255,0.92)" numberOfLines={1}>
                {collectorLocation}
              </AppText>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [styles.heroLangBtn, pressed && { opacity: 0.9 }]}
              onPress={() => setLanguageMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("language.title")}
            >
              <Ionicons name="globe-outline" size={14} color="#fff" />
              <AppText style={styles.heroLangText} color="#fff">{language === "fr" ? "FR" : "EN"}</AppText>
              <Ionicons name="chevron-down" size={12} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => void refreshAll()}
              style={styles.heroRefreshBtn}
              accessibilityLabel={t("Refresh")}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <AppText style={styles.heroStatValue} color="#fff">{completionRate}%</AppText>
            <AppText style={styles.heroStatLabel} color="rgba(255,255,255,0.9)">{t("Completion Rate")}</AppText>
          </View>
          <View style={styles.heroStatCard}>
            <AppText style={styles.heroStatValue} color="#fff">{todayProgressLabel}</AppText>
            <AppText style={styles.heroStatLabel} color="rgba(255,255,255,0.9)">{t("Today Target")}</AppText>
          </View>
          <View style={styles.heroStatCard}>
            <AppText style={styles.heroStatValue} color="#fff">{activeAssignmentsCount}</AppText>
            <AppText style={styles.heroStatLabel} color="rgba(255,255,255,0.9)">{t("Active")}</AppText>
          </View>
        </View>

        {quickRouteTarget ? (
          <Pressable
            style={({ pressed }) => [styles.heroRouteButton, pressed && { opacity: 0.9 }]}
            onPress={() => openRouteTrace(quickRouteTarget)}
          >
            <Ionicons name="navigate-outline" size={16} color={Colors.secondary} />
            <AppText style={styles.heroRouteButtonText} color={Colors.secondary}>{t("Start Route")}</AppText>
            <AppText style={styles.heroRouteHint} color="#0f172a" numberOfLines={1}>
              {quickRouteTarget.kind === "pickup" ? t("Pickup") : t("Report")} - {quickRouteTarget.areaText}
            </AppText>
          </Pressable>
        ) : null}

        <AppText style={styles.heroSyncText} color="rgba(255,255,255,0.92)">
          {t("Last sync {time}", {
            time: lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : t("not yet"),
          })}
        </AppText>
      </LinearGradient>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 112,
          paddingTop: (heroMeasuredHeight || fixedHeaderHeight) + spacing.md,
          gap: spacing.md,
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={Colors.primary} />}
      >
        <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {segments.map((segment) => {
            const isActive = view === segment.key;
            return (
              <Pressable
                key={segment.key}
                style={({ pressed }) => [
                  styles.segment,
                  isActive && { backgroundColor: Colors.primary },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setView(segment.key)}
              >
                <AppText
                  style={styles.segmentText}
                  color={isActive ? "#fff" : colors.textSecondary}
                  numberOfLines={1}
                >
                  {segment.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

      {queuedActionsCount > 0 ? (
        <View style={[styles.offlineQueueCard, { backgroundColor: Colors.warning + "12", borderColor: Colors.warning }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={Colors.warning} />
          <View style={styles.offlineQueueTextWrap}>
            <AppText style={styles.offlineQueueTitle} color={Colors.warning}>
              {t("{count} queued action{suffix}", {
                count: queuedActionsCount,
                suffix: queuedActionsCount > 1 ? "s" : "",
              })}
            </AppText>
            <AppText style={styles.offlineQueueText} color={colors.textSecondary}>
              {t("Pending updates will sync when network is restored.")}
            </AppText>
          </View>
          <Pressable
            style={styles.offlineQueueButton}
            onPress={() =>
              void (async () => {
                await syncCollectorActionQueue();
                await load();
              })()
            }
          >
            <AppText style={styles.offlineQueueButtonText} color={Colors.warning}>{t("Retry")}</AppText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText style={styles.summaryLabel} color={colors.textSecondary}>{t("Assigned")}</AppText>
          <AppText style={styles.summaryValue} color={colors.text}>{cards.length}</AppText>
        </View>
        <View style={[styles.summaryChip, { borderColor: Colors.error + "33", backgroundColor: Colors.error + "12" }]}>
          <AppText style={styles.summaryLabel} color={Colors.error}>{t("Urgent")}</AppText>
          <AppText style={styles.summaryValue} color={Colors.error}>{groupedCards.urgent.length}</AppText>
        </View>
        <View style={[styles.summaryChip, { borderColor: Colors.primary + "33", backgroundColor: Colors.primary + "12" }]}>
          <AppText style={styles.summaryLabel} color={Colors.primary}>{t("Today")}</AppText>
          <AppText style={styles.summaryValue} color={Colors.primary}>{groupedCards.today.length}</AppText>
        </View>
        <View style={[styles.summaryChip, { borderColor: Colors.secondary + "33", backgroundColor: Colors.secondary + "12" }]}>
          <AppText style={styles.summaryLabel} color={Colors.secondary}>{t("Upcoming")}</AppText>
          <AppText style={styles.summaryValue} color={Colors.secondary}>{groupedCards.upcoming.length}</AppText>
        </View>
      </View>

      {pendingOffersSorted.length > 0 ? (
        <View style={[styles.pendingOffersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.pendingOffersHeader}>
            <View style={styles.pendingOffersHeaderMain}>
              <View style={[styles.pendingOffersDot, { backgroundColor: Colors.warning }]} />
              <AppText style={styles.pendingOffersTitle} color={colors.text}>
                {t("New requests waiting")}
              </AppText>
            </View>
            <View
              style={[
                styles.pendingOffersCountPill,
                {
                  borderColor: Colors.warning + "4D",
                  backgroundColor: Colors.warning + "14",
                },
              ]}
            >
              <AppText style={styles.pendingOffersCountText} color={Colors.warning}>
                {pendingOffersSorted.length}
              </AppText>
            </View>
          </View>
          <AppText style={styles.pendingOffersHint} color={colors.textSecondary}>
            {pendingOfferHint}
          </AppText>
          <View style={[styles.pendingOffersDivider, { backgroundColor: colors.border }]} />

          <View style={styles.pendingOfferList}>
            {pendingOffersSorted.map((offer) => {
              const isPickup = offer.entity_type === "pickup";
              const title = isPickup
                ? (offer.waste_type || t("Pickup request"))
                : (offer.report_type || t("Waste report"));
              const areaText = isPickup
                ? (offer.address || offer.resident_area || t("No address provided"))
                : (offer.location_text || offer.resident_area || t("No location provided"));
              const timestamp = isPickup ? offer.scheduled_date : offer.report_created_at;
              const when = timestamp ? new Date(timestamp) : null;
              const whenLabel = when && !Number.isNaN(when.getTime())
                ? when.toLocaleString()
                : t("No schedule");
              const distanceLabel = typeof offer.distance_km === "number"
                ? `${offer.distance_km.toFixed(1)} km`
                : t("Distance unavailable");
              const responseWindowSeconds = getOfferResponseWindowSeconds(offer);
              const secondsLeft = getOfferSecondsLeft(offer, offerClockMs);
              const isExpired = secondsLeft <= 0;
              const urgency = getOfferUrgency(secondsLeft);
              const urgencyColor =
                urgency === "critical"
                  ? Colors.error
                  : urgency === "soon"
                    ? Colors.warning
                    : urgency === "normal"
                      ? Colors.secondary
                      : colors.textSecondary;
              const countdownLabel = isExpired
                ? t("Expired")
                : urgency === "critical"
                  ? t("Ends in {time}", { time: formatOfferCountdown(secondsLeft) })
                  : t("Expires in {time}", { time: formatOfferCountdown(secondsLeft) });
              const responseWindowLabel = t("Response window: {time}", {
                time: formatOfferCountdown(responseWindowSeconds),
              });
              const acceptLabel = urgency === "critical" || urgency === "soon"
                ? t("Accept now")
                : t("Accept");
              const urgencyHint = isExpired
                ? t("Offer expired")
                : urgency === "critical"
                  ? t("Immediate response needed")
                  : urgency === "soon"
                    ? t("Respond soon to keep this request")
                    : t("Available now");

              return (
                <View
                  key={offer.id}
                  style={[
                    styles.pendingOfferItem,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      borderLeftWidth: 4,
                      borderLeftColor: urgencyColor,
                    },
                  ]}
                >
                  <View style={styles.pendingOfferTopRow}>
                    <View
                      style={[
                        styles.pendingOfferTypePill,
                        {
                          borderColor: isPickup ? Colors.primary + "44" : Colors.secondary + "44",
                          backgroundColor: isPickup ? Colors.primary + "16" : Colors.secondary + "16",
                        },
                      ]}
                    >
                      <AppText style={styles.pendingOfferTypeText} color={isPickup ? Colors.primary : Colors.secondary}>
                        {isPickup ? t("Pickup") : t("Report")}
                      </AppText>
                    </View>
                    <View style={styles.pendingOfferMetaWrap}>
                      <View style={styles.pendingOfferMetaRow}>
                        <AppText style={styles.pendingOfferDistance} color={colors.textSecondary}>{distanceLabel}</AppText>
                        <AppText style={styles.pendingOfferWindowText} color={colors.textSecondary}>
                          {responseWindowLabel}
                        </AppText>
                      </View>

                      <View
                        style={[
                          styles.pendingOfferCountdownPill,
                          {
                            borderColor: `${urgencyColor}55`,
                            backgroundColor: `${urgencyColor}12`,
                          },
                        ]}
                      >
                        <AppText
                          style={styles.pendingOfferCountdownText}
                          color={urgencyColor}
                        >
                          {countdownLabel}
                        </AppText>
                      </View>

                      <View style={styles.pendingOfferUrgencyRow}>
                        <View style={[styles.pendingOfferUrgencyDot, { backgroundColor: urgencyColor }]} />
                        <AppText
                          style={styles.pendingOfferUrgencyHint}
                          color={urgencyColor}
                        >
                          {urgencyHint}
                        </AppText>
                      </View>
                    </View>
                  </View>

                  <AppText style={styles.pendingOfferTaskTitle} color={colors.text}>{title}</AppText>
                  <AppText style={styles.pendingOfferLine} color={colors.textSecondary}>
                    {t("Resident")}: {offer.resident_name}
                  </AppText>
                  <AppText style={styles.pendingOfferLine} color={colors.textSecondary}>
                    {t("Area")}: {areaText}
                  </AppText>
                  <AppText style={styles.pendingOfferLine} color={colors.textSecondary}>
                    {isPickup ? t("Scheduled") : t("Created")}: {whenLabel}
                  </AppText>

                  <View style={styles.pendingOfferActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.pendingOfferAcceptBtn,
                        urgency === "critical" && styles.pendingOfferCriticalAcceptBtn,
                        urgency === "soon" && styles.pendingOfferSoonAcceptBtn,
                        isExpired && styles.pendingOfferDisabledBtn,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={() => void acceptOffer(offer)}
                      disabled={isExpired}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <AppText style={styles.pendingOfferAcceptText} color="#fff">{acceptLabel}</AppText>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.pendingOfferRejectBtn,
                        isExpired && styles.pendingOfferDisabledOutlineBtn,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={() => rejectOffer(offer)}
                      disabled={isExpired}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                      <AppText style={styles.pendingOfferRejectText} color={Colors.error}>{t("Reject")}</AppText>
                    </Pressable>
                    <Pressable
                      style={styles.pendingOfferCallBtn}
                      onPress={() => contactResident(offer.resident_phone)}
                    >
                      <Ionicons name="call-outline" size={16} color={Colors.secondary} />
                      <AppText style={styles.pendingOfferCallText} color={Colors.secondary}>{t("Call")}</AppText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {cards.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="checkbox-outline" size={36} color={colors.textSecondary} />
          <AppText style={{ marginTop: spacing.sm }} color={colors.textSecondary}>{t("No assignments right now")}</AppText>
        </View>
      ) : (
        <>
          {sectionMeta.map((section) => {
            const items = groupedCards[section.key];
            if (items.length === 0) return null;
            return (
              <View key={section.key} style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                  <AppText style={styles.sectionTitle} color={colors.textSecondary}>
                    {section.label} ({items.length})
                  </AppText>
                </View>

                <View style={styles.sectionCardsList}>
                  {items.map((item) => {
                    const when = toDate(item.scheduledAt) ?? toDate(item.fallbackAt);
                    const isPickup = item.kind === "pickup";
                    const cardAccent = isPickup
                      ? resolveWasteAccent(item.pickup?.waste_type ?? item.title)
                      : Colors.error;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.card,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderLeftWidth: 4,
                            borderLeftColor: cardAccent,
                          },
                        ]}
                      >
                        <View style={styles.headerRow}>
                          <View style={styles.titleBlock}>
                            <View
                              style={[
                                styles.kindPill,
                                {
                                  backgroundColor: isPickup ? Colors.primary + "18" : Colors.secondary + "18",
                                  borderColor: isPickup ? Colors.primary + "33" : Colors.secondary + "33",
                                },
                              ]}
                            >
                              <AppText style={styles.kindText} color={isPickup ? Colors.primary : Colors.secondary}>
                                {isPickup ? t("Pickup") : t("Report")}
                              </AppText>
                            </View>
                            <AppText style={styles.title} color={colors.text}>{item.title}</AppText>
                          </View>
                          <AppText style={styles.status} color={Colors.secondary}>{t(item.status)}</AppText>
                        </View>

                        <AppText style={styles.label} color={colors.textSecondary}>
                          {t("Resident")}: {item.residentName || t("Unknown")}
                        </AppText>
                        <AppText style={styles.label} color={colors.textSecondary}>
                          {t("Area")}: {item.areaText}
                        </AppText>
                        <AppText style={styles.label} color={colors.textSecondary}>
                          {t("Scheduled")}: {when ? when.toLocaleString() : t("No schedule")}
                        </AppText>

                        <View style={styles.actionsRow}>
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => openRouteTrace(item)}
                          >
                            <Ionicons name="map-outline" size={18} color={Colors.primary} />
                            <AppText style={styles.actionText} color={Colors.primary}>{t("Trace")}</AppText>
                          </Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => contactResident(item.residentPhone)}>
                            <Ionicons name="call-outline" size={18} color={Colors.secondary} />
                            <AppText style={styles.actionText} color={Colors.secondary}>{t("Call")}</AppText>
                          </Pressable>
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() =>
                              router.push({
                                pathname: "/(collector)/detail",
                                params: { id: item.id, kind: isPickup ? "pickup" : "report" },
                              })
                            }
                          >
                            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                            <AppText style={styles.actionText} color={colors.textSecondary}>{t("Details")}</AppText>
                          </Pressable>
                        </View>

                        <View style={styles.actionsRow}>
                          {isPickup && item.pickup?.status === "assigned" ? (
                            <Pressable style={styles.primaryBtn} onPress={() => void startJob(item.id)}>
                              <AppText style={styles.primaryText} color="#fff">{t("Start")}</AppText>
                            </Pressable>
                          ) : null}
                          {isPickup && item.pickup?.status === "in_progress" ? (
                            <Pressable
                              style={styles.primaryBtn}
                              onPress={() =>
                                router.push({
                                  pathname: "/(collector)/detail",
                                  params: { id: item.id, kind: "pickup" },
                                })
                              }
                            >
                              <AppText style={styles.primaryText} color="#fff">{t("Complete")}</AppText>
                            </Pressable>
                          ) : null}
                          {!isPickup && item.report?.status === "assigned" ? (
                            <Pressable
                              style={styles.primaryBtn}
                              onPress={() =>
                                router.push({
                                  pathname: "/(collector)/detail",
                                  params: { id: item.id, kind: "report" },
                                })
                              }
                            >
                              <AppText style={styles.primaryText} color="#fff">{t("Clean")}</AppText>
                            </Pressable>
                          ) : null}
                          <Pressable
                            style={styles.outlineBtn}
                            onPress={() => (isPickup ? reportPickupIssue(item.id) : reportWasteIssue(item.id))}
                          >
                            <AppText style={styles.outlineText} color={Colors.error}>{t("Issue")}</AppText>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>

    <React.Fragment>
      {languageMenuVisible ? (
        <View style={[styles.langOverlay, { paddingTop: headerTopPadding + 8 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLanguageMenuVisible(false)} />
          <View style={[styles.langMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText style={styles.langMenuTitle} color={colors.text}>{t("language.title")}</AppText>
            {options.map((option) => {
              const selected = option.code === language;
              return (
                <Pressable
                  key={option.code}
                  style={({ pressed }) => [styles.langOption, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    setLanguage(option.code);
                    setLanguageMenuVisible(false);
                  }}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={selected ? Colors.primary : colors.textSecondary}
                  />
                  <AppText style={styles.langOptionText} color={colors.text}>{t(option.labelKey)}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </React.Fragment>
  </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollArea: { flex: 1 },
  heroHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 17,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 11,
    overflow: "hidden",
  },
  heroHeaderFloating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroActions: { alignItems: "flex-end", gap: spacing.sm },
  heroLangBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  heroLangText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.semibold, color: "#fff" },
  heroTextBlock: { flex: 1, minWidth: 0 },
  heroGreeting: { fontSize: 24, fontFamily: fonts.bold, color: "#fff" },
  heroLocationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  heroLocationText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: "rgba(255,255,255,0.92)",
  },
  heroRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 6,
  },
  heroStatCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.xl,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  heroStatValue: { fontSize: 19, fontFamily: fonts.bold, color: "#fff" },
  heroStatLabel: { fontSize: fontSizes.xs - 1, fontFamily: fonts.medium, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  heroRouteButton: {
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroRouteButtonText: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: Colors.secondary },
  heroRouteHint: { flex: 1, fontSize: fontSizes.xs, fontFamily: fonts.medium, color: "#0f172a", opacity: 0.8 },
  heroSyncText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
    color: "rgba(255,255,255,0.92)",
  },
  langOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "flex-end",
    paddingRight: spacing.xl,
    zIndex: 50,
  },
  langMenu: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  langMenuTitle: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
  },
  langOptionText: { fontSize: fontSizes.sm, fontFamily: fonts.semibold },
  offlineQueueCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  offlineQueueTextWrap: { flex: 1 },
  offlineQueueTitle: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  offlineQueueText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.regular, marginTop: 2 },
  offlineQueueButton: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: "#ffffffaa" },
  offlineQueueButtonText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  pendingOffersCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.md + 2,
    gap: 11,
  },
  pendingOffersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pendingOffersHeaderMain: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  pendingOffersDot: { width: 10, height: 10, borderRadius: 6 },
  pendingOffersTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold },
  pendingOffersCountPill: {
    minWidth: 30,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingOffersCountText: { fontSize: fontSizes.xs, fontFamily: fonts.bold },
  pendingOffersHint: { fontSize: fontSizes.xs, fontFamily: fonts.regular, lineHeight: 17 },
  pendingOffersDivider: { height: 1, width: "100%" },
  pendingOfferList: { gap: 11 },
  pendingOfferItem: { borderWidth: 1, borderRadius: fontSizes.sm, padding: spacing.md, gap: spacing.sm },
  pendingOfferTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  pendingOfferTypePill: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: spacing.sm },
  pendingOfferTypeText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.semibold, textTransform: "uppercase", letterSpacing: 0.5 },
  pendingOfferMetaWrap: { alignItems: "flex-end", gap: 5, maxWidth: "68%" },
  pendingOfferMetaRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 },
  pendingOfferDistance: { fontSize: fontSizes.xs - 1, fontFamily: fonts.medium },
  pendingOfferCountdownPill: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 9 },
  pendingOfferCountdownText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.bold },
  pendingOfferWindowText: { fontSize: 10, fontFamily: fonts.semibold },
  pendingOfferUrgencyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pendingOfferUrgencyDot: { width: 6, height: 6, borderRadius: 3 },
  pendingOfferUrgencyHint: { fontSize: 10, fontFamily: fonts.semibold },
  pendingOfferTaskTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  pendingOfferLine: { fontSize: fontSizes.xs, fontFamily: fonts.regular, lineHeight: 17 },
  pendingOfferActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
  pendingOfferAcceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.md,
    minHeight: 38,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    backgroundColor: Colors.primary,
  },
  pendingOfferCriticalAcceptBtn: { backgroundColor: Colors.error },
  pendingOfferSoonAcceptBtn: { backgroundColor: Colors.accent },
  pendingOfferDisabledBtn: { backgroundColor: "#9CA3AF" },
  pendingOfferAcceptText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, color: "#fff" },
  pendingOfferRejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.md,
    minHeight: 38,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: Colors.error + "10",
  },
  pendingOfferDisabledOutlineBtn: {
    borderColor: "#9CA3AF",
    backgroundColor: "#9CA3AF22",
  },
  pendingOfferRejectText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  pendingOfferCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.md,
    minHeight: 38,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: Colors.secondary + "44",
    backgroundColor: Colors.secondary + "10",
  },
  pendingOfferCallText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  segmented: { flexDirection: "row", borderRadius: radius.xl, borderWidth: 1, padding: spacing.xs, gap: spacing.xs, marginTop: 2 },
  segment: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.md, alignItems: "center" },
  segmentText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryChip: { borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minWidth: 78 },
  summaryLabel: { fontSize: fontSizes.xs - 1, fontFamily: fonts.semibold, textTransform: "uppercase", letterSpacing: 0.8 },
  summaryValue: { fontSize: fontSizes.body, fontFamily: fonts.bold, marginTop: 2 },
  sectionBlock: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionDot: { width: 9, height: 9, borderRadius: 5 },
  sectionTitle: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, textTransform: "uppercase", letterSpacing: 0.8 },
  sectionCardsList: { gap: 10 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleBlock: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, paddingRight: spacing.sm },
  kindPill: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: spacing.sm },
  kindText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.semibold, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: fontSizes.button, fontFamily: fonts.semibold },
  status: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, textTransform: "capitalize" },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.regular },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  actionText: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: spacing.md + 2, borderRadius: radius.md },
  primaryText: { color: "#fff", fontFamily: fonts.semibold },
  outlineBtn: { borderWidth: 1, borderColor: Colors.error, paddingVertical: 10, paddingHorizontal: spacing.md + 2, borderRadius: radius.md },
  outlineText: { fontFamily: fonts.semibold },
  empty: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" },
});