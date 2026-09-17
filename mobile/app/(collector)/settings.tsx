import React, { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, shadows, spacing } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import * as storage from "@/lib/storage";
import {
  registerPushTokenWithBackend,
  unregisterSavedPushTokenFromBackend,
} from "@/lib/push-notifications";

const WASTETRACK_SUPPORT_PHONE = "237652605329";

export default function CollectorSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, preference, setThemeMode, setManualTheme } = useTheme();
  const { user, switchRole, setCollectorAutoLocationTracking, setCollectorExitLocationCaptureEnabled } = useApp();
  const toast = useToast();
  const { t, language, setLanguage, options } = useLanguage();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [isSwitching, setIsSwitching] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isPushUpdating, setIsPushUpdating] = useState(false);
  const [autoLocationEnabled, setAutoLocationEnabled] = useState(true);
  const [isAutoLocationUpdating, setIsAutoLocationUpdating] = useState(false);
  const [exitCaptureEnabled, setExitCaptureEnabled] = useState(true);
  const [isExitCaptureUpdating, setIsExitCaptureUpdating] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      setPushEnabled(false);
      setAutoLocationEnabled(true);
      setExitCaptureEnabled(true);
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

  useEffect(() => {
    setAutoLocationEnabled(user?.collectorAutoLocationTracking ?? true);
  }, [user?.collectorAutoLocationTracking]);

  useEffect(() => {
    setExitCaptureEnabled(user?.collectorExitLocationCaptureEnabled ?? true);
  }, [user?.collectorExitLocationCaptureEnabled]);

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

  const handleAutoLocationPreference = async (nextEnabled: boolean) => {
    if (!user || isAutoLocationUpdating) return;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsAutoLocationUpdating(true);
    try {
      await setCollectorAutoLocationTracking(nextEnabled);
      setAutoLocationEnabled(nextEnabled);
      toast.success(
        nextEnabled
          ? t("Auto location updates enabled")
          : t("Auto location updates disabled")
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to update auto location setting");
      toast.error(message);
    } finally {
      setIsAutoLocationUpdating(false);
    }
  };

  const handleExitCapturePreference = async (nextEnabled: boolean) => {
    if (!user || isExitCaptureUpdating) return;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsExitCaptureUpdating(true);
    try {
      await setCollectorExitLocationCaptureEnabled(nextEnabled);
      setExitCaptureEnabled(nextEnabled);
      toast.success(
        nextEnabled
          ? t("Exit location capture enabled")
          : t("Exit location capture disabled")
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to update exit location setting");
      toast.error(message);
    } finally {
      setIsExitCaptureUpdating(false);
    }
  };

  const handleSwitchRole = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const doSwitch = async () => {
      if (!switchRole) return;
      setIsSwitching(true);
      try {
        await switchRole("resident");
        toast.success(t("Switched to resident profile"));
        router.replace("/(tabs)");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Failed to switch role"));
      } finally {
        setIsSwitching(false);
      }
    };

    if (Platform.OS === "web") {
      await doSwitch();
      return;
    }

    Alert.alert(
      t("Switch to resident?"),
      t("You will use the resident app experience where pickups and reports are free."),
      [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Switch"), style: "destructive", onPress: () => void doSwitch() },
      ]
    );
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
        <View style={[styles.emptyState, { paddingTop: insets.top + webTopInset + 40 }]}>
          <Ionicons name="settings-outline" size={64} color={colors.textSecondary} />
          <AppText style={styles.emptyTitle} color={colors.text}>{t("Sign in to view settings")}</AppText>
          <AppText style={styles.emptyText} color={colors.textSecondary}>
            {t("Please sign in to manage your collector settings.")}
          </AppText>
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.replace("/(auth)/login")}
          >
            <AppText style={styles.signInButtonText} color="#fff">{t("Sign In")}</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <BottomWhiteScent />
      <View
        style={[
          styles.stickyHeader,
          { backgroundColor: colors.background, paddingTop: insets.top + webTopInset + spacing.sm },
        ]}
      >
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <AppText style={styles.infoText} color={colors.text}>{user.email}</AppText>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            <AppText style={styles.infoText} color={colors.text}>{user.phone ?? "--"}</AppText>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
            <AppText style={styles.infoText} color={colors.text}>{user.neighborhood ?? "-"}</AppText>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}>
            <Ionicons name="color-palette-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.themeTitle} color={colors.text}>{t("Theme")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {(["auto", "manual"] as const).map((mode) => {
              const selected = preference.mode === mode;
              return (
                <Pressable
                  key={mode}
                  style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
                  onPress={() => setThemeMode(mode)}
                >
                  <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
                  </View>
                  <AppText style={styles.radioLabel} color={colors.text}>
                    {mode === "auto" ? t("Auto (time-based)") : t("Manual")}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {preference.mode === "manual" && (
            <View style={styles.radioGroup}>
              {(["light", "dark"] as const).map((mode) => {
                const selected = preference.manualTheme === mode;
                return (
                  <Pressable
                    key={mode}
                    style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
                    onPress={() => setManualTheme(mode)}
                  >
                    <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
                      {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
                    </View>
                    <AppText style={styles.radioLabel} color={colors.text}>
                      {mode === "light" ? t("Light theme") : t("Dark theme")}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}
          <AppText style={styles.themeHint} color={colors.textSecondary}>
            {t("Auto follows your local time. Manual stays fixed.")}
          </AppText>
        </View>

        <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}>
            <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.themeTitle} color={colors.text}>{t("language.title")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {options.map((option) => {
              const selected = language === option.code;
              return (
                <Pressable
                  key={option.code}
                  style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
                  onPress={() => setLanguage(option.code)}
                >
                  <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
                  </View>
                  <AppText style={styles.radioLabel} color={colors.text}>{t(option.labelKey)}</AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText style={styles.themeHint} color={colors.textSecondary}>{t("language.hint")}</AppText>
        </View>

        <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}>
            <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.themeTitle} color={colors.text}>{t("Notifications")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {[
              { id: "on", label: t("Enable push notifications"), value: true },
              { id: "off", label: t("Disable push notifications"), value: false },
            ].map((option) => {
              const selected = pushEnabled === option.value;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
                  onPress={() => void handlePushPreference(option.value)}
                  disabled={isPushUpdating}
                >
                  <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
                  </View>
                  <AppText style={styles.radioLabel} color={colors.text}>{option.label}</AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText style={styles.themeHint} color={colors.textSecondary}>
            {t("Turn this on to receive pickup updates and important alerts.")}
          </AppText>
        </View>

        <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}>
            <Ionicons name="navigate-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.themeTitle} color={colors.text}>{t("Auto location updates")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {[
              { id: "auto-on", label: t("Enable automatic location updates"), value: true },
              { id: "auto-off", label: t("Disable automatic location updates"), value: false },
            ].map((option) => {
              const selected = autoLocationEnabled === option.value;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
                  onPress={() => void handleAutoLocationPreference(option.value)}
                  disabled={isAutoLocationUpdating}
                >
                  <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
                  </View>
                  <AppText style={styles.radioLabel} color={colors.text}>{option.label}</AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText style={styles.themeHint} color={colors.textSecondary}>
            {t("When enabled, the collector map starts sharing location automatically when opened.")}
          </AppText>
        </View>

        <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}>
            <Ionicons name="locate-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.themeTitle} color={colors.text}>{t("Save location when leaving app")}</AppText>
          </View>
          <View style={styles.radioGroup}>
            {[
              { id: "exit-capture-on", label: t("Enable sign-out/background location capture"), value: true },
              { id: "exit-capture-off", label: t("Disable sign-out/background location capture"), value: false },
            ].map((option) => {
              const selected = exitCaptureEnabled === option.value;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [styles.radioOption, pressed && { opacity: 0.85 }]}
                  onPress={() => void handleExitCapturePreference(option.value)}
                  disabled={isExitCaptureUpdating}
                >
                  <View style={[styles.radioOuter, { borderColor: selected ? Colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} /> : null}
                  </View>
                  <AppText style={styles.radioLabel} color={colors.text}>{option.label}</AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText style={styles.themeHint} color={colors.textSecondary}>
            {t("When enabled, we can ask to save your last location when you sign out or leave the app.")}
          </AppText>
        </View>

        <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.textSecondary} />
            <AppText style={styles.themeTitle} color={colors.text}>{t("Contact WasteTrack")}</AppText>
          </View>
          <AppText style={styles.themeHint} color={colors.textSecondary}>
            {t("Need help? Chat with WasteTrack support on WhatsApp.")}
          </AppText>
          <Pressable
            style={({ pressed }) => [
              styles.contactButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => void handleContactWasteTrack()}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <AppText style={styles.contactButtonText} color="#fff">{t("Chat on WhatsApp")}</AppText>
          </Pressable>
        </View>

        <View style={[styles.roleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.roleHeader}>
            <Ionicons name="swap-horizontal-outline" size={18} color={Colors.primary} />
            <AppText style={styles.roleTitle} color={colors.text}>{t("Switch to resident")}</AppText>
          </View>
          <AppText style={styles.roleHint} color={colors.textSecondary}>
            {t("Move to the resident experience to request free pickups and submit reports.")}
          </AppText>
          <Pressable
            style={({ pressed }) => [
              styles.switchButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleSwitchRole}
            disabled={isSwitching}
          >
            <Ionicons name="person-outline" size={18} color="#fff" />
            <AppText style={styles.switchButtonText} color="#fff">
              {isSwitching ? t("Switching...") : t("Switch role")}
            </AppText>
          </Pressable>
        </View>

        <AppText style={styles.versionText} color={colors.textSecondary}>{t("WasteTrack version 1.0.0")}</AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  stickyHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  infoCard: {
    borderRadius: radius.xl,
    padding: spacing.xs,
    ...shadows.card,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: 14 },
  infoText: { fontSize: fontSizes.body, fontFamily: fonts.regular, flex: 1 },
  infoDivider: { height: 1, marginHorizontal: 14 },
  themeCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 14,
  },
  themeHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 10 },
  themeTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
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
  radioLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold },
  themeHint: { fontSize: fontSizes.xs, fontFamily: fonts.regular },
  roleCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  roleHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  roleTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  roleHint: { fontSize: fontSizes.xs, fontFamily: fonts.regular },
  switchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  switchButtonText: { fontSize: fontSizes.sm, fontFamily: fonts.semibold },
  contactButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  contactButtonText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl },
  emptyTitle: { fontSize: fontSizes.title, fontFamily: fonts.semibold, marginTop: spacing.lg },
  emptyText: { fontSize: fontSizes.md, fontFamily: fonts.regular, textAlign: "center", marginTop: spacing.sm, lineHeight: spacing.xl },
  signInButton: { paddingVertical: 14, paddingHorizontal: spacing.xxxl, borderRadius: radius.lg, marginTop: spacing.xxl },
  signInButtonText: { fontSize: fontSizes.button, fontFamily: fonts.semibold },
  versionText: { textAlign: "center", fontSize: 11, fontFamily: fonts.medium, marginTop: 6 },
});