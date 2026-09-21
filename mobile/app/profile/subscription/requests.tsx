import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import type { SubscriptionRequestDetails, SubscriptionRequestStatus } from "@/lib/types";
import { formatPrice, listMySubscriptionRequests } from "@/lib/subscription";

const STATUS_STYLE: Record<SubscriptionRequestStatus, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { bg: "#FEF3C7", fg: "#B45309", icon: "time-outline" },
  approved: { bg: "#DCFCE7", fg: "#15803D", icon: "checkmark-circle" },
  rejected: { bg: "#FEE2E2", fg: "#B91C1C", icon: "close-circle" },
};

const STATUS_LABEL_KEY: Record<SubscriptionRequestStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function SubscriptionRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { refreshData } = useApp();
  const toast = useToast();

  const [requests, setRequests] = useState<SubscriptionRequestDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const items = await listMySubscriptionRequests();
      setRequests(items);
    } catch {
      toast.error(t("Unable to load plans. Please try again."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
      void loadRequests();
    }, [loadRequests, refreshData])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BottomWhiteScent />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <AppText variant="title" color={colors.text}>
          {t("My subscription requests")}
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadRequests();
            }}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
            <AppText center color={colors.textSecondary}>
              {t("No requests yet.")}
            </AppText>
            <Button
              label={t("View plans & upgrade")}
              onPress={() => router.push("/profile/change-plan")}
              style={styles.actionBtn}
            />
          </View>
        ) : (
          requests.map((request) => {
            const style = STATUS_STYLE[request.status];
            return (
              <View
                key={request.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <AppText color={colors.text} style={styles.cardTitle}>
                      {request.plan_id}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {formatPrice(request.amount, request.currency)}
                      {"  ·  "}
                      {request.payment_method === "mtn" ? "MTN" : "Orange"}
                    </AppText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon} size={14} color={style.fg} />
                    <AppText variant="caption" color={style.fg}>
                      {t(STATUS_LABEL_KEY[request.status])}
                    </AppText>
                  </View>
                </View>
                {request.status === "rejected" && request.admin_note && (
                  <View style={[styles.noteBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {t("Reason")}: {request.admin_note}
                    </AppText>
                  </View>
                )}
                <AppText variant="caption" color={colors.textSecondary} style={styles.dateText}>
                  {new Date(request.created_at).toLocaleDateString()}
                </AppText>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 20, width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.md },
  centered: { alignItems: "center", paddingVertical: 48, gap: 12 },
  actionBtn: { marginTop: spacing.md, minWidth: 220 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: fontSizes.body, fontFamily: fonts.bold, textTransform: "capitalize" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  noteBox: { borderRadius: radius.md, padding: 10 },
  dateText: { fontSize: 11 },
});
