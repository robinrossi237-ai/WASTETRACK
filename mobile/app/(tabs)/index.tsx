import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Alert,
  Modal,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useResidentTabSwipe } from "@/lib/use-resident-tab-swipe";
import { useTheme } from "@/lib/theme-context";
import { PickupRequest, WASTE_TYPES, WasteType } from "@/lib/types";
import { useToast } from "@/lib/toast-context";
import { locationApi, type CollectorLocation } from "@/lib/location-api";
import { normalizeMediaUrl } from "@/lib/media-url";
import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import {
  buildFallbackRoute,
  DOUALA_CENTER,
  formatDistance,
  formatDuration,
} from "@/lib/logistics-map";

const padTime = (value: number) => String(value).padStart(2, "0");

const formatIsoDate = (date: Date) =>
  `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const parts = value.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

const formatDisplayDate = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatDisplayTime = (value: string): string => {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map((p) => Number(p));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const buildScheduledDateTimeIso = (
  scheduledDate: string,
  scheduledTime: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string => {
  const datePart = scheduledDate.trim();
  const timePart = scheduledTime.trim();

  const candidate = timePart ? `${datePart}T${timePart}` : datePart;
  let parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime()) && timePart) {
    parsed = new Date(`${datePart}T${timePart}:00`);
  }

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(t("Invalid pickup date/time. Use YYYY-MM-DD and HH:mm."));
  }

  return parsed.toISOString();
};

const parsePickupScheduledAt = (scheduledDate: string, scheduledTime: string): Date | null => {
  const candidate = new Date(`${scheduledDate}T${scheduledTime || "00:00"}`);
  if (!Number.isNaN(candidate.getTime())) {
    return candidate;
  }
  const fallback = new Date(`${scheduledDate} ${scheduledTime || "00:00"}`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
};

const isPickupPastDue = (pickup: PickupRequest) => {
  if (pickup.status === "completed" || pickup.status === "cancelled") return false;
  if (pickup.status === "overdue") return true;
  const scheduledDate = parsePickupScheduledAt(pickup.scheduledDate, pickup.scheduledTime);
  if (!scheduledDate) return false;
  return scheduledDate.getTime() < Date.now();
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { language, setLanguage, t, options } = useLanguage();
  const {
    user,
    pickups,
    reports,
    refreshData,
    isLoading,
    reschedulePickup,
    confirmPickupCompletion,
    confirmReportCleanup,
  } = useApp();
  const toast = useToast();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const swipeHandlers = useResidentTabSwipe("index");
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [headerRefreshPending, setHeaderRefreshPending] = useState(false);
  const [collectorLocations, setCollectorLocations] = useState<CollectorLocation[]>([]);
  const [trackingCardIndex, setTrackingCardIndex] = useState(0);
  const [pickupConfirmationPendingIds, setPickupConfirmationPendingIds] = useState<string[]>([]);
  const [reportConfirmationPendingIds, setReportConfirmationPendingIds] = useState<string[]>([]);
  const pickupConfirmationPendingRef = useRef(new Set<string>());
  const reportConfirmationPendingRef = useRef(new Set<string>());
  const trackingCardWidth = Math.max(260, Math.min(viewportWidth - 40, 880));
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const initial = parseIsoDate(rescheduleDate) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    let isMounted = true;
    locationApi
      .listCollectorLocations()
      .then((locations) => {
        if (isMounted) {
          setCollectorLocations(locations);
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [pickups.length]);

  const pendingPickups = useMemo(
    () =>
      pickups
        .filter(
          (pickup) =>
            pickup.status !== "completed" && pickup.status !== "cancelled"
        )
        .sort((left, right) => {
          const leftDate = parsePickupScheduledAt(left.scheduledDate, left.scheduledTime);
          const rightDate = parsePickupScheduledAt(right.scheduledDate, right.scheduledTime);
          if (!leftDate && !rightDate) return 0;
          if (!leftDate) return 1;
          if (!rightDate) return -1;
          return leftDate.getTime() - rightDate.getTime();
        }),
    [pickups]
  );
  const activeReports = reports.filter(
    (report) => !["cleaned", "approved", "rejected", "cancelled"].includes(report.status)
  );
  const pendingPickupConfirmations = useMemo(
    () =>
      pickups
        .filter(
          (pickup) =>
            pickup.status === "completed" && pickup.residentConfirmationStatus === "pending"
        )
        .slice(0, 3),
    [pickups]
  );
  const pendingReportConfirmations = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            report.status === "cleaned" && report.residentConfirmationStatus === "pending"
        )
        .slice(0, 3),
    [reports]
  );
  const hasPendingResidentConfirmations =
    pendingPickupConfirmations.length > 0 || pendingReportConfirmations.length > 0;
  const nextPickup = pendingPickups[0] ?? null;
  const activePickupCount = pendingPickups.length;
  const openReportCount = activeReports.length;
  useEffect(() => {
    setTrackingCardIndex((previous) => {
      if (pendingPickups.length === 0) return 0;
      return Math.min(previous, pendingPickups.length - 1);
    });
  }, [pendingPickups.length]);

  const getCollectorLocationForPickup = (pickup: PickupRequest) => {
    if (pickup.assignedCollectorId) {
      const byId = collectorLocations.find(
        (collector) => collector.collector_id === pickup.assignedCollectorId
      );
      if (byId) return byId;
    }
    const byPickup = collectorLocations.find((collector) => collector.pickup_request_id === pickup.id);
    if (byPickup) return byPickup;
    if (pickup.assignedCollectorName) {
      const targetName = pickup.assignedCollectorName.trim().toLowerCase();
      if (targetName.length > 0) {
        const byName = collectorLocations.find(
          (collector) => collector.name.trim().toLowerCase() === targetName
        );
        if (byName) return byName;
      }
    }
    return null;
  };

  const getCollectorStatusLabel = (pickup: PickupRequest, collectorName: string | null) => {
    if (pickup.status === "pending") {
      return t("Waiting for collector acceptance");
    }
    if (pickup.status === "approved") {
      return t("Searching nearest collector");
    }
    if (pickup.status === "assigned") {
      return collectorName
        ? t("Accepted by {name}", { name: collectorName })
        : t("Collector accepted");
    }
    if (pickup.status === "in_progress") {
      return collectorName
        ? t("{name} is on the way", { name: collectorName })
        : t("Collector is on the way");
    }
    if (pickup.status === "cancelled") {
      return t("Cancelled");
    }
    if (pickup.status === "overdue") {
      return t("Overdue");
    }
    return t(
      pickup.status
        .split("_")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(" ")
    );
  };

  const handleTrackingScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / trackingCardWidth);
    if (nextIndex < 0 || nextIndex > pendingPickups.length - 1) return;
    setTrackingCardIndex(nextIndex);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'reported':
        return Colors.warning;
      case 'verified':
      case 'assigned':
      case 'in_progress':
        return Colors.secondary;
      case 'completed':
      case 'cleaned':
      case 'approved':
        return Colors.success;
      case 'overdue':
      case 'rejected':
      case 'cancelled':
        return Colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return t("In Progress");
      case 'illegal_dumping': return t("Illegal Dumping");
      case 'overflowing_bin': return t("Overflowing Bin");
      case 'cancelled': return t("Cancelled");
      default:
        return t(
          status
            .split('_')
            .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
            .join(' ')
        );
    }
  };

  const getReportLabel = (type: string) => {
    switch (type) {
      case 'illegal_dumping':
        return t("Illegal dumping issue");
      case 'overflowing_bin':
        return t("Overflowing bin issue");
      default:
        return t("Other issue");
    }
  };

  const getWasteColor = (type: WasteType) => {
    return Colors.waste[type] || Colors.primary;
  };

  const confirmResidentAction = (input: {
    title: string;
    message: string;
    cancelText: string;
    confirmText: string;
    destructive?: boolean;
    onConfirm: () => void;
  }) => {
    if (Platform.OS === "web") {
      const webConfirm = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
      if (typeof webConfirm === "function") {
        const payload = [input.title.trim(), input.message.trim()].filter(Boolean).join("\n\n");
        if (webConfirm(payload)) {
          input.onConfirm();
        }
        return;
      }
    }

    Alert.alert(input.title, input.message, [
      { text: input.cancelText, style: "cancel" },
      {
        text: input.confirmText,
        style: input.destructive ? "destructive" : "default",
        onPress: input.onConfirm,
      },
    ]);
  };

  const handlePickupResidentConfirmation = async (pickupId: string, approved: boolean) => {
    if (pickupConfirmationPendingRef.current.has(pickupId)) {
      return;
    }
    pickupConfirmationPendingRef.current.add(pickupId);
    setPickupConfirmationPendingIds((prev) =>
      prev.includes(pickupId) ? prev : [...prev, pickupId]
    );
    try {
      await confirmPickupCompletion(pickupId, approved);
      toast.success(approved ? t("Pickup completion approved") : t("Pickup completion rejected"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to submit pickup confirmation");
      toast.error(message);
    } finally {
      pickupConfirmationPendingRef.current.delete(pickupId);
      setPickupConfirmationPendingIds((prev) => prev.filter((id) => id !== pickupId));
    }
  };

  const handleReportResidentConfirmation = async (reportId: string, approved: boolean) => {
    if (reportConfirmationPendingRef.current.has(reportId)) {
      return;
    }
    reportConfirmationPendingRef.current.add(reportId);
    setReportConfirmationPendingIds((prev) =>
      prev.includes(reportId) ? prev : [...prev, reportId]
    );
    try {
      await confirmReportCleanup(reportId, approved);
      toast.success(approved ? t("Report cleanup approved") : t("Report cleanup rejected"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to submit report confirmation");
      toast.error(message);
    } finally {
      reportConfirmationPendingRef.current.delete(reportId);
      setReportConfirmationPendingIds((prev) => prev.filter((id) => id !== reportId));
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleFor || !rescheduleDate.trim() || !rescheduleTime.trim()) {
      toast.error(t("Please select a new date and time"));
      return;
    }
    try {
      const isoDate = buildScheduledDateTimeIso(rescheduleDate.trim(), rescheduleTime.trim(), t);
      await reschedulePickup(rescheduleFor, isoDate);
      setRescheduleFor(null);
      setRescheduleDate("");
      setRescheduleTime("");
      setDatePickerVisible(false);
      setTimePickerVisible(false);
      refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to reschedule pickup");
      toast.error(message);
    }
  };

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        slots.push(`${padTime(hour)}:${padTime(minutes)}`);
      }
    }
    return slots;
  }, []);

  const calendarDays = useMemo(() => {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [calendarCursor]);

  const weekdayLabels = useMemo(
    () => [t("Sun"), t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat")],
    [t]
  );

  const openDatePicker = () => {
    const base = parseIsoDate(rescheduleDate) ?? new Date();
    setCalendarCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setDatePickerVisible(true);
  };

  const openTimePicker = () => {
    setTimePickerVisible(true);
  };

  const handleSelectDate = (date: Date) => {
    setRescheduleDate(formatIsoDate(date));
    setDatePickerVisible(false);
  };

  const handleSelectTime = (time: string) => {
    setRescheduleTime(time);
    setTimePickerVisible(false);
  };

  const handleHeaderRefresh = async () => {
    if (headerRefreshPending || isLoading) {
      return;
    }
    setHeaderRefreshPending(true);
    try {
      await refreshData();
    } finally {
      setHeaderRefreshPending(false);
    }
  };

  if (!user) {
    return <Redirect href="/(public)/get-started" />;
  }

  const headerTopPadding = insets.top + webTopInset + 20;
  const fixedHeaderHeight = headerTopPadding + 118;
  const firstName = user.name.split(" ")[0] || user.name;
  const residentLabel = user.neighborhood
    ? t("home.areaResident", { area: user.neighborhood })
    : t("home.resident");

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeHandlers}
    >
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={[styles.header, styles.headerFloating, { paddingTop: headerTopPadding }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <AppText style={styles.greeting} color="#fff">{t("home.greeting", { name: firstName })}</AppText>
            <AppText style={styles.subtitle} color="rgba(255,255,255,0.8)">
              {residentLabel}
            </AppText>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerTopActions}>
              <Pressable
                style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.9 }]}
                onPress={() => setLanguageMenuVisible(true)}
              >
                <Ionicons name="globe-outline" size={14} color="#fff" />
                <AppText style={styles.langText} color="#fff">{language === "fr" ? "FR" : "EN"}</AppText>
                <Ionicons name="chevron-down" size={12} color="#fff" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Refresh")}
                style={({ pressed }) => [
                  styles.headerRefreshButton,
                  (isLoading || headerRefreshPending) && styles.headerRefreshButtonDisabled,
                  pressed && { opacity: 0.9 },
                ]}
                disabled={isLoading || headerRefreshPending}
                onPress={() => {
                  void handleHeaderRefresh();
                }}
              >
                <Ionicons
                  name={isLoading || headerRefreshPending ? "sync-outline" : "refresh-outline"}
                  size={14}
                  color="#fff"
                />
              </Pressable>
            </View>
            <View style={styles.pointsBadge}>
              <Ionicons name="star" size={16} color={Colors.accent} />
              <AppText style={styles.pointsText} color="#fff">{user.points}</AppText>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingTop: fixedHeaderHeight + 8, paddingBottom: 112 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={Colors.primary} />
        }
      >
        <View style={styles.content}>
          <View style={styles.commandGrid}>
          <View style={[styles.commandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.commandHeader}>
              <View style={[styles.commandIcon, { backgroundColor: Colors.primary + "12" }]}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              </View>
              <AppText style={styles.commandLabel} color={colors.textSecondary}>{t("Next pickup")}</AppText>
            </View>
            <AppText style={styles.commandValue} color={colors.text}>
              {nextPickup
                ? `${formatDisplayDate(nextPickup.scheduledDate)} - ${formatDisplayTime(nextPickup.scheduledTime)}`
                : t("No active pickup")}
            </AppText>
              <AppText style={styles.commandHint} color={colors.textSecondary}>
                {nextPickup
                  ? t("{waste} pickup", {
                  waste: t(WASTE_TYPES.find((w) => w.type === nextPickup.wasteType)?.label ?? "Waste"),
                })
                : t("Request a pickup to start tracking progress.")}
            </AppText>
          </View>

          <View style={[styles.commandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.commandHeader}>
              <View style={[styles.commandIcon, { backgroundColor: Colors.secondary + "14" }]}>
                <Ionicons name="layers-outline" size={18} color={Colors.secondary} />
              </View>
              <AppText style={styles.commandLabel} color={colors.textSecondary}>{t("Active pickups")}</AppText>
            </View>
            <AppText style={styles.commandValue} color={colors.text}>{activePickupCount}</AppText>
            <AppText style={styles.commandHint} color={colors.textSecondary}>
              {activePickupCount > 0
                ? t("Track your current pickup requests in real time.")
                : t("No active pickup requests right now.")}
            </AppText>
          </View>

          <View style={[styles.commandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.commandHeader}>
              <View style={[styles.commandIcon, { backgroundColor: Colors.warning + "14" }]}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
              </View>
              <AppText style={styles.commandLabel} color={colors.textSecondary}>{t("Open reports")}</AppText>
            </View>
            <AppText style={styles.commandValue} color={colors.text}>{openReportCount}</AppText>
            <AppText style={styles.commandHint} color={colors.textSecondary}>
              {openReportCount > 0
                ? t("Community reports waiting for collector action.")
                : t("No active community reports.")}
            </AppText>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.commandGrid,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, padding: spacing.md + 2, flexDirection: "row", alignItems: "center", gap: spacing.md },
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
          onPress={() => router.push("/learn" as any)}
          testID="home-learn-nav"
        >
          <View style={[styles.commandIcon, { backgroundColor: Colors.success + "12" }]}>
            <Ionicons name="leaf" size={20} color={Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={styles.commandLabel} color={colors.text}>{t("Learn & Recycling Tips")}</AppText>
            <AppText style={styles.commandHint} color={colors.textSecondary}>
              {t("Practical advice to manage waste responsibly.")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        {hasPendingResidentConfirmations ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Awaiting your confirmation")}</AppText>

            {pendingPickupConfirmations.map((pickup) => {
              const isSubmittingPickupConfirmation = pickupConfirmationPendingIds.includes(pickup.id);
              return (
              <View
                key={`pickup-confirm-${pickup.id}`}
                style={[styles.confirmationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.confirmationHeaderRow}>
                  <AppText style={styles.confirmationCardTitle} color={colors.text}>
                    {t("Pickup completion proof")}
                  </AppText>
                  <View style={[styles.statusBadge, { backgroundColor: Colors.warning + "20" }]}>
                    <AppText style={styles.statusText} color={Colors.warning}>{t("Pending")}</AppText>
                  </View>
                </View>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {t("{waste} pickup", {
                    waste: t(WASTE_TYPES.find((w) => w.type === pickup.wasteType)?.label ?? "Waste"),
                  })}
                </AppText>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {pickup.assignedCollectorName
                    ? t("Collector: {name}", { name: pickup.assignedCollectorName })
                    : t("Collector not available")}
                </AppText>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {t("Submitted at {date}", {
                    date: formatDateTime(pickup.completionSubmittedAt || pickup.completedAt),
                  })}
                </AppText>
                <View
                  style={[
                    styles.confirmationProofCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary ?? colors.background,
                    },
                  ]}
                >
                  <AppText style={styles.confirmationProofTitle} color={colors.text}>{t("Completion photo")}</AppText>
                  <BeforeAfterGallery
                    beforeUri={normalizeMediaUrl(pickup.photoUri)}
                    afterUri={normalizeMediaUrl(pickup.completionPhotoUri)}
                    beforeLabel={t("Before")}
                    afterLabel={t("After")}
                  />
                </View>
                <AppText style={styles.confirmationNote} color={colors.textSecondary}>
                  {pickup.completionNote?.trim() || t("No completion note provided")}
                </AppText>
                <View style={styles.confirmationActionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmationApproveButton,
                      isSubmittingPickupConfirmation && styles.confirmationActionDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                    disabled={isSubmittingPickupConfirmation}
                    onPress={() =>
                      confirmResidentAction({
                        title: t("Approve completion"),
                        message: t("Confirm this pickup was completed successfully?"),
                        cancelText: t("Cancel"),
                        confirmText: t("Approve"),
                        onConfirm: () => void handlePickupResidentConfirmation(pickup.id, true),
                      })
                    }
                  >
                    <AppText style={styles.confirmationApproveText} color="#fff">
                      {isSubmittingPickupConfirmation ? t("Submitting...") : t("Approve")}
                    </AppText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmationRejectButton,
                      isSubmittingPickupConfirmation && styles.confirmationActionDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                    disabled={isSubmittingPickupConfirmation}
                    onPress={() =>
                      confirmResidentAction({
                        title: t("Reject completion"),
                        message: t("We'll assign another nearby collector if you reject this proof."),
                        cancelText: t("Keep"),
                        confirmText: t("Reject"),
                        destructive: true,
                        onConfirm: () => void handlePickupResidentConfirmation(pickup.id, false),
                      })
                    }
                  >
                    <AppText style={styles.confirmationRejectText} color={Colors.error}>
                      {isSubmittingPickupConfirmation ? t("Submitting...") : t("Reject")}
                    </AppText>
                  </Pressable>
                </View>
              </View>
              );
            })}

            {pendingReportConfirmations.map((report) => {
              const isSubmittingReportConfirmation = reportConfirmationPendingIds.includes(report.id);
              return (
              <View
                key={`report-confirm-${report.id}`}
                style={[styles.confirmationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.confirmationHeaderRow}>
                  <AppText style={styles.confirmationCardTitle} color={colors.text}>
                    {t("Report cleanup proof")}
                  </AppText>
                  <View style={[styles.statusBadge, { backgroundColor: Colors.warning + "20" }]}>
                    <AppText style={styles.statusText} color={Colors.warning}>{t("Pending")}</AppText>
                  </View>
                </View>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {getReportLabel(report.type)}
                </AppText>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {report.location}
                </AppText>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {report.assignedCollectorName
                    ? t("Collector: {name}", { name: report.assignedCollectorName })
                    : t("Collector not available")}
                </AppText>
                <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                  {t("Submitted at {date}", { date: formatDateTime(report.cleanedAt) })}
                </AppText>
                <View
                  style={[
                    styles.confirmationProofCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary ?? colors.background,
                    },
                  ]}
                >
                  <AppText style={styles.confirmationProofTitle} color={colors.text}>{t("Cleanup photo")}</AppText>
                  <BeforeAfterGallery
                    beforeUri={normalizeMediaUrl(report.photoUri)}
                    afterUri={normalizeMediaUrl(report.cleanedPhotoUri)}
                    beforeLabel={t("Before")}
                    afterLabel={t("After")}
                  />
                </View>
                <AppText style={styles.confirmationNote} color={colors.textSecondary}>
                  {report.cleanedNote?.trim() || t("No cleanup note provided")}
                </AppText>
                <View style={styles.confirmationActionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmationApproveButton,
                      isSubmittingReportConfirmation && styles.confirmationActionDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                    disabled={isSubmittingReportConfirmation}
                    onPress={() =>
                      confirmResidentAction({
                        title: t("Approve cleanup"),
                        message: t("Confirm this report cleanup is valid?"),
                        cancelText: t("Cancel"),
                        confirmText: t("Approve"),
                        onConfirm: () => void handleReportResidentConfirmation(report.id, true),
                      })
                    }
                  >
                    <AppText style={styles.confirmationApproveText} color="#fff">
                      {isSubmittingReportConfirmation ? t("Submitting...") : t("Approve")}
                    </AppText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmationRejectButton,
                      isSubmittingReportConfirmation && styles.confirmationActionDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                    disabled={isSubmittingReportConfirmation}
                    onPress={() =>
                      confirmResidentAction({
                        title: t("Reject cleanup"),
                        message: t("We'll assign another nearby collector if you reject this proof."),
                        cancelText: t("Keep"),
                        confirmText: t("Reject"),
                        destructive: true,
                        onConfirm: () => void handleReportResidentConfirmation(report.id, false),
                      })
                    }
                  >
                    <AppText style={styles.confirmationRejectText} color={Colors.error}>
                      {isSubmittingReportConfirmation ? t("Submitting...") : t("Reject")}
                    </AppText>
                  </Pressable>
                </View>
              </View>
              );
            })}
          </View>
        ) : null}

          {pendingPickups.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.trackingSectionHeader}>
                <AppText style={styles.sectionTitle} color={colors.text}>{t("Pickup Tracking")}</AppText>
                {pendingPickups.length > 1 ? (
                  <AppText style={styles.trackingSectionHint} color={colors.textSecondary}>
                    {t("Swipe left or right to view each active pickup.")}
                  </AppText>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={trackingCardWidth}
                snapToAlignment="start"
                onMomentumScrollEnd={handleTrackingScrollEnd}
                contentContainerStyle={styles.trackingCarouselContent}
              >
                {pendingPickups.map((pickup) => {
                  const pickupPoint =
                    typeof pickup.latitude === "number" && typeof pickup.longitude === "number"
                      ? { lat: pickup.latitude, lng: pickup.longitude }
                      : { lat: DOUALA_CENTER.lat + 0.012, lng: DOUALA_CENTER.lng + 0.012 };
                  const assignedCollectorLocation = getCollectorLocationForPickup(pickup);
                  const trackingRouteSummary = assignedCollectorLocation
                    ? buildFallbackRoute(
                        { lat: assignedCollectorLocation.latitude, lng: assignedCollectorLocation.longitude },
                        pickupPoint
                      )
                    : null;
                  const trackedCollectorName =
                    pickup.assignedCollectorName || assignedCollectorLocation?.name || null;
                  const canTrackPickupRoute = ["assigned", "in_progress"].includes(pickup.status);
                  const collectorStatusLabel = getCollectorStatusLabel(pickup, trackedCollectorName);
                  const trackingDistanceLabel = trackingRouteSummary
                    ? formatDistance(trackingRouteSummary.distanceKm)
                    : t("Distance unavailable");
                  const trackingEtaLabel = trackingRouteSummary
                    ? formatDuration(trackingRouteSummary.durationMin)
                    : t("ETA pending");
                  const overdue = isPickupPastDue(pickup);
                  const statusColor = overdue ? Colors.error : getStatusColor(pickup.status);

                  return (
                    <View key={pickup.id} style={[styles.trackingCarouselPage, { width: trackingCardWidth }]}>
                      <View
                        style={[
                          styles.trackingCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: overdue ? Colors.error + "66" : colors.border,
                            borderLeftWidth: 4,
                            borderLeftColor: overdue ? Colors.error : getWasteColor(pickup.wasteType),
                          },
                        ]}
                      >
                        <View style={styles.trackingTopRow}>
                          <View style={styles.trackingTitleWrap}>
                            <AppText style={styles.trackingTitle} color={colors.text}>
                              {t("{waste} pickup", {
                                waste: t(WASTE_TYPES.find((w) => w.type === pickup.wasteType)?.label ?? "Waste"),
                              })}
                            </AppText>
                            <AppText style={styles.trackingSubtitle} color={colors.textSecondary}>
                              {t("{date} at {time}", {
                                date: pickup.scheduledDate,
                                time: pickup.scheduledTime,
                              })}
                            </AppText>
                          </View>
                          <View
                            style={[
                              styles.trackingStatusBadge,
                              {
                                borderColor: statusColor + "4A",
                                backgroundColor: statusColor + "14",
                              },
                            ]}
                          >
                            <AppText style={styles.trackingStatusText} color={statusColor}>
                              {overdue ? t("Overdue") : getStatusLabel(pickup.status)}
                            </AppText>
                          </View>
                        </View>
                        <View style={[styles.trackingDivider, { backgroundColor: colors.border }]} />

                        <View style={[styles.trackingCollectorBlock, { backgroundColor: colors.surfaceSecondary ?? colors.background }]}>
                          <View style={[styles.trackingCollectorIconWrap, { backgroundColor: Colors.primary + "16" }]}>
                            <Ionicons
                              name={trackedCollectorName ? "person-circle-outline" : "time-outline"}
                              size={18}
                              color={Colors.primary}
                            />
                          </View>
                          <View style={styles.trackingCollectorInfo}>
                            <AppText style={styles.trackingCollectorLabel} color={colors.textSecondary}>
                              {t("Collector status")}
                            </AppText>
                            <AppText style={styles.trackingCollectorValue} color={colors.text}>
                              {collectorStatusLabel}
                            </AppText>
                            {trackedCollectorName ? (
                              <AppText style={styles.trackingCollectorMeta} color={colors.textSecondary}>
                                {t("Collector")}: {trackedCollectorName}
                              </AppText>
                            ) : null}
                          </View>
                        </View>

                        <View
                          style={[
                            styles.trackingReadyBadge,
                            {
                              borderColor: canTrackPickupRoute ? Colors.success + "55" : Colors.warning + "55",
                              backgroundColor: canTrackPickupRoute ? Colors.success + "14" : Colors.warning + "14",
                            },
                          ]}
                        >
                          <Ionicons
                            name={canTrackPickupRoute ? "checkmark-circle-outline" : "hourglass-outline"}
                            size={15}
                            color={canTrackPickupRoute ? Colors.success : Colors.warning}
                          />
                          <AppText
                            style={styles.trackingReadyText}
                            color={canTrackPickupRoute ? Colors.success : Colors.warning}
                          >
                            {canTrackPickupRoute ? t("Collector accepted") : t("Waiting for collector acceptance")}
                          </AppText>
                        </View>

                        <View style={styles.trackingMetricsRow}>
                          <View style={[styles.trackingMetricChip, { borderColor: colors.border }]}>
                            <Ionicons name="git-compare-outline" size={14} color={Colors.secondary} />
                            <View style={styles.trackingMetricContent}>
                              <AppText style={styles.trackingMetricLabel} color={colors.textSecondary}>
                                {t("Distance")}
                              </AppText>
                              <AppText style={styles.trackingMetricValue} color={colors.text}>
                                {trackingDistanceLabel}
                              </AppText>
                            </View>
                          </View>
                          <View style={[styles.trackingMetricChip, { borderColor: colors.border }]}>
                            <Ionicons name="time-outline" size={14} color={Colors.primary} />
                            <View style={styles.trackingMetricContent}>
                              <AppText style={styles.trackingMetricLabel} color={colors.textSecondary}>
                                {t("ETA")}
                              </AppText>
                              <AppText style={styles.trackingMetricValue} color={colors.text}>
                                {trackingEtaLabel}
                              </AppText>
                            </View>
                          </View>
                        </View>

                        <Pressable
                          style={({ pressed }) => [
                            styles.trackingCta,
                            { backgroundColor: canTrackPickupRoute ? Colors.primary : "#9CA3AF" },
                            pressed && { opacity: 0.92 },
                          ]}
                          disabled={!canTrackPickupRoute}
                          onPress={() =>
                            router.push({
                              pathname: "/pickup/tracking",
                              params: {
                                pickupId: pickup.id,
                                wasteType: pickup.wasteType,
                                address: pickup.address,
                                scheduledDate: pickup.scheduledDate,
                                scheduledTime: pickup.scheduledTime,
                              },
                            })
                          }
                        >
                          <Ionicons name="navigate-outline" size={16} color="#fff" />
                          <AppText style={styles.trackingCtaText} color="#fff">
                            {canTrackPickupRoute ? t("Track collector route") : t("Waiting for collector")}
                          </AppText>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {pendingPickups.length > 1 ? (
                <View style={styles.trackingDotsRow}>
                  {pendingPickups.map((pickup, index) => (
                    <View
                      key={`tracking-dot-${pickup.id}`}
                      style={[
                        styles.trackingDot,
                        {
                          backgroundColor:
                            index === trackingCardIndex ? colors.textSecondary : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {pendingPickups.length === 0 && !hasPendingResidentConfirmations ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="leaf-outline" size={48} color={colors.textSecondary} />
              <AppText style={styles.emptyTitle} color={colors.text}>{t("All caught up!")}</AppText>
              <AppText style={styles.emptyText} color={colors.textSecondary}>
                {t("No active pickup tracking right now.")}
              </AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={languageMenuVisible} transparent animationType="fade">
        <View style={[styles.langOverlay, { paddingTop: headerTopPadding + 8 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLanguageMenuVisible(false)}
          />
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
                  <AppText style={styles.langOptionText} color={colors.text}>
                    {t(option.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={!!rescheduleFor} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText style={styles.modalTitle} color={colors.text}>{t("Reschedule pickup")}</AppText>
            <AppText style={styles.modalHint} color={colors.textSecondary}>
              {t("Pick a new date and time for your pickup.")}
            </AppText>
            <View style={styles.scheduleRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.inputWrapper,
                  { backgroundColor: colors.surfaceSecondary ?? colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={openDatePicker}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <AppText
                  style={styles.inputText}
                  color={rescheduleDate ? colors.text : colors.textSecondary}
                >
                  {rescheduleDate ? formatDisplayDate(rescheduleDate) : t("Select date")}
                </AppText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.inputWrapper,
                  { backgroundColor: colors.surfaceSecondary ?? colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={openTimePicker}
              >
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <AppText
                  style={styles.inputText}
                  color={rescheduleTime ? colors.text : colors.textSecondary}
                >
                  {rescheduleTime ? formatDisplayTime(rescheduleTime) : t("Select time")}
                </AppText>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setRescheduleFor(null);
                  setRescheduleDate("");
                  setRescheduleTime("");
                  setDatePickerVisible(false);
                  setTimePickerVisible(false);
                }}
              >
                <AppText style={styles.actionLink} color={colors.textSecondary}>{t("Cancel")}</AppText>
              </Pressable>
              <Pressable onPress={handleReschedule}>
                <AppText style={styles.actionLink} color={Colors.primary}>{t("Save")}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={datePickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.pickerHeader}>
              <Pressable
                onPress={() =>
                  setCalendarCursor(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                style={styles.pickerNavBtn}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <AppText style={styles.pickerTitle} color={colors.text}>
                {calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </AppText>
              <Pressable
                onPress={() =>
                  setCalendarCursor(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                style={styles.pickerNavBtn}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.weekdayRow}>
              {weekdayLabels.map((day) => (
                <AppText key={day} style={styles.weekdayText} color={colors.textSecondary}>
                  {day}
                </AppText>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, idx) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isDisabled = !day || day < today;
                const isSelected =
                  day &&
                  rescheduleDate &&
                  formatIsoDate(day) === rescheduleDate;

                return (
                  <Pressable
                    key={`${day?.toISOString() ?? "empty"}-${idx}`}
                    style={({ pressed }) => [
                      styles.calendarCell,
                      isSelected && { backgroundColor: Colors.primary },
                      pressed && !isDisabled && { opacity: 0.85 },
                    ]}
                    onPress={() => day && !isDisabled && handleSelectDate(day)}
                    disabled={isDisabled}
                  >
                    <AppText
                      style={styles.calendarCellText}
                      color={isDisabled ? colors.textSecondary : colors.text}
                    >
                      {day ? day.getDate() : ""}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.pickerFooter}>
              <Pressable onPress={() => setDatePickerVisible(false)} style={styles.pickerSecondaryBtn}>
                <AppText style={styles.pickerSecondaryText} color={colors.textSecondary}>{t("Close")}</AppText>
              </Pressable>
              <Pressable
                onPress={() => handleSelectDate(new Date())}
                style={[styles.pickerPrimaryBtn, { backgroundColor: Colors.primary }]}
              >
                <AppText style={styles.pickerPrimaryText} color="#fff">{t("Today")}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={timePickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.pickerHeader}>
              <AppText style={styles.pickerTitle} color={colors.text}>{t("Select time")}</AppText>
              <Pressable onPress={() => setTimePickerVisible(false)} style={styles.pickerNavBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.timeList} contentContainerStyle={{ paddingBottom: 6 }}>
              {timeSlots.map((slot) => {
                const isSelected = rescheduleTime === slot;
                return (
                  <Pressable
                    key={slot}
                    style={({ pressed }) => [
                      styles.timeSlot,
                      isSelected && { backgroundColor: Colors.primary + "18" },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => handleSelectTime(slot)}
                  >
                    <AppText
                      style={styles.timeSlotText}
                      color={isSelected ? Colors.primary : colors.text}
                    >
                      {formatDisplayTime(slot)}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  header: {
    paddingBottom: 30,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerFloating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 10,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  headerTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  greeting: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    marginTop: spacing.xs,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    gap: 6,
    alignSelf: "flex-start",
  },
  pointsText: {
    fontSize: fontSizes.button,
    fontFamily: fonts.semibold,
    color: "#fff",
  },
  langButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  langText: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.semibold,
    color: "#fff",
  },
  headerRefreshButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  headerRefreshButtonDisabled: {
    opacity: 0.65,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
  },
  commandGrid: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  commandCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: 14,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  commandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  commandIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  commandLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  commandValue: {
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
  },
  commandHint: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    lineHeight: 17,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    marginBottom: spacing.md,
  },
  trackingSectionHeader: {
    marginBottom: 10,
    gap: spacing.xs,
  },
  trackingSectionHint: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
  },
  trackingCarouselContent: {
    paddingRight: spacing.sm,
  },
  trackingCarouselPage: {
    paddingRight: spacing.sm,
  },
  trackingDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },
  trackingDot: {
    width: 26,
    height: 4,
    borderRadius: radius.full,
  },
  confirmationCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.md,
    marginBottom: 10,
    gap: 7,
  },
  confirmationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  confirmationCardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.md,
    fontFamily: fonts.semibold,
  },
  confirmationMeta: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
  },
  confirmationProofCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  confirmationProofTitle: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.semibold,
  },
  confirmationNote: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  confirmationActionRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    gap: 10,
  },
  confirmationApproveButton: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: Colors.success,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationApproveText: {
    color: "#fff",
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
  },
  confirmationRejectButton: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.error + "55",
    backgroundColor: Colors.error + "10",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationRejectText: {
    color: Colors.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
  },
  confirmationActionDisabled: {
    opacity: 0.6,
  },
  trackingCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    gap: spacing.md,
  },
  trackingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  trackingTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  trackingTitle: {
    fontSize: fontSizes.button,
    fontFamily: fonts.semibold,
  },
  trackingSubtitle: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    marginTop: 3,
  },
  trackingStatusBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  trackingStatusText: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.bold,
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },
  trackingDivider: {
    height: 1,
    width: "100%",
  },
  trackingCollectorBlock: {
    borderRadius: radius.xl,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  trackingCollectorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  trackingCollectorInfo: { flex: 1, minWidth: 0 },
  trackingCollectorLabel: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.medium,
  },
  trackingCollectorValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
    marginTop: 1,
  },
  trackingCollectorMeta: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  trackingReadyBadge: {
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trackingReadyText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.semibold,
  },
  trackingMetricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  trackingMetricChip: {
    flex: 1,
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  trackingMetricContent: {
    flex: 1,
    minWidth: 0,
  },
  trackingMetricLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  trackingMetricValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
    marginTop: 1,
  },
  trackingCta: {
    marginTop: 2,
    borderRadius: radius.lg,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  trackingCtaText: {
    color: "#fff",
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.semibold,
    textTransform: "capitalize",
  },
  actionLink: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  emptyState: {
    alignItems: "center",
    padding: spacing.xxxl,
    borderRadius: radius.xxl,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  langOverlay: {
    flex: 1,
    alignItems: "flex-end",
    paddingRight: spacing.xl,
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
  langOptionText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  scheduleRow: { flexDirection: "row", gap: 10 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputText: {
    flex: 1,
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  pickerCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  pickerTitle: {
    fontSize: fontSizes.button,
    fontFamily: fonts.semibold,
  },
  pickerNavBtn: {
    padding: 6,
    borderRadius: radius.lg,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  weekdayText: {
    width: "14.2%",
    textAlign: "center",
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.2%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    marginBottom: 6,
  },
  calendarCellText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
  pickerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  pickerSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  pickerSecondaryText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
  },
  pickerPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  pickerPrimaryText: {
    color: "#fff",
    fontSize: fontSizes.md,
    fontFamily: fonts.semibold,
  },
  timeList: {
    maxHeight: 280,
  },
  timeSlot: {
    paddingVertical: spacing.md,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  timeSlotText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
  },
});