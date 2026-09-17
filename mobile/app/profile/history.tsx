import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { radius, spacing, fonts, fontSizes } from "@/constants/theme";
import { WASTE_TYPES, type PickupRequest, type Report, type WasteType } from "@/lib/types";
import { showConfirmDialog } from "@/lib/confirm-dialog";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { normalizeMediaUrl } from "@/lib/media-url";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";

type ActivityFilter = "all" | "pickup" | "rewards";

const formatMonthLabel = (value: string, t: (key: string) => string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t("Unknown date");
  return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

export default function ProfileHistoryScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const {
    user,
    pickups,
    reports,
    cancelPickup,
    cancelReport,
    confirmPickupCompletion,
    confirmReportCleanup,
  } = useApp();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"pickups" | "reports">("pickups");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPickup, setSelectedPickup] = useState<PickupRequest | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [pickupConfirmationSubmittingId, setPickupConfirmationSubmittingId] = useState<string | null>(null);
  const [reportConfirmationSubmittingId, setReportConfirmationSubmittingId] = useState<string | null>(null);
  const selectedPickupProofUri = normalizeMediaUrl(selectedPickup?.completionPhotoUri);
  const selectedReportProofUri = normalizeMediaUrl(selectedReport?.cleanedPhotoUri);

  const filteredPickups = useMemo(() => {
    return pickups.filter((pickup) => {
      if (statusFilter !== "all" && pickup.status !== statusFilter) return false;
      return activityFilter === "all" || activityFilter === "pickup";
    });
  }, [pickups, statusFilter, activityFilter]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter !== "all" && report.status !== statusFilter) return false;
      return activityFilter === "all" || activityFilter === "pickup";
    });
  }, [reports, statusFilter, activityFilter]);

  const groupedPickups = useMemo(() => {
    const map = new Map<string, PickupRequest[]>();
    for (const pickup of filteredPickups) {
      const month = formatMonthLabel(pickup.createdAt, t);
      const existing = map.get(month) ?? [];
      existing.push(pickup);
      map.set(month, existing);
    }
    return Array.from(map.entries());
  }, [filteredPickups, t]);

  const groupedReports = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const report of filteredReports) {
      const month = formatMonthLabel(report.createdAt, t);
      const existing = map.get(month) ?? [];
      existing.push(report);
      map.set(month, existing);
    }
    return Array.from(map.entries());
  }, [filteredReports, t]);

  const statusOptions = useMemo(() => {
    const source = activeTab === "pickups" ? pickups.map((item) => item.status) : reports.map((item) => item.status);
    const unique = Array.from(new Set(source));
    return ["all", ...unique];
  }, [activeTab, pickups, reports]);

  const getWasteIcon = (type: WasteType) => {
    const waste = WASTE_TYPES.find((w) => w.type === type);
    return waste?.icon || "trash";
  };

  const getWasteColor = (type: WasteType) => {
    return Colors.waste[type] || Colors.primary;
  };

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

  const getStatusLabel = (status: string) => {
    if (status === "in_progress") return t("In Progress");
    if (status === "cancelled") return t("Cancelled");
    return t(
      status
        .split("_")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(" ")
    );
  };

  const getReportLabel = (type: Report["type"]) => {
    switch (type) {
      case "illegal_dumping":
        return t("Illegal dumping issue");
      case "overflowing_bin":
        return t("Overflowing bin issue");
      default:
        return t("Other issue");
    }
  };

  const formatCollector = (name?: string, phone?: string) => {
    if (!name) return t("Not assigned");
    return phone ? `${name} (${phone})` : name;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "--";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const canCancelPickup = (status: string) => status !== "cancelled";
  const canCancelReport = (status: string) => status !== "cancelled";

  const confirmCancelPickup = (pickupId: string) => {
    showConfirmDialog({
      title: t("Cancel pickup request?"),
      message: t("This will cancel your pickup request."),
      cancelText: t("Keep"),
      confirmText: t("Cancel pickup"),
      destructive: true,
      onConfirm: () => void handleCancelPickup(pickupId),
    });
  };

  const handleCancelPickup = async (pickupId: string) => {
    try {
      await cancelPickup(pickupId);
      toast.success(t("Pickup cancelled"));
      setSelectedPickup(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to cancel pickup");
      toast.error(message);
    }
  };

  const confirmCancelReport = (reportId: string) => {
    showConfirmDialog({
      title: t("Cancel report?"),
      message: t("This will cancel your report and stop further processing."),
      cancelText: t("Keep"),
      confirmText: t("Cancel report"),
      destructive: true,
      onConfirm: () => void handleCancelReport(reportId),
    });
  };

  const handleCancelReport = async (reportId: string) => {
    try {
      await cancelReport(reportId);
      toast.success(t("Report cancelled"));
      setSelectedReport(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to cancel report");
      toast.error(message);
    }
  };

  const handlePickupConfirmation = async (pickupId: string, approved: boolean) => {
    if (pickupConfirmationSubmittingId === pickupId) return;
    setPickupConfirmationSubmittingId(pickupId);
    try {
      await confirmPickupCompletion(pickupId, approved);
      toast.success(approved ? t("Pickup confirmation sent") : t("Pickup completion rejected"));
      setSelectedPickup(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to submit pickup confirmation");
      toast.error(message);
    } finally {
      setPickupConfirmationSubmittingId((prev) => (prev === pickupId ? null : prev));
    }
  };

  const handleReportConfirmation = async (reportId: string, approved: boolean) => {
    if (reportConfirmationSubmittingId === reportId) return;
    setReportConfirmationSubmittingId(reportId);
    try {
      await confirmReportCleanup(reportId, approved);
      toast.success(approved ? t("Report confirmation sent") : t("Report cleanup rejected"));
      setSelectedReport(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to submit report confirmation");
      toast.error(message);
    } finally {
      setReportConfirmationSubmittingId((prev) => (prev === reportId ? null : prev));
    }
  };

  const handleRowPress = async () => {
    if (Platform.OS !== "web") {
      await Haptics.selectionAsync();
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BottomWhiteScent />
        <View style={[styles.emptyState, { paddingTop: 40 }]}>
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
          <AppText variant="title" color={colors.text} center style={styles.emptyTitle}>
            {t("Sign in to view history")}
          </AppText>
          <AppText center color={colors.textSecondary}>
            {t("Please sign in to view your pickups and reports.")}
          </AppText>
          <Button
            label={t("Sign In")}
            onPress={() => router.replace("/(auth)/login")}
            style={styles.signInButton}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <BottomWhiteScent />

      <View style={styles.content}>
        <View style={[styles.historyTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            style={[styles.historyTab, activeTab === "pickups" && { backgroundColor: Colors.primary }]}
            onPress={() => {
              setActiveTab("pickups");
              setStatusFilter("all");
            }}
          >
            <AppText
              variant="label"
              color={activeTab === "pickups" ? "#fff" : colors.textSecondary}
            >
              {t("Pickups")}
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.historyTab, activeTab === "reports" && { backgroundColor: Colors.primary }]}
            onPress={() => {
              setActiveTab("reports");
              setStatusFilter("all");
            }}
          >
            <AppText
              variant="label"
              color={activeTab === "reports" ? "#fff" : colors.textSecondary}
            >
              {t("Reports")}
            </AppText>
          </Pressable>
        </View>

        <View style={styles.activityFilters}>
          {([
            { key: "all", label: t("All") },
            { key: "pickup", label: t("Pickup") },
            { key: "rewards", label: t("Rewards") },
          ] as const).map((item) => {
            const isActive = activityFilter === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.activityChip,
                  {
                    borderColor: isActive ? Colors.primary : colors.border,
                    backgroundColor: isActive ? Colors.primary + "12" : colors.surface,
                  },
                ]}
                onPress={() => setActivityFilter(item.key)}
              >
                <AppText
                  variant="caption"
                  color={isActive ? Colors.primary : colors.textSecondary}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.statusFilters}>
          {statusOptions.map((status) => {
            const isActive = statusFilter === status;
            const statusColor = status === "all" ? colors.textSecondary : getStatusColor(status);
            return (
              <Pressable
                key={status}
                style={[
                  styles.statusChip,
                  {
                    borderColor: isActive ? statusColor : colors.border,
                    backgroundColor: isActive ? statusColor + "15" : colors.surface,
                  },
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <AppText variant="caption" color={isActive ? statusColor : colors.textSecondary}>
                  {status === "all" ? t("All statuses") : getStatusLabel(status)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {activityFilter === "rewards" ? (
          <View style={[styles.emptyHistory, { backgroundColor: colors.surface }]}>
            <AppText center color={colors.textSecondary}>
              {t("Check your rewards timeline and points progress.")}
            </AppText>
            <Button
              label={t("Open rewards")}
              onPress={() => router.push("/(tabs)/rewards")}
              style={styles.linkButton}
            />
          </View>
        ) : activeTab === "pickups" ? (
          groupedPickups.length > 0 ? (
            groupedPickups.map(([month, monthPickups]) => (
              <View key={month} style={styles.monthGroup}>
                <AppText style={styles.monthTitle} color={colors.textSecondary}>
                  {month}
                </AppText>
                {monthPickups.map((pickup) => (
                  <Pressable
                    key={pickup.id}
                    style={({ pressed }) => [
                      styles.historyCard,
                      { backgroundColor: colors.surface },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => {
                      void handleRowPress();
                      setSelectedPickup(pickup);
                    }}
                  >
                    <View style={[styles.historyIcon, { backgroundColor: getWasteColor(pickup.wasteType) + "20" }]}>
                      <Ionicons
                        name={getWasteIcon(pickup.wasteType) as never}
                        size={20}
                        color={getWasteColor(pickup.wasteType)}
                      />
                    </View>
                    <View style={styles.historyInfo}>
                      <AppText color={colors.text} style={styles.historyType}>
                        {t("{waste} Pickup", {
                          waste: t(WASTE_TYPES.find((w) => w.type === pickup.wasteType)?.label ?? "Waste"),
                        })}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary} style={styles.historyDate}>
                        {pickup.scheduledDate} {pickup.scheduledTime || ""}
                      </AppText>
                      {pickup.status === "completed" && pickup.residentConfirmationStatus === "pending" ? (
                        <View style={styles.inlineNeedsReviewRow}>
                          <Ionicons name="alert-circle-outline" size={13} color={Colors.warning} />
                          <AppText variant="caption" color={Colors.warning}>
                            {t("Confirmation required")}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.historyStatus, { backgroundColor: getStatusColor(pickup.status) + "20" }]}>
                      <AppText variant="caption" style={styles.historyStatusText} color={getStatusColor(pickup.status)}>
                        {getStatusLabel(pickup.status)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
          ) : (
            <View style={[styles.emptyHistory, { backgroundColor: colors.surface }]}>
              <AppText center color={colors.textSecondary}>
                {t("No pickup history matches this filter.")}
              </AppText>
            </View>
          )
        ) : groupedReports.length > 0 ? (
          groupedReports.map(([month, monthReports]) => (
            <View key={month} style={styles.monthGroup}>
              <AppText style={styles.monthTitle} color={colors.textSecondary}>
                {month}
              </AppText>
              {monthReports.map((report) => (
                <Pressable
                  key={report.id}
                  style={({ pressed }) => [
                    styles.historyCard,
                    { backgroundColor: colors.surface },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => {
                    void handleRowPress();
                    setSelectedReport(report);
                  }}
                >
                  <View style={[styles.historyIcon, { backgroundColor: Colors.secondary + "20" }]}>
                    <Ionicons name="alert-circle-outline" size={20} color={Colors.secondary} />
                  </View>
                  <View style={styles.historyInfo}>
                    <AppText color={colors.text} style={styles.historyType}>
                      {getReportLabel(report.type)}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary} style={styles.historyDate}>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </AppText>
                    {report.status === "cleaned" && report.residentConfirmationStatus === "pending" ? (
                      <View style={styles.inlineNeedsReviewRow}>
                        <Ionicons name="alert-circle-outline" size={13} color={Colors.warning} />
                        <AppText variant="caption" color={Colors.warning}>
                          {t("Confirmation required")}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.historyStatus, { backgroundColor: getStatusColor(report.status) + "20" }]}>
                    <AppText variant="caption" style={styles.historyStatusText} color={getStatusColor(report.status)}>
                      {getStatusLabel(report.status)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          ))
        ) : (
          <View style={[styles.emptyHistory, { backgroundColor: colors.surface }]}>
            <AppText center color={colors.textSecondary}>
              {t("No reports match this filter.")}
            </AppText>
          </View>
        )}
      </View>

      <Modal
        visible={!!selectedPickup}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPickup(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          {selectedPickup && (
            <>
                <View style={styles.modalHeader}>
                  <AppText variant="title" color={colors.text}>{t("Pickup details")}</AppText>
                  <Pressable onPress={() => setSelectedPickup(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              <View style={styles.detailList}>
                {(() => {
                  const isSubmittingPickupConfirmation = pickupConfirmationSubmittingId === selectedPickup.id;
                  return (
                    <>
                {selectedPickup.status === "completed" ? (
                  <View
                    style={[
                      styles.confirmationBanner,
                      {
                        backgroundColor:
                          selectedPickup.residentConfirmationStatus === "approved"
                            ? Colors.success + "14"
                            : selectedPickup.residentConfirmationStatus === "rejected"
                              ? Colors.error + "14"
                              : Colors.warning + "14",
                        borderColor:
                          selectedPickup.residentConfirmationStatus === "approved"
                            ? Colors.success + "44"
                            : selectedPickup.residentConfirmationStatus === "rejected"
                              ? Colors.error + "44"
                              : Colors.warning + "44",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedPickup.residentConfirmationStatus === "approved"
                          ? "checkmark-done-circle-outline"
                          : selectedPickup.residentConfirmationStatus === "rejected"
                            ? "close-circle-outline"
                            : "time-outline"
                      }
                      size={18}
                      color={
                        selectedPickup.residentConfirmationStatus === "approved"
                          ? Colors.success
                          : selectedPickup.residentConfirmationStatus === "rejected"
                            ? Colors.error
                            : Colors.warning
                      }
                    />
                    <View style={styles.confirmationBannerTextWrap}>
                      <AppText variant="label" color={colors.text}>
                        {selectedPickup.residentConfirmationStatus === "approved"
                          ? t("You approved this completion")
                          : selectedPickup.residentConfirmationStatus === "rejected"
                            ? t("You rejected this completion")
                            : t("Collector proof submitted")}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary} style={styles.bannerSubtitle}>
                        {selectedPickup.residentConfirmationStatus === "pending"
                          ? t("Please approve or reject to continue dispatch flow.")
                          : t("Submitted at {date}", { date: formatDateTime(selectedPickup.completionSubmittedAt) })}
                      </AppText>
                    </View>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Waste type")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {WASTE_TYPES.find((w) => w.type === selectedPickup.wasteType)?.label
                      ? t(WASTE_TYPES.find((w) => w.type === selectedPickup.wasteType)?.label as string)
                      : ""}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Category")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {selectedPickup.pickupCategory
                      ? getStatusLabel(selectedPickup.pickupCategory)
                      : t("Standard")}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Schedule")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {selectedPickup.scheduledDate} {selectedPickup.scheduledTime || ""}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Address")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {selectedPickup.address || "--"}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Status")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {getStatusLabel(selectedPickup.status)}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Collector")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {formatCollector(
                      selectedPickup.assignedCollectorName,
                      selectedPickup.assignedCollectorPhone
                    )}
                  </AppText>
                </View>
                {selectedPickup.description ? (
                  <View style={styles.detailRow}>
                    <AppText variant="caption" color={colors.textSecondary}>{t("Notes")}</AppText>
                    <AppText variant="label" color={colors.text} style={styles.detailValue}>
                      {selectedPickup.description}
                    </AppText>
                  </View>
                ) : null}
                {selectedPickup.status === "completed" ? (
                  <View
                    style={[
                      styles.proofCard,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary ?? colors.background },
                    ]}
                  >
                    <AppText variant="label" color={colors.text}>
                      {t("Completion photo")}
                    </AppText>
                    <BeforeAfterGallery
                      beforeUri={normalizeMediaUrl(selectedPickup.photoUri)}
                      afterUri={selectedPickupProofUri}
                      beforeLabel={t("Before")}
                      afterLabel={t("After")}
                    />
                    <AppText variant="caption" color={colors.textSecondary}>
                      {selectedPickup.completionNote?.trim() || t("No completion note provided")}
                    </AppText>
                    <AppText style={styles.proofMeta} color={colors.textSecondary}>
                      {t("Submitted at {date}", {
                        date: formatDateTime(selectedPickup.completionSubmittedAt || selectedPickup.completedAt),
                      })}
                    </AppText>
                  </View>
                ) : null}
                {canCancelPickup(selectedPickup.status) && (
                  <Button
                    variant="danger"
                    label={t("Cancel pickup")}
                    leftIcon="close-circle-outline"
                    onPress={() => confirmCancelPickup(selectedPickup.id)}
                    style={styles.cancelButton}
                  />
                )}
                {selectedPickup.status === "completed" &&
                  selectedPickup.residentConfirmationStatus === "pending" && (
                    <View style={styles.confirmationActions}>
                      <Button
                        label={
                          isSubmittingPickupConfirmation
                            ? t("Submitting...")
                            : t("Approve completion")
                        }
                        leftIcon="checkmark-circle-outline"
                        loading={isSubmittingPickupConfirmation}
                        onPress={() =>
                          showConfirmDialog({
                            title: t("Approve completion"),
                            message: t("Confirm this pickup was completed successfully?"),
                            cancelText: t("Cancel"),
                            confirmText: t("Approve"),
                            onConfirm: () => void handlePickupConfirmation(selectedPickup.id, true),
                          })
                        }
                      />
                      <Button
                        variant="danger"
                        label={
                          isSubmittingPickupConfirmation
                            ? t("Submitting...")
                            : t("Reject completion")
                        }
                        leftIcon="close-circle-outline"
                        loading={isSubmittingPickupConfirmation}
                        onPress={() =>
                          showConfirmDialog({
                            title: t("Reject completion"),
                            message: t("We'll assign another nearby collector if you reject this proof."),
                            cancelText: t("Keep"),
                            confirmText: t("Reject"),
                            destructive: true,
                            onConfirm: () => void handlePickupConfirmation(selectedPickup.id, false),
                          })
                        }
                      />
                    </View>
                  )}
                    </>
                  );
                })()}
              </View>
            </>
          )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedReport}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          {selectedReport && (
            <>
                <View style={styles.modalHeader}>
                  <AppText variant="title" color={colors.text}>{t("Report details")}</AppText>
                  <Pressable onPress={() => setSelectedReport(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              <View style={styles.detailList}>
                {(() => {
                  const isSubmittingReportConfirmation = reportConfirmationSubmittingId === selectedReport.id;
                  return (
                    <>
                {selectedReport.status === "cleaned" ? (
                  <View
                    style={[
                      styles.confirmationBanner,
                      {
                        backgroundColor:
                          selectedReport.residentConfirmationStatus === "approved"
                            ? Colors.success + "14"
                            : selectedReport.residentConfirmationStatus === "rejected"
                              ? Colors.error + "14"
                              : Colors.warning + "14",
                        borderColor:
                          selectedReport.residentConfirmationStatus === "approved"
                            ? Colors.success + "44"
                            : selectedReport.residentConfirmationStatus === "rejected"
                              ? Colors.error + "44"
                              : Colors.warning + "44",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedReport.residentConfirmationStatus === "approved"
                          ? "checkmark-done-circle-outline"
                          : selectedReport.residentConfirmationStatus === "rejected"
                            ? "close-circle-outline"
                            : "time-outline"
                      }
                      size={18}
                      color={
                        selectedReport.residentConfirmationStatus === "approved"
                          ? Colors.success
                          : selectedReport.residentConfirmationStatus === "rejected"
                            ? Colors.error
                            : Colors.warning
                      }
                    />
                    <View style={styles.confirmationBannerTextWrap}>
                      <AppText variant="label" color={colors.text}>
                        {selectedReport.residentConfirmationStatus === "approved"
                          ? t("You approved this cleanup")
                          : selectedReport.residentConfirmationStatus === "rejected"
                            ? t("You rejected this cleanup")
                            : t("Collector cleanup proof submitted")}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary} style={styles.bannerSubtitle}>
                        {selectedReport.residentConfirmationStatus === "pending"
                          ? t("Please approve or reject to finalize this report.")
                          : t("Last update: {date}", {
                              date: formatDateTime(selectedReport.residentConfirmedAt || selectedReport.createdAt),
                            })}
                      </AppText>
                    </View>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Type")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {getReportLabel(selectedReport.type)}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Location")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {selectedReport.location || "--"}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Status")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {getStatusLabel(selectedReport.status)}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText variant="caption" color={colors.textSecondary}>{t("Collector")}</AppText>
                  <AppText variant="label" color={colors.text} style={styles.detailValue}>
                    {formatCollector(
                      selectedReport.assignedCollectorName,
                      selectedReport.assignedCollectorPhone
                    )}
                  </AppText>
                </View>
                {selectedReport.description ? (
                  <View style={styles.detailRow}>
                    <AppText variant="caption" color={colors.textSecondary}>{t("Notes")}</AppText>
                    <AppText variant="label" color={colors.text} style={styles.detailValue}>
                      {selectedReport.description}
                    </AppText>
                  </View>
                ) : null}
                {selectedReport.status === "cleaned" ? (
                  <View
                    style={[
                      styles.proofCard,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary ?? colors.background },
                    ]}
                  >
                    <AppText variant="label" color={colors.text}>
                      {t("Collector cleanup proof")}
                    </AppText>
                    <BeforeAfterGallery
                      beforeUri={normalizeMediaUrl(selectedReport.photoUri)}
                      afterUri={selectedReportProofUri}
                      beforeLabel={t("Before")}
                      afterLabel={t("After")}
                    />
                    <AppText variant="caption" color={colors.textSecondary}>
                      {selectedReport.cleanedNote?.trim() || t("No cleanup note provided")}
                    </AppText>
                    <AppText style={styles.proofMeta} color={colors.textSecondary}>
                      {t("Submitted at {date}", { date: formatDateTime(selectedReport.cleanedAt) })}
                    </AppText>
                  </View>
                ) : null}
                {canCancelReport(selectedReport.status) && (
                  <Button
                    variant="danger"
                    label={t("Cancel report")}
                    leftIcon="close-circle-outline"
                    onPress={() => confirmCancelReport(selectedReport.id)}
                    style={styles.cancelButton}
                  />
                )}
                {selectedReport.status === "cleaned" &&
                  selectedReport.residentConfirmationStatus === "pending" && (
                    <View style={styles.confirmationActions}>
                      <Button
                        label={
                          isSubmittingReportConfirmation ? t("Submitting...") : t("Approve cleanup")
                        }
                        leftIcon="checkmark-circle-outline"
                        loading={isSubmittingReportConfirmation}
                        onPress={() =>
                          showConfirmDialog({
                            title: t("Approve cleanup"),
                            message: t("Confirm this report cleanup is valid?"),
                            cancelText: t("Cancel"),
                            confirmText: t("Approve"),
                            onConfirm: () => void handleReportConfirmation(selectedReport.id, true),
                          })
                        }
                      />
                      <Button
                        variant="danger"
                        label={
                          isSubmittingReportConfirmation ? t("Submitting...") : t("Reject cleanup")
                        }
                        leftIcon="close-circle-outline"
                        loading={isSubmittingReportConfirmation}
                        onPress={() =>
                          showConfirmDialog({
                            title: t("Reject cleanup"),
                            message: t("We'll assign another nearby collector if you reject this proof."),
                            cancelText: t("Keep"),
                            confirmText: t("Reject"),
                            destructive: true,
                            onConfirm: () => void handleReportConfirmation(selectedReport.id, false),
                          })
                        }
                      />
                    </View>
                  )}
                    </>
                  );
                })()}
              </View>
            </>
          )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  content: { padding: 20, gap: spacing.sm + 4 },
  historyTabs: {
    flexDirection: "row",
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 4,
    gap: 6,
  },
  historyTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: "center",
  },
  activityFilters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  activityChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  statusFilters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statusChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  monthGroup: { gap: spacing.sm },
  monthTitle: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyCard: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg },
  historyIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  historyInfo: { flex: 1, marginLeft: spacing.md },
  historyType: { fontSize: 14, fontFamily: fonts.medium },
  historyDate: { marginTop: 2 },
  inlineNeedsReviewRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  historyStatus: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  historyStatusText: { textTransform: "capitalize" },
  emptyHistory: { borderRadius: radius.lg, padding: 14, alignItems: "center", gap: spacing.md },
  linkButton: { minWidth: 160 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { marginTop: 8 },
  signInButton: { marginTop: 16, paddingHorizontal: 32 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: radius.xxl,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalClose: { padding: 4 },
  detailList: { gap: 10 },
  confirmationBanner: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  confirmationBannerTextWrap: { flex: 1 },
  bannerSubtitle: { marginTop: 2 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  detailValue: { flex: 1, textAlign: "right" },
  proofCard: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 10,
    gap: spacing.sm,
  },
  proofMeta: { fontSize: 11 },
  cancelButton: { marginTop: spacing.md },
  confirmationActions: { marginTop: spacing.sm, gap: 10 },
});