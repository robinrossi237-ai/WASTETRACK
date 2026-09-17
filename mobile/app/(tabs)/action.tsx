import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import ReschedulePickupModal from "@/components/ReschedulePickupModal";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { WASTE_TYPES, type Report, type WasteType } from "@/lib/types";

const formatDisplayDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatDisplayTime = (value: string): string => {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const parsePickupSchedule = (date: string, time: string): Date | null => {
  const isoCandidate = new Date(`${date}T${time || "00:00"}`);
  if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate;
  const fallback = new Date(`${date} ${time || "00:00"}`);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
};

const canCancelReport = (status: string) => status !== "cancelled";

export default function ActionScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const { pickups, reports, cancelPickup, cancelReport, reschedulePickup } = useApp();
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    pickupId: string;
    date: string;
    time: string;
  } | null>(null);

  const getWasteColor = (type: WasteType) => Colors.waste[type] || Colors.primary;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
      case "reported":
        return Colors.warning;
      case "verified":
      case "assigned":
      case "in_progress":
        return Colors.secondary;
      case "completed":
      case "cleaned":
      case "approved":
        return Colors.success;
      case "overdue":
      case "cancelled":
      case "rejected":
        return Colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) =>
    t(
      status
        .split("_")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(" ")
    );

  const getReportLabel = (type: Report["type"]) => {
    if (type === "illegal_dumping") return t("Illegal dumping issue");
    if (type === "overflowing_bin") return t("Overflowing bin issue");
    return t("Other issue");
  };

  const isPickupPastDue = (pickup: (typeof pickups)[number]) => {
    if (pickup.status === "completed" || pickup.status === "cancelled") return false;
    if (pickup.status === "overdue") return true;
    const scheduled = parsePickupSchedule(pickup.scheduledDate, pickup.scheduledTime);
    if (!scheduled) return false;
    return scheduled.getTime() < Date.now();
  };

  const activePickups = useMemo(
    () =>
      pickups
        .filter((pickup) => pickup.status !== "completed" && pickup.status !== "cancelled")
        .sort((left, right) => {
          const leftDate = parsePickupSchedule(left.scheduledDate, left.scheduledTime);
          const rightDate = parsePickupSchedule(right.scheduledDate, right.scheduledTime);
          if (!leftDate && !rightDate) return 0;
          if (!leftDate) return 1;
          if (!rightDate) return -1;
          return leftDate.getTime() - rightDate.getTime();
        })
        .slice(0, 6),
    [pickups]
  );

  const activeReports = useMemo(
    () =>
      reports
        .filter((report) => !["cleaned", "approved", "rejected", "cancelled"].includes(report.status))
        .slice(0, 6),
    [reports]
  );

  const handleCancelPickup = async (id: string) => {
    try {
      await cancelPickup(id);
      toast.success(t("Pickup cancelled"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to cancel pickup");
      toast.error(message);
    }
  };

  const confirmCancelPickup = (id: string) => {
    Alert.alert(
      t("Cancel pickup request?"),
      t("This will cancel your pickup request."),
      [
        { text: t("Keep"), style: "cancel" },
        { text: t("Cancel"), style: "destructive", onPress: () => void handleCancelPickup(id) },
      ]
    );
  };

  const handleCancelReport = async (id: string) => {
    try {
      await cancelReport(id);
      toast.success(t("Report cancelled"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to cancel report");
      toast.error(message);
    }
  };

  const confirmCancelReport = (id: string) => {
    Alert.alert(
      t("Cancel report?"),
      t("This will cancel your report and stop further processing."),
      [
        { text: t("Keep"), style: "cancel" },
        { text: t("Cancel report"), style: "destructive", onPress: () => void handleCancelReport(id) },
      ]
    );
  };

  const handleSaveReschedule = async (payload: { date: string; time: string; iso: string }) => {
    if (!rescheduleTarget) return;
    try {
      await reschedulePickup(rescheduleTarget.pickupId, payload.iso);
      toast.success(t("Pickup rescheduled"));
      setRescheduleTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to reschedule pickup");
      toast.error(message);
    }
  };

  const hasActivity = activePickups.length > 0 || activeReports.length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 132 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle} color={colors.text}>{t("New Request")}</AppText>
      </View>

      <AppText color={colors.textSecondary} style={styles.headerSubtitle}>
        {t("Choose what you want to submit today.")}
      </AppText>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: Colors.primary + "15" }]}>
            <Ionicons name="trash-outline" size={22} color={Colors.primary} />
          </View>
          <View style={styles.cardText}>
            <AppText style={styles.cardTitle} color={colors.text}>{t("Request a Pickup")}</AppText>
            <AppText color={colors.textSecondary} style={styles.cardSubtitle}>
              {t("Schedule waste collection and set your pickup time.")}
            </AppText>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: Colors.primary },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.push("/pickup/new")}
        >
          <AppText color="#fff">{t("Start Pickup Request")}</AppText>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: Colors.error + "15" }]}>
            <Ionicons name="alert-circle-outline" size={22} color={Colors.error} />
          </View>
          <View style={styles.cardText}>
            <AppText style={styles.cardTitle} color={colors.text}>{t("Report Illegal Dumping")}</AppText>
            <AppText color={colors.textSecondary} style={styles.cardSubtitle}>
              {t("Flag unsafe dumping or overflowing bins in your area.")}
            </AppText>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: Colors.error, backgroundColor: Colors.error + "10" },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.push("/report/new")}
        >
          <AppText color={Colors.error}>{t("Report Issue")}</AppText>
        </Pressable>
      </View>

      <View style={styles.activitySection}>
        <View style={styles.activityTitleRow}>
          <AppText style={styles.activityTitle} color={colors.text}>{t("Active Requests")}</AppText>
          <AppText style={styles.activityCount} color={colors.textSecondary}>
            {activePickups.length + activeReports.length}
          </AppText>
        </View>

        {!hasActivity ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="checkmark-done-outline" size={24} color={Colors.success} />
            <AppText color={colors.textSecondary} center style={styles.emptyStateText}>
              {t("No active requests or reports right now.")}
            </AppText>
          </View>
        ) : null}

        {activePickups.map((pickup) => {
          const overdue = isPickupPastDue(pickup);
          const wasteColor = overdue ? Colors.error : getWasteColor(pickup.wasteType);
          const canTrack = ["assigned", "in_progress"].includes(pickup.status);
          return (
            <View
              key={pickup.id}
              style={[
                styles.activityCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: overdue ? Colors.error + "66" : colors.border,
                  borderLeftColor: wasteColor,
                },
              ]}
            >
              <View style={styles.activityHeader}>
                <View style={styles.activityTitleWrap}>
                  <AppText style={styles.activityItemTitle} color={colors.text}>
                    {t("{waste} Waste", {
                      waste: t(WASTE_TYPES.find((item) => item.type === pickup.wasteType)?.label ?? "Waste"),
                    })}
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary} style={styles.activityItemMeta}>
                    {t("{date} at {time}", {
                      date: formatDisplayDate(pickup.scheduledDate),
                      time: formatDisplayTime(pickup.scheduledTime),
                    })}
                  </AppText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(pickup.status) + "1F" }]}>
                  <AppText variant="caption" style={styles.statusText} color={getStatusColor(pickup.status)}>
                    {overdue ? t("Overdue") : getStatusLabel(pickup.status)}
                  </AppText>
                </View>
              </View>

              <AppText variant="caption" color={colors.textSecondary} style={styles.activityItemMeta}>
                {pickup.assignedCollectorName
                  ? t("Collector: {name}", { name: pickup.assignedCollectorName })
                  : t("Waiting for collector acceptance")}
              </AppText>

              <View style={styles.activityActionsRow}>
                {canTrack ? (
                  <Pressable
                    style={({ pressed }) => [styles.textActionLinkWrap, pressed && { opacity: 0.85 }]}
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
                    <AppText style={styles.textActionLink} color={Colors.primary}>{t("Track")}</AppText>
                  </Pressable>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.textActionLinkWrap, pressed && { opacity: 0.85 }]}
                  onPress={() =>
                    setRescheduleTarget({
                      pickupId: pickup.id,
                      date: pickup.scheduledDate,
                      time: pickup.scheduledTime || "09:00",
                    })
                  }
                >
                  <AppText style={styles.textActionLink} color={Colors.error}>{t("Reschedule")}</AppText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.textActionLinkWrap, pressed && { opacity: 0.85 }]}
                  onPress={() => confirmCancelPickup(pickup.id)}
                >
                  <AppText style={styles.textActionLink} color={Colors.error}>{t("Cancel")}</AppText>
                </Pressable>
              </View>
            </View>
          );
        })}

        {activeReports.length > 0 ? (
          <AppText style={styles.reportHeading} color={colors.text}>{t("Active Reports")}</AppText>
        ) : null}

        {activeReports.map((report) => (
          <View
            key={report.id}
            style={[
              styles.activityCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderLeftColor: Colors.error,
              },
            ]}
          >
            <View style={styles.activityHeader}>
              <View style={styles.activityTitleWrap}>
                <AppText style={styles.activityItemTitle} color={colors.text}>
                  {getReportLabel(report.type)}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary} style={styles.activityItemMeta}>
                  {report.location || t("Location not provided")}
                </AppText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + "1F" }]}>
                <AppText variant="caption" style={styles.statusText} color={getStatusColor(report.status)}>
                  {getStatusLabel(report.status)}
                </AppText>
              </View>
            </View>

            <AppText variant="caption" color={colors.textSecondary} style={styles.activityItemMeta}>
              {report.assignedCollectorName
                ? t("Collector: {name}", { name: report.assignedCollectorName })
                : t("Searching nearest collector")}
            </AppText>

            {canCancelReport(report.status) ? (
              <View style={styles.activityActionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.textActionLinkWrap, pressed && { opacity: 0.85 }]}
                  onPress={() => confirmCancelReport(report.id)}
                >
                  <AppText style={styles.textActionLink} color={Colors.error}>{t("Cancel report")}</AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <ReschedulePickupModal
        visible={!!rescheduleTarget}
        initialDate={rescheduleTarget?.date}
        initialTime={rescheduleTarget?.time}
        onClose={() => setRescheduleTarget(null)}
        onSave={handleSaveReschedule}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: fonts.bold },
  headerSubtitle: { fontSize: fontSizes.sm, marginBottom: spacing.lg },
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: fontSizes.button, fontFamily: fonts.semibold, marginBottom: 4 },
  cardSubtitle: { fontSize: fontSizes.sm, lineHeight: 18 },
  primaryButton: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  activitySection: { gap: 10, marginTop: 2 },
  activityTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activityTitle: { fontSize: 17, fontFamily: fonts.bold },
  activityCount: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  emptyState: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    alignItems: "center",
    gap: 6,
  },
  emptyStateText: { fontSize: fontSizes.sm },
  activityCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: fontSizes.sm,
    gap: spacing.sm,
  },
  activityHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  activityTitleWrap: { flex: 1, minWidth: 0 },
  activityItemTitle: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  activityItemMeta: { lineHeight: 18 },
  reportHeading: { fontSize: fontSizes.md, fontFamily: fonts.bold, marginTop: 2, marginBottom: 2 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontFamily: fonts.bold, textTransform: "capitalize" },
  activityActionsRow: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.md, marginTop: 4 },
  textActionLinkWrap: { paddingVertical: 2 },
  textActionLink: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
});