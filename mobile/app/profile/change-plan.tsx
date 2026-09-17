import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import type { SubscriptionPlan } from "@/lib/types";

type PlanInfo = {
  id: SubscriptionPlan;
  icon: keyof typeof Ionicons.glyphMap;
  taglineKey: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: PlanInfo[] = [
  {
    id: "free",
    icon: "leaf-outline",
    taglineKey: "3 free pickups every month, then subscribe for more.",
    features: [
      "3 free pickups per month",
      "Standard time windows",
      "Rewards & badges included",
    ],
  },
  {
    id: "plus",
    icon: "flash-outline",
    taglineKey: "Unlimited pickups, priority handling.",
    features: [
      "Unlimited pickups",
      "Priority scheduling windows",
      "Best for regular households",
    ],
    highlight: true,
  },
  {
    id: "pro",
    icon: "diamond-outline",
    taglineKey: "Unlimited pickups for larger homes & businesses.",
    features: [
      "Unlimited pickups",
      "Priority + same-day windows",
      "Dedicated support",
    ],
  },
];

const planLabel: Record<SubscriptionPlan, (t: (key: string) => string) => string> = {
  free: (t) => t("Essentiel (Free)"),
  plus: () => "Plus",
  pro: () => "Pro",
};

export default function ChangePlanScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useApp();
  const currentPlan: SubscriptionPlan = user?.subscriptionPlan ?? "free";

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

        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
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
                      backgroundColor: plan.highlight
                        ? Colors.primary + "18"
                        : colors.surfaceSecondary,
                    },
                  ]}
                >
                  <Ionicons
                    name={plan.icon}
                    size={22}
                    color={plan.highlight ? Colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={styles.planInfo}>
                  <View style={styles.planTitleRow}>
                    <AppText color={colors.text}>{planLabel[plan.id](t)}</AppText>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: Colors.primary + "22" }]}>
                        <AppText variant="caption" color={Colors.primary}>
                          {t("Current")}
                        </AppText>
                      </View>
                    )}
                  </View>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {t(plan.taglineKey)}
                  </AppText>
                </View>
              </View>

              <View style={[styles.planDivider, { backgroundColor: colors.border }]} />

              <View style={styles.featureList}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    <AppText style={styles.featureText} color={colors.text}>
                      {t(feature)}
                    </AppText>
                  </View>
                ))}
              </View>

              {!isCurrent &&
                (plan.id === "free" ? (
                  <Button
                    variant="secondary"
                    label={t("Back to free plan")}
                    onPress={() => router.back()}
                    style={styles.actionBtn}
                  />
                ) : (
                  <Button
                    label={t("Subscribe to {plan}", { plan: plan.id === "plus" ? "Plus" : "Pro" })}
                    onPress={() => router.push("/profile/settings")}
                    style={styles.actionBtn}
                  />
                ))}
            </View>
          );
        })}

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