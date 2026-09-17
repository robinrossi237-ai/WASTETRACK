import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
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
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useResidentTabSwipe } from "@/lib/use-resident-tab-swipe";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { apiRequest } from "@/lib/api-client";

const WASTETRACK_SUPPORT_PHONE = "237652605329";

type NotificationItem = {
  id: string;
  is_read: boolean;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, pickups, reports, logout } = useApp();
  const toast = useToast();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const swipeHandlers = useResidentTabSwipe("profile");

  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiRequest<{ success: true; notifications: NotificationItem[] }>("GET", "/notifications");
      const count = data.notifications.filter((n) => !n.is_read).length;
      setUnreadCount(count);
    } catch {
      // Silently fail — badge is non-critical
    }
  }, []);

  useEffect(() => {
    if (user?.role === "resident") {
      void loadUnreadCount();
    }
  }, [user?.role, loadUnreadCount]);

  const completedPickups = pickups.filter(p => p.status === "completed").length;
  const totalReports = reports.length;

  const handleEditProfile = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/profile/edit");
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

    if (Platform.OS === "web") {
      await doLogout();
    } else {
      Alert.alert(t("Sign Out"), t("Are you sure you want to sign out?"), [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Sign Out"), style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const handleOpenSettings = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/profile/settings");
  };

  const handleOpenHistory = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/profile/history");
  };

  const handleOpenNotifications = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/notifications/index" as never);
  };

  const handleCollectorInterest = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      t("Become a Waste Collector"),
      t("Thanks for your interest! Our team will contact you with the next steps.")
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
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        {...swipeHandlers}
      >
        <BottomWhiteScent />
        <View style={[styles.emptyState, { paddingTop: insets.top + webTopInset + 40 }]}>
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
          <AppText style={styles.emptyTitle} color={colors.text}>{t("Sign in to view profile")}</AppText>
          <AppText style={styles.emptyText} color={colors.textSecondary}>
            {t("Create an account to track your eco-friendly contributions.")}
          </AppText>
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push("/(auth)/login")}
          >
            <AppText variant="button" color="#fff">{t("Sign In")}</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  const roleLabel =
    user.role === "resident"
      ? t("Resident")
      : user.role === "collector"
        ? t("Collector")
        : t("Admin");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      contentInsetAdjustmentBehavior="automatic"
      {...swipeHandlers}
    >
      <BottomWhiteScent />
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={[styles.header, { paddingTop: insets.top + webTopInset + 20 }]}
      >
        <View style={styles.avatar}>
          <AppText style={styles.avatarText} color="#fff">{user.name.charAt(0).toUpperCase()}</AppText>
        </View>
        <AppText style={styles.userName} color="#fff">{user.name}</AppText>
        <AppText style={styles.userRole} color="rgba(255,255,255,0.8)">
          {user.neighborhood
            ? `${roleLabel} - ${user.neighborhood}`
            : roleLabel}
        </AppText>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <AppText style={styles.statValue} color="#fff">{user.points}</AppText>
            <AppText style={styles.statLabel} color="rgba(255,255,255,0.8)">{t("Points")}</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText style={styles.statValue} color="#fff">{completedPickups}</AppText>
            <AppText style={styles.statLabel} color="rgba(255,255,255,0.8)">{t("Pickups")}</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText style={styles.statValue} color="#fff">{totalReports}</AppText>
            <AppText style={styles.statLabel} color="rgba(255,255,255,0.8)">{t("Reports")}</AppText>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: Colors.primary },
            pressed && { opacity: 0.9 },
          ]}
          onPress={handleEditProfile}
          testID="edit-profile-btn"
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <AppText variant="button" color="#fff">{t("Edit Profile")}</AppText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.guideBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
          onPress={() => router.push("/guide")}
          testID="open-guide-btn"
        >
          <View style={[styles.guideIcon, { backgroundColor: Colors.primary + "10" }]}>
            <Ionicons name="book-outline" size={20} color={Colors.primary} />
          </View>
          <View style={styles.guideText}>
            <AppText style={styles.guideTitle} color={colors.text}>{t("Resident App Guide")}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.guideSubtitle}>
              {t("Learn how to use pickups, reports, tracking, and rewards.")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.guideBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
          onPress={() => router.push("/learn" as never)}
          testID="profile-learn-nav"
        >
          <View style={[styles.guideIcon, { backgroundColor: Colors.success + "10" }]}>
            <Ionicons name="leaf" size={20} color={Colors.success} />
          </View>
          <View style={styles.guideText}>
            <AppText style={styles.guideTitle} color={colors.text}>{t("Learn & Recycling Tips")}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.guideSubtitle}>
              {t("Practical advice to manage waste responsibly.")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.navCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={handleOpenSettings}
          testID="profile-settings-nav"
        >
          <View style={[styles.navIcon, { backgroundColor: Colors.primary + "12" }]}>
            <Ionicons name="settings-outline" size={20} color={Colors.primary} />
          </View>
          <View style={styles.navText}>
            <AppText style={styles.navTitle} color={colors.text}>{t("Settings")}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.navSubtitle}>
              {t("Theme, notifications, and account details")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.navCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={handleOpenNotifications}
          testID="profile-notifications-nav"
        >
          <View style={[styles.navIcon, { backgroundColor: Colors.warning + "14" }]}>
            <Ionicons name="notifications-outline" size={20} color={Colors.warning} />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <AppText style={styles.unreadBadgeText} color="#fff">{unreadCount > 9 ? "9+" : unreadCount}</AppText>
              </View>
            )}
          </View>
          <View style={styles.navText}>
            <AppText style={styles.navTitle} color={colors.text}>{t("Notification Center")}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.navSubtitle}>
              {t("Pickup, assignment, reports, rewards")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.navCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={handleOpenHistory}
          testID="profile-history-nav"
        >
          <View style={[styles.navIcon, { backgroundColor: Colors.secondary + "12" }]}>
            <Ionicons name="time-outline" size={20} color={Colors.secondary} />
          </View>
          <View style={styles.navText}>
            <AppText style={styles.navTitle} color={colors.text}>{t("History")}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.navSubtitle}>
              {t("Pickups and reports timeline")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.navCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => void handleContactWasteTrack()}
          testID="profile-contact-wastetrack"
        >
          <View style={[styles.navIcon, { backgroundColor: Colors.primary + "12" }]}>
            <Ionicons name="logo-whatsapp" size={20} color={Colors.primary} />
          </View>
          <View style={styles.navText}>
            <AppText style={styles.navTitle} color={colors.text}>{t("Contact WasteTrack")}</AppText>
            <AppText variant="caption" color={colors.textSecondary} style={styles.navSubtitle} numberOfLines={2}>
              {t("Need help? Chat with WasteTrack support on WhatsApp.")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        {user.role === "resident" && (
          <View style={[styles.collectorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.collectorHeader}>
              <Ionicons name="leaf-outline" size={20} color={Colors.primary} />
              <AppText style={styles.collectorTitle} color={colors.text}>
                {t("Want to become a Waste Collector?")}
              </AppText>
            </View>
            <AppText style={styles.collectorText} color={colors.textSecondary}>
              {t("Join our team and help keep the city clean. Apply to become a certified collector.")}
            </AppText>
            <Pressable
              style={({ pressed }) => [
                styles.collectorButton,
                { backgroundColor: Colors.primary },
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleCollectorInterest}
            >
              <AppText color="#fff">{t("Apply now")}</AppText>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            { backgroundColor: Colors.error + "10" },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleLogout}
          testID="sign-out-btn"
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <AppText variant="button" color={Colors.error}>{t("Sign Out")}</AppText>
        </Pressable>
        <AppText style={styles.signatureText} color={colors.textSecondary}>
          {t("by De Kini Tambat all rights reserved")}
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingBottom: 30,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontFamily: fonts.bold },
  userName: { fontSize: 24, fontFamily: fonts.bold },
  userRole: { fontSize: fontSizes.md, marginTop: 4 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.xxl,
    marginTop: 20,
    gap: spacing.xxl,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 24, fontFamily: fonts.bold },
  statLabel: { fontSize: fontSizes.xs, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  content: { padding: 20, marginTop: 6 },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  guideBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md + 2,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  guideIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  guideText: { flex: 1 },
  guideTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  guideSubtitle: { marginTop: 2 },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md + 2,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  navIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  navText: { flex: 1 },
  navTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  navSubtitle: { marginTop: 2 },
  collectorCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    marginBottom: spacing.xxl,
  },
  collectorHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  collectorTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  collectorText: { fontSize: fontSizes.sm, fontFamily: fonts.regular },
  collectorButton: { marginTop: spacing.md, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  signatureText: { fontSize: 11, textAlign: "center", marginTop: 10 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 20, fontFamily: fonts.semibold, marginTop: spacing.lg },
  emptyText: { fontSize: fontSizes.md, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  signInButton: { paddingVertical: spacing.md + 2, paddingHorizontal: 32, borderRadius: radius.lg, marginTop: spacing.xxl },
});