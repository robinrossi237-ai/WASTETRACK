import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { ApiError } from "@/lib/api-client";
import type { PlanDetails, SubscriptionPlan } from "@/lib/types";
import { createSubscriptionRequest, fetchPricing, formatPrice } from "@/lib/subscription";

const PLAN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  free: "leaf-outline",
  plus: "flash-outline",
  pro: "diamond-outline",
};

export default function ChangePlanScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, refreshData } = useApp();
  const toast = useToast();

  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activatingFree, setActivatingFree] = useState(false);

  const currentPlan: SubscriptionPlan = user?.subscriptionPlan ?? "free";

  const loadPlans = useCallback(async () => {
    try {
      const { plans: fetched } = await fetchPricing();
      setPlans(fetched);
    } catch {
      toast.error(t("Unable to load plans. Please try again."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleFreePlan = async (plan: PlanDetails) => {
    setActivatingFree(true);
    try {
      await createSubscriptionRequest({ planId: plan.id, paymentMethod: "mtn" });
      toast.success(t("Free plan activated."));
      await refreshData();
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("Unable to load plans. Please try again.");
      toast.error(message);
    } finally {
      setActivatingFree(false);
    }
  };

  const renderPlanAction = (plan: PlanDetails, isCurrent: boolean) => {
    if (isCurrent) return null;
    if (plan.price_amount === 0) {
      return (
        <Button
          variant="secondary"
          label={t("Back to free plan")}
          onPress={() => void handleFreePlan(plan)}
          loading={activatingFree}
          style={styles.actionBtn}
        />
      );
    }
    return (
      <Button
        label={t("Subscribe to {plan}", { plan: plan.name })}
        onPress={() => router.push(`/profile/subscription/pay?plan=${encodeURIComponent(plan.id)}`)}
        style={styles.actionBtn}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BottomWhiteScent />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <AppText variant="title" color={colors.text}>
          {t("Subscription plans")}
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
              void loadPlans();
            }}
          />
        }
      >
        <View style={styles.heroCard}>
          <Ionicons name="sparkles" size={26} color={Colors.primary} />
          <AppText variant="title" color={colors.text} center>
            {t("Pickup plans")}
          </AppText>
          <AppText center color={colors.textSecondary} style={styles.heroText}>
            {t("Start free with 3 pickups per month. Upgrade anytime to remove the limit.")}
          </AppText>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <AppText color={colors.textSecondary} style={styles.loadingText}>
              {t("Loading plans...")}
            </AppText>
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText center color={colors.textSecondary}>
              {t("No plans available right now.")}
            </AppText>
            <Button label={t("Retry")} onPress={() => void loadPlans()} style={styles.actionBtn} />
          </View>
        ) : (
          plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const highlight = plan.price_amount > 0;
            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isCurrent ? Colors.primary : colors.border,
                  },
                ]}
              >
                <View style={styles.planHeader}>
                  <View
                    style={[
                      styles.planIcon,
                      {
                        backgroundColor: highlight ? Colors.primary + "18" : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={PLAN_ICONS[plan.id] ?? "star-outline"}
                      size={22}
                      color={highlight ? Colors.primary : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.planInfo}>
                    <View style={styles.planTitleRow}>
                      <AppText color={colors.text}>{plan.name}</AppText>
                      {isCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: Colors.primary + "22" }]}>
                          <AppText variant="caption" color={Colors.primary}>
                            {t("Current")}
                          </AppText>
                        </View>
                      )}
                    </View>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {plan.price_amount === 0
                        ? t("Free")
                        : `${formatPrice(plan.price_amount, plan.currency)} ${t("per month")}`}
                      {"  ·  "}
                      {plan.monthly_limit === null
                        ? t("Unlimited pickups")
                        : t("{limit} pickups / month", { limit: String(plan.monthly_limit) })}
                    </AppText>
                  </View>
                </View>

                <View style={[styles.planDivider, { backgroundColor: colors.border }]} />

                <View style={styles.featureList}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                      <AppText style={styles.featureText} color={colors.text}>
                        {feature}
                      </AppText>
                    </View>
                  ))}
                </View>

                {renderPlanAction(plan, isCurrent)}
              </View>
            );
          })
        )}

        <View style={[styles.noteCard, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <AppText style={styles.noteText} color={colors.textSecondary}>
            {t("Paid subscriptions are validated by our team. Contact support through Settings after choosing a plan.")}
          </AppText>
        </View>
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
  content: { padding: 20, width: "100%", maxWidth: 720, alignSelf: "center" },
  heroCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: radius.xxl,
    backgroundColor: Colors.primary + "0F",
    borderWidth: 1,
    borderColor: Colors.primary + "22",
    marginBottom: spacing.lg,
    gap: 6,
  },
  heroText: { lineHeight: 20 },
  loadingWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14 },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 16 },
  planCard: {
    borderWidth: 1.5,
    borderRadius: radius.xxl,
    padding: 18,
    marginBottom: 14,
  },
  planHeader: { flexDirection: "row", gap: spacing.md },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  planInfo: { flex: 1, gap: 4 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  currentBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  planDivider: { height: 1, marginVertical: 14 },
  featureList: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 14, flex: 1 },
  actionBtn: { marginTop: spacing.lg },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: radius.lg,
    padding: 14,
  },
  noteText: { flex: 1, lineHeight: 18 },
});
