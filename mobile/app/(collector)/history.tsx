import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { router, useIsFocused } from "expo-router";
import { collectorApi, type CollectorAssignment, type CollectorWasteReport } from "@/lib/collector-api";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { useLanguage } from "@/lib/language-context";

export default function CollectorHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const isFocused = useIsFocused();
  const toast = useToast();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const [view, setView] = useState<"all" | "pickups" | "reports">("all");
  const [pickupItems, setPickupItems] = useState<CollectorAssignment[]>([]);
  const [reportItems, setReportItems] = useState<CollectorWasteReport[]>([]);
  const [loading, setLoading] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const headerTopPadding = insets.top + webTopInset + spacing.lg;
  const historyListBottomPadding = insets.bottom + (Platform.OS === "web" ? 110 : 128);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pickups, reports] = await Promise.all([
        collectorApi.listHistory(),
        collectorApi.listReportHistory(),
      ]);
      setPickupItems(pickups);
      setReportItems(reports);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to load history"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    enabled: isFocused,
    onRefresh: load,
    pollMs: 30_000,
    eventTypes: ["assignment.updated", "pickup.updated", "report.updated"],
  });

  const formatStatus = (value?: string | null) => {
    if (!value) return "";
    return t(value.replace(/_/g, " "));
  };

  const formatWasteType = (value?: string | null) => {
    if (!value) return t("Pickup");
    const normalized = value.replace(/_/g, " ");
    const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
    return t(title);
  };

  const formatReportType = (value?: string | null) => {
    if (!value) return t("Waste Report");
    if (value === "illegal_dumping") return t("Illegal Dumping");
    if (value === "overflowing_bin") return t("Overflowing Bin");
    if (value === "other") return t("Other Issue");
    const normalized = value.replace(/_/g, " ");
    const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
    return t(title);
  };

  const isPickupPastDue = (pickup: CollectorAssignment) => {
    if (pickup.status === "completed" || pickup.status === "cancelled") return false;
    if (pickup.status === "overdue") return true;
    if (!pickup.scheduled_date) return false;
    const scheduled = new Date(pickup.scheduled_date);
    if (Number.isNaN(scheduled.getTime())) return false;
    return scheduled.getTime() < Date.now();
  };

  const getConfirmationColor = (status: "pending" | "approved" | "rejected") => {
    if (status === "approved") return Colors.success;
    if (status === "rejected") return Colors.error;
    return Colors.warning;
  };

  const getPickupConfirmationLabel = (status: "pending" | "approved" | "rejected") => {
    if (status === "approved") return t("Resident approved completion");
    if (status === "rejected") return t("Resident rejected completion");
    return t("Resident confirmation pending");
  };

  const getReportConfirmationLabel = (status: "pending" | "approved" | "rejected") => {
    if (status === "approved") return t("Resident approved cleanup");
    if (status === "rejected") return t("Resident rejected cleanup");
    return t("Resident confirmation pending");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.fixedTop, { paddingTop: headerTopPadding }]}>
        <View style={styles.header}>
          <View>
            <AppText style={styles.screenTitle} color={colors.text}>{t("History")}</AppText>
            <AppText style={styles.subtitle} color={colors.textSecondary}>
              {t("Completed work and reported issues.")}
            </AppText>
          </View>
          <Pressable onPress={() => void load()} style={styles.refreshBtn} accessibilityLabel={t("Refresh")}>
            <Ionicons name="refresh" size={18} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            {
              key: "all" as const,
              label: t("All ({count})", { count: pickupItems.length + reportItems.length }),
            },
            { key: "pickups" as const, label: t("Pickups ({count})", { count: pickupItems.length }) },
            { key: "reports" as const, label: t("Reports ({count})", { count: reportItems.length }) },
          ]).map((s) => {
            const isActive = view === s.key;
            return (
              <Pressable
                key={s.key}
                style={({ pressed }) => [
                  styles.segment,
                  isActive && { backgroundColor: Colors.primary },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setView(s.key)}
              >
                <AppText style={styles.segmentText} color={isActive ? "#fff" : colors.textSecondary}>
                  {s.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.historyList}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: historyListBottomPadding,
          gap: spacing.md,
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
      >
        {pickupItems.length === 0 && reportItems.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name="time-outline" size={36} color={colors.textSecondary} />
            <AppText style={{ marginTop: spacing.sm }} color={colors.textSecondary}>{t("No history yet")}</AppText>
          </View>
        ) : (
          <>
            {(view === "all" || view === "pickups") && pickupItems.length > 0 && (
              <View style={{ gap: 10 }}>
                {view === "all" && (
                  <AppText style={styles.sectionTitle} color={colors.textSecondary}>{t("Pickup Jobs")}</AppText>
                )}
                {pickupItems.map((a) => (
                  <View
                    key={a.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isPickupPastDue(a) ? Colors.error + "70" : colors.border,
                        borderLeftWidth: isPickupPastDue(a) ? 4 : 1,
                        borderLeftColor: isPickupPastDue(a) ? Colors.error : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.headerRow}>
                      <AppText style={styles.title} color={colors.text}>{formatWasteType(a.waste_type)}</AppText>
                      <AppText style={styles.status} color={Colors.secondary}>{formatStatus(a.status)}</AppText>
                    </View>
                    {isPickupPastDue(a) ? (
                      <AppText style={styles.issue} color={Colors.error}>{t("Overdue pickup")}</AppText>
                    ) : null}
                    <AppText style={styles.label} color={colors.textSecondary}>{a.address || t("No address")}</AppText>
                    {a.completed_at ? (
                      <AppText style={styles.label} color={colors.textSecondary}>
                        {t("Completed {date}", { date: new Date(a.completed_at).toLocaleString(locale) })}
                      </AppText>
                    ) : null}
                    {(() => {
                      const confirmationStatus =
                        a.resident_confirmation_status
                        ?? (a.status === "completed" && a.completion_submitted_at ? "pending" : null);
                      if (!confirmationStatus) return null;
                      const confirmationColor = getConfirmationColor(confirmationStatus);
                      return (
                        <View
                          style={[
                            styles.confirmationChip,
                            {
                              borderColor: confirmationColor + "44",
                              backgroundColor: confirmationColor + "12",
                            },
                          ]}
                        >
                          <Ionicons name="shield-checkmark-outline" size={14} color={confirmationColor} />
                          <View style={styles.confirmationTextWrap}>
                            <AppText style={styles.confirmationTitle} color={confirmationColor}>
                              {getPickupConfirmationLabel(confirmationStatus)}
                            </AppText>
                            {a.resident_confirmed_at ? (
                              <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                                {t("Updated {date}", { date: new Date(a.resident_confirmed_at).toLocaleString(locale) })}
                              </AppText>
                            ) : null}
                            {confirmationStatus === "rejected" && a.resident_rejection_note ? (
                              <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                                {a.resident_rejection_note}
                              </AppText>
                            ) : null}
                          </View>
                        </View>
                      );
                    })()}
                    {a.completion_note ? (
                      <AppText style={styles.note} color={colors.text}>{a.completion_note}</AppText>
                    ) : null}
                    {a.issue_reason ? (
                      <AppText style={styles.issue} color={Colors.error}>
                        {t("Issue: {reason}", { reason: a.issue_reason })}
                      </AppText>
                    ) : null}
                    <Pressable
                      style={styles.detailBtn}
                      onPress={() => router.push({ pathname: "/(collector)/detail", params: { id: a.id, kind: "pickup" } })}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                      <AppText style={styles.detailText} color={colors.textSecondary}>{t("Details")}</AppText>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {(view === "all" || view === "reports") && reportItems.length > 0 && (
              <View style={{ gap: 10, marginTop: view === "all" && pickupItems.length > 0 ? spacing.sm : 0 }}>
                {view === "all" && (
                  <AppText style={styles.sectionTitle} color={colors.textSecondary}>{t("Waste Reports")}</AppText>
                )}
                {reportItems.map((r) => {
                  const when = r.cleaned_at ?? r.collector_issue_at ?? r.updated_at ?? r.created_at;
                  const prefix = r.cleaned_at ? t("Cleaned") : r.collector_issue_at ? t("Issue") : t("Updated");
                  const confirmationStatus =
                    r.resident_confirmation_status
                    ?? (r.status === "cleaned" && r.cleaned_at ? "pending" : null);
                  return (
                    <View key={r.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.headerRow}>
                        <AppText style={styles.title} color={colors.text}>{formatReportType(r.report_type)}</AppText>
                        <AppText style={styles.status} color={Colors.secondary}>{formatStatus(r.status)}</AppText>
                      </View>
                      <AppText style={styles.label} color={colors.textSecondary}>{r.location_text || t("No location")}</AppText>
                      <AppText style={styles.label} color={colors.textSecondary}>
                        {t("{prefix} {date}", { prefix, date: new Date(when).toLocaleString(locale) })}
                      </AppText>
                      {confirmationStatus ? (
                        <View
                          style={[
                            styles.confirmationChip,
                            {
                              borderColor: getConfirmationColor(confirmationStatus) + "44",
                              backgroundColor: getConfirmationColor(confirmationStatus) + "12",
                            },
                          ]}
                        >
                          <Ionicons
                            name="shield-checkmark-outline"
                            size={14}
                            color={getConfirmationColor(confirmationStatus)}
                          />
                          <View style={styles.confirmationTextWrap}>
                            <AppText style={styles.confirmationTitle} color={getConfirmationColor(confirmationStatus)}>
                              {getReportConfirmationLabel(confirmationStatus)}
                            </AppText>
                            {r.resident_confirmed_at ? (
                              <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                                {t("Updated {date}", { date: new Date(r.resident_confirmed_at).toLocaleString(locale) })}
                              </AppText>
                            ) : null}
                            {confirmationStatus === "rejected" && r.resident_rejection_note ? (
                              <AppText style={styles.confirmationMeta} color={colors.textSecondary}>
                                {r.resident_rejection_note}
                              </AppText>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                      {r.cleaned_note ? (
                        <AppText style={styles.note} color={colors.text}>{r.cleaned_note}</AppText>
                      ) : null}
                      {r.collector_issue_reason ? (
                        <AppText style={styles.issue} color={Colors.error}>
                          {t("Issue: {reason}", { reason: r.collector_issue_reason })}
                        </AppText>
                      ) : null}
                      <Pressable
                        style={styles.detailBtn}
                        onPress={() => router.push({ pathname: "/(collector)/detail", params: { id: r.id, kind: "report" } })}
                      >
                        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                        <AppText style={styles.detailText} color={colors.textSecondary}>{t("Details")}</AppText>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedTop: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  historyList: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  screenTitle: { fontSize: fontSizes.title, fontFamily: fonts.bold },
  subtitle: { fontSize: fontSizes.xs, fontFamily: fonts.regular, marginTop: spacing.xs },
  refreshBtn: { padding: 10, borderRadius: radius.md, backgroundColor: Colors.primary + "10" },
  segmented: { flexDirection: "row", borderRadius: radius.xl, borderWidth: 1, padding: spacing.xs, gap: spacing.xs },
  segment: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.md, alignItems: "center" },
  segmentText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  sectionTitle: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, textTransform: "uppercase", letterSpacing: 0.8 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 6 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  title: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  status: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, textTransform: "capitalize" },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.regular },
  note: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  issue: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  confirmationChip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  confirmationTextWrap: { flex: 1 },
  confirmationTitle: { fontSize: fontSizes.xs, fontFamily: fonts.bold },
  confirmationMeta: { fontSize: 11, fontFamily: fonts.medium, marginTop: spacing.xs },
  detailBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing.sm },
  detailText: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  empty: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" }
});