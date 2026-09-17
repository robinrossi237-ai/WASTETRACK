import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { radius, spacing, fonts, fontSizes } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import {
  registerPushTokenWithBackend,
  unregisterSavedPushTokenFromBackend,
} from "@/lib/push-notifications";
import * as storage from "@/lib/storage";

const TIME_WINDOWS = [
  { value: "08:00", labelKey: "8 AM - 10 AM" },
  { value: "10:00", labelKey: "10 AM - 12 PM" },
  { value: "14:00", labelKey: "2 PM - 4 PM" },
];
const WASTETRACK_SUPPORT_PHONE = "237652605329";

export default function ProfileSettingsScreen() {
  const { colors, preference, setThemeMode, setManualTheme } = useTheme();
  const { language, setLanguage, t, options } = useLanguage();
  const { user, pickupQuota, schedulePreference, updateSchedulePreference } = useApp();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isPushUpdating, setIsPushUpdating] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      setPushEnabled(false);
      return () => {
        isMounted = false;
      };
    }

    void storage.getPushEnabled(userId).then((enabled) => {
      if (!isMounted) return;
      setPushEnabled(enabled);
    });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleOpenFeedback = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/profile/feedback");
  };

  const handlePushPreference = async (nextEnabled: boolean) => {
    if (!user || isPushUpdating) return;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsPushUpdating(true);
    try {
      await storage.setPushEnabled(nextEnabled, user.id);
      setPushEnabled(nextEnabled);
      if (nextEnabled) {
        await registerPushTokenWithBackend({ forcePrompt: true });
      } else {
        await unregisterSavedPushTokenFromBackend();
      }
    } finally {
      setIsPushUpdating(false);
    }
  };

  const handleContactWasteTrack = async () => {
    const message = encodeURIComponent(t("Hello WasteTrack team"));
    const appUrl = `whatsapp://send?phone=${WASTETRACK_SUPPORT_PHONE}&text=${message}`;
    const webUrl = `https://wa.me/${WASTETRACK_SUPPORT_PHONE}?text=${message}`;
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : webUrl);
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BottomWhiteScent />
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
          <AppText variant="title" color={colors.text} center style={styles.emptyTitle}>
            {t("Sign in to view settings")}
          </AppText>
          <AppText center color={colors.textSecondary}>
            {t("Please sign in to manage your profile settings.")}
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

  const currentPlanLabel =
    user.subscriptionPlan === "free"
      ? t("Free (Essentiel)")
      : user.subscriptionPlan === "plus"
        ? t("Plus")
        : t("Pro");

  const renderRadio = (
    label: string,
    selected: boolean,
    onPress: () => void,
    disabled = false
  ) => (
    <Pressable
      style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
        {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
      </View>
      <AppText variant="label" color={colors.text}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <BottomWhiteScent />
      <View style={[styles.stickyHeader, { backgroundColor: colors.background }]}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <AppText color={colors.text} style={styles.infoText}>{user.email}</AppText>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            <AppText color={colors.text} style={styles.infoText}>{user.phone ?? "--"}</AppText>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
            <AppText color={colors.text} style={styles.infoText}>{user.neighborhood ?? "-"}</AppText>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="card-outline" size={18} color={Colors.accent} />
            <AppText variant="label" color={colors.text}>{t("Subscription plan")}</AppText>
          </View>
          <View style={styles.infoRow}>
            <AppText color={colors.textSecondary} style={styles.infoText}>
              {t("Current plan")}
            </AppText>
            <View
              style={[
                styles.planBadge,
                {
                  backgroundColor:
                    user.subscriptionPlan === "free" ? Colors.accent + "22" : Colors.primary + "22",
                },
              ]}
            >
              <AppText
                variant="label"
                color={user.subscriptionPlan === "free" ? "#B45309" : Colors.primary}
              >
                {currentPlanLabel}
              </AppText>
            </View>
          </View>
          {user.subscriptionPlan === "free" && pickupQuota && !pickupQuota.isUnlimited && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Ionicons name="flash-outline" size={18} color={Colors.accent} />
                <AppText color={colors.text} style={styles.infoText}>
                  {t("{remaining} of {limit} free pickups left this month", {
                    remaining: String(pickupQuota.remaining ?? 0),
                    limit: String(pickupQuota.limit ?? 0),
                  })}
                </AppText>
              </View>
            </>
          )}
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/profile/change-plan")}
          >
            <AppText variant="label" color={Colors.primary} style={styles.infoText}>
              {t("View plans & upgrade")}
            </AppText>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="color-palette-outline" size={18} color={colors.textSecondary} />
            <AppText variant="label" color={colors.text}>{t("Theme")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {(["auto", "manual"] as const).map((mode) =>
              renderRadio(
                mode === "auto" ? t("Auto (time-based)") : t("Manual"),
                preference.mode === mode,
                () => setThemeMode(mode)
              )
            )}
          </View>
          {preference.mode === "manual" && (
            <View style={styles.radioGroup}>
              {(["light", "dark"] as const).map((mode) =>
                renderRadio(
                  mode === "light" ? t("Light theme") : t("Dark theme"),
                  preference.manualTheme === mode,
                  () => setManualTheme(mode)
                )
              )}
            </View>
          )}
          <AppText variant="caption" color={colors.textSecondary}>
            {t("Auto follows your local time. Manual stays fixed.")}
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
            <AppText variant="label" color={colors.text}>{t("language.title")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {options.map((option) =>
              renderRadio(t(option.labelKey), language === option.code, () =>
                setLanguage(option.code)
              )
            )}
          </View>
          <AppText variant="caption" color={colors.textSecondary}>{t("language.hint")}</AppText>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
            <AppText variant="label" color={colors.text}>{t("Notifications")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {[
              { id: "on", label: t("Enable push notifications"), value: true },
              { id: "off", label: t("Disable push notifications"), value: false },
            ].map((option) =>
              renderRadio(
                option.label,
                pushEnabled === option.value,
                () => void handlePushPreference(option.value),
                isPushUpdating
              )
            )}
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
            {t("Turn this on to receive pickup updates and important alerts.")}
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.textSecondary} />
            <AppText variant="label" color={colors.text}>{t("Contact WasteTrack")}</AppText>
          </View>
          <AppText variant="caption" color={colors.textSecondary} style={styles.contactHint}>
            {t("Need help? Chat with WasteTrack support on WhatsApp.")}
          </AppText>
          <Button
            label={t("Chat on WhatsApp")}
            leftIcon="logo-whatsapp"
            onPress={() => void handleContactWasteTrack()}
            style={styles.contactButton}
          />
        </View>

        {user.role === "resident" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <AppText variant="label" color={colors.text}>{t("Pickup time preference")}</AppText>
            </View>
            <View style={styles.radioGroup}>
              {TIME_WINDOWS.map((slot) =>
                renderRadio(
                  t(slot.labelKey),
                  schedulePreference?.timeWindow === slot.value,
                  () => void updateSchedulePreference({ timeWindow: slot.value })
                )
              )}
              {renderRadio(
                t("Ask me each time"),
                !schedulePreference?.timeWindow,
                () => void updateSchedulePreference(null)
              )}
            </View>
            <AppText variant="caption" color={colors.textSecondary}>
              {t("We'll preselect your saved window when you create a new pickup request.")}
            </AppText>
          </View>
        )}

        {user.role === "resident" && (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              styles.feedbackCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleOpenFeedback}
          >
            <View style={styles.feedbackRow}>
              <View style={[styles.feedbackIcon, { backgroundColor: Colors.primary + "12" }]}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.feedbackTextWrap}>
                <AppText color={colors.text}>{t("Feedback & Ratings")}</AppText>
                <AppText variant="caption" color={colors.textSecondary} style={styles.feedbackHint}>
                  {t("Tell us what you love or what we should improve.")}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
        )}

        <AppText style={styles.versionText} color={colors.textSecondary}>
          {t("WasteTrack version 1.0.0")}
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  content: { padding: 20, gap: spacing.lg },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  infoCard: {
    borderRadius: 14,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: 14 },
  infoText: { fontSize: fontSizes.body, fontFamily: fonts.regular, flex: 1 },
  infoDivider: { height: 1, marginHorizontal: spacing.sm + 6 },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.sm + 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  planBadge: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  radioGroup: { gap: 10, marginBottom: 10 },
  radioOption: { flexDirection: "row", alignItems: "center", gap: 10 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  contactHint: { marginBottom: spacing.sm },
  contactButton: { alignSelf: "flex-start", paddingHorizontal: spacing.lg },
  feedbackCard: { padding: spacing.sm + 2 },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  feedbackIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackTextWrap: { flex: 1, gap: 2 },
  feedbackHint: { marginTop: 0 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
    paddingTop: 40,
  },
  emptyTitle: { marginTop: 8 },
  signInButton: { marginTop: 16, paddingHorizontal: 32 },
  versionText: { textAlign: "center", fontSize: 11, marginTop: 6 },
});