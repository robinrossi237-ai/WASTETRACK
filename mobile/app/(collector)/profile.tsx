import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, shadows, spacing } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import { useApp } from "@/lib/context";
import { captureCurrentDeviceLocation, type CapturedDeviceLocation } from "@/lib/device-location";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { collectorApi } from "@/lib/collector-api";
import { locationApi } from "@/lib/location-api";

const WASTETRACK_SUPPORT_PHONE = "237652605329";
const LOGOUT_CAPTURE_SIMULATION_MS = 900;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const confirmOnWeb = (message: string, fallback: boolean): boolean => {
  const confirmFn = (globalThis as { confirm?: (value?: string) => boolean }).confirm;
  if (typeof confirmFn !== "function") {
    return fallback;
  }
  return confirmFn(message);
};

export default function CollectorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const { user, logout } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [isLoading, setIsLoading] = useState(false);
  const [assignedPickups, setAssignedPickups] = useState(0);
  const [assignedReports, setAssignedReports] = useState(0);
  const [completedPickups, setCompletedPickups] = useState(0);
  const [cleanedReports, setCleanedReports] = useState(0);
  const [issuesCount, setIssuesCount] = useState(0);
  const [isCapturingLogoutLocation, setIsCapturingLogoutLocation] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pickupsAssigned, reportsAssigned, pickupsHistory, reportsHistory] = await Promise.all([
        collectorApi.listAssigned(),
        collectorApi.listAssignedReports(),
        collectorApi.listHistory(),
        collectorApi.listReportHistory(),
      ]);

      setAssignedPickups(pickupsAssigned.length);
      setAssignedReports(reportsAssigned.length);
      setCompletedPickups(pickupsHistory.filter((p) => p.status === "completed").length);
      setCleanedReports(reportsHistory.filter((r) => r.status === "cleaned" || r.status === "approved").length);
      setIssuesCount(
        pickupsHistory.filter((p) => !!p.issue_reason).length +
          reportsHistory.filter((r) => !!r.collector_issue_reason).length
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to load profile stats"));
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const totalAssigned = assignedPickups + assignedReports;
    return [
      { label: t("Assigned"), value: totalAssigned, icon: "list" as const, color: Colors.primary },
      { label: t("Completed"), value: completedPickups + cleanedReports, icon: "checkbox" as const, color: Colors.success },
      { label: t("Issues"), value: issuesCount, icon: "alert-circle" as const, color: Colors.error },
    ];
  }, [assignedPickups, assignedReports, completedPickups, cleanedReports, issuesCount, t]);

  const handleEditProfile = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/profile/edit");
  };

  const handleOpenGuide = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/guide");
  };

  const handleOpenSettings = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/(collector)/settings");
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

  const handleLogout = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const doLogout = async () => {
      await logout();
      toast.success(t("Signed out"));
      router.replace("/(public)/get-started");
    };

    const saveLocationThenLogout = async (location: CapturedDeviceLocation | null) => {
      try {
        if (!location) {
          toast.error(t("Could not save last location"));
          return;
        }
        await locationApi.trackLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        });
        toast.success(t("Last location saved"));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("Could not save last location");
        toast.error(message);
      } finally {
        await doLogout();
      }
    };

    const captureLogoutLocation = async () => {
      setIsCapturingLogoutLocation(true);
      const startedAt = Date.now();
      try {
        const location = await captureCurrentDeviceLocation({
          requestPermission: true,
          includeLabel: true,
          allowCoordinateFallback: false,
          retries: 2,
        });
        const elapsed = Date.now() - startedAt;
        if (elapsed < LOGOUT_CAPTURE_SIMULATION_MS) {
          await wait(LOGOUT_CAPTURE_SIMULATION_MS - elapsed);
        }
        return location;
      } finally {
        setIsCapturingLogoutLocation(false);
      }
    };

    const promptSaveLocationThenLogout = async () => {
      if (user?.collectorExitLocationCaptureEnabled === false) {
        await doLogout();
        return;
      }

      const location = await captureLogoutLocation();
      const captureMessage = location
        ? t("Last location captured: {location}", {
          location: location.label.trim() || t("Location unavailable"),
        })
        : t("Last location is unavailable right now.");

      if (Platform.OS === "web") {
        const shouldSave = confirmOnWeb(`${t("Save last location?")}\n\n${captureMessage}`, false);
        if (shouldSave) {
          await saveLocationThenLogout(location);
          return;
        }
        await doLogout();
        return;
      }

      Alert.alert(
        t("Save last location?"),
        captureMessage,
        [
          {
            text: t("Not now"),
            style: "cancel",
            onPress: () => {
              void doLogout();
            },
          },
          {
            text: t("Save"),
            onPress: () => {
              void saveLocationThenLogout(location);
            },
          },
        ]
      );
    };

    if (Platform.OS === "web") {
      const shouldLogout = confirmOnWeb(t("Are you sure you want to sign out?"), true);
      if (!shouldLogout) {
        return;
      }
      await promptSaveLocationThenLogout();
      return;
    }

    Alert.alert(t("Sign Out"), t("Are you sure you want to sign out?"), [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Sign Out"), style: "destructive", onPress: () => void promptSaveLocationThenLogout() },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BottomWhiteScent />
        <View style={[styles.emptyState, { paddingTop: insets.top + webTopInset + 40 }]}>
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
          <AppText style={styles.emptyTitle} color={colors.text}>{t("Sign in to view profile")}</AppText>
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push("/(auth)/login")}
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
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <BottomWhiteScent />
      <LinearGradient
        colors={[Colors.secondary, "#06B6D4"]}
        style={[styles.header, { paddingTop: insets.top + webTopInset + spacing.xl }]}
      >
        <View style={styles.avatar}>
          <AppText style={styles.avatarText} color="#fff">{user.name.charAt(0).toUpperCase()}</AppText>
        </View>
        <AppText style={styles.userName} color="#fff">{user.name}</AppText>
        <AppText style={styles.userRole} color="rgba(255,255,255,0.88)">
          {t("Waste Collector")}
          {user.neighborhood ? ` - ${user.neighborhood}` : ""}
        </AppText>

        <View style={styles.statsRow}>
          {stats.map((s, idx) => (
            <View key={s.label} style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <Ionicons name={s.icon} size={18} color="#fff" />
              </View>
              <AppText style={styles.statValue} color="#fff">{s.value}</AppText>
              <AppText style={styles.statLabel} color="rgba(255,255,255,0.86)">{s.label}</AppText>
              {idx !== stats.length - 1 ? <View style={styles.statDivider} /> : null}
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.infoText} color={colors.text}>{user.email}</AppText>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
            <AppText style={styles.infoText} color={colors.text}>{user.phone ?? "-"}</AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
            onPress={handleEditProfile}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <AppText style={styles.primaryActionText} color="#fff">{t("Edit Profile")}</AppText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.guideAction,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleOpenGuide}
          >
            <View style={[styles.guideIcon, { backgroundColor: Colors.secondary + "12" }]}>
              <Ionicons name="compass-outline" size={20} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.guideTitle} color={colors.text}>{t("Collector Guide")}</AppText>
              <AppText style={styles.guideSubtitle} color={colors.textSecondary}>
                {t("Learn how to manage assignments, routing, proofs, and issue handling.")}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.guideAction,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleOpenSettings}
          >
            <View style={[styles.guideIcon, { backgroundColor: Colors.primary + "12" }]}>
              <Ionicons name="settings-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.guideTitle} color={colors.text}>{t("Settings")}</AppText>
              <AppText style={styles.guideSubtitle} color={colors.textSecondary}>
                {t("Theme preferences and role switch options.")}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => void load()}
            disabled={isLoading}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
              <AppText style={styles.secondaryActionText} color={Colors.primary}>
                {isLoading ? t("Refreshing...") : t("Refresh Stats")}
              </AppText>
            </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.guideAction,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => void handleContactWasteTrack()}
          >
            <View style={[styles.guideIcon, { backgroundColor: Colors.primary + "12" }]}>
              <Ionicons name="logo-whatsapp" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.guideTitle} color={colors.text}>{t("Contact WasteTrack")}</AppText>
              <AppText style={styles.guideSubtitle} color={colors.textSecondary} numberOfLines={2}>
                {t("Need help? Chat with WasteTrack support on WhatsApp.")}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              { backgroundColor: Colors.error + "10" },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <AppText style={styles.logoutText} color={Colors.error}>{t("Sign Out")}</AppText>
          </Pressable>
          <AppText style={styles.signatureText} color={colors.textSecondary}>
            {t("by Tambat Robin all rights reserved")}
          </AppText>
        </View>
      </View>

      <Modal visible={isCapturingLogoutLocation} transparent animationType="fade">
        <View style={styles.captureLocationOverlay}>
          <View style={[styles.captureLocationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <AppText style={styles.captureLocationTitle} color={colors.text}>
              {t("Capturing your current location...")}
            </AppText>
            <AppText style={styles.captureLocationHint} color={colors.textSecondary}>
              {t("Please wait while we get your latest position before sign out.")}
            </AppText>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", paddingBottom: 18, paddingHorizontal: spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontFamily: fonts.bold },
  userName: { fontSize: 24, fontFamily: fonts.bold },
  userRole: { fontSize: fontSizes.sm, fontFamily: fonts.regular, marginTop: spacing.xs },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xxl,
    marginTop: 18,
    width: "100%",
    justifyContent: "space-between",
  },
  statItem: { flex: 1, alignItems: "center" },
  statIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statValue: { fontSize: 22, fontFamily: fonts.bold },
  statLabel: { fontSize: 11, fontFamily: fonts.medium, marginTop: spacing.xs },
  statDivider: { position: "absolute", right: 0, top: 10, bottom: 10, width: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  content: { padding: spacing.xl, marginTop: -spacing.md },
  infoCard: {
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.card,
    marginBottom: spacing.lg,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  infoText: { fontSize: fontSizes.md, fontFamily: fonts.regular, flex: 1 },
  actions: { gap: spacing.md },
  primaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 14, borderRadius: radius.lg },
  primaryActionText: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  guideAction: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: 14, borderRadius: radius.xl, borderWidth: 1 },
  guideIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  guideTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  guideSubtitle: { fontSize: fontSizes.xs, fontFamily: fonts.regular, marginTop: spacing.xs },
  secondaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1 },
  secondaryActionText: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg },
  logoutText: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  signatureText: { fontSize: 11, fontFamily: fonts.regular, textAlign: "center", marginTop: 10 },
  captureLocationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  captureLocationCard: {
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
  },
  captureLocationTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold, textAlign: "center" },
  captureLocationHint: { fontSize: fontSizes.xs, fontFamily: fonts.regular, textAlign: "center", lineHeight: 18 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl },
  emptyTitle: { fontSize: fontSizes.title, fontFamily: fonts.semibold, marginTop: spacing.lg },
  signInButton: { paddingVertical: 14, paddingHorizontal: spacing.xxxl, borderRadius: radius.lg, marginTop: spacing.xxl },
  signInButtonText: { fontSize: fontSizes.button, fontFamily: fonts.semibold },
});