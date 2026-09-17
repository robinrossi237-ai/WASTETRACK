import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Platform,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { summarizeLocationArea } from "@/lib/location-label";
import { useResidentTabSwipe } from "@/lib/use-resident-tab-swipe";
import { useTheme } from "@/lib/theme-context";
import { BADGES } from "@/lib/types";
import { apiRequest } from "@/lib/api-client";

type LeaderboardEntry = {
  user_id: string;
  name: string;
  neighborhood: string | null;
  points: number;
};

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const swipeHandlers = useResidentTabSwipe("rewards");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const rewardsArea = summarizeLocationArea(user?.neighborhood);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) return;
      setIsLoadingLeaderboard(true);

      try {
        const qs = rewardsArea
          ? `?limit=5&area=${encodeURIComponent(rewardsArea)}`
          : `?limit=5`;
        const data = await apiRequest<{ success: true; leaderboard: LeaderboardEntry[] }>(
          "GET",
          `/leaderboard${qs}`,
        );
        if (!cancelled) {
          setLeaderboard(data.leaderboard);
        }
      } catch {
        if (!cancelled) {
          setLeaderboard([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLeaderboard(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [user, user?.id, rewardsArea]);

  const getNextBadge = () => {
    if (!user) return null;
    const nextBadges = BADGES.filter(b =>
      b.pointsRequired > user.points && !user.badges.includes(b.id)
    ).sort((a, b) => a.pointsRequired - b.pointsRequired);
    return nextBadges[0];
  };

  const nextBadge = getNextBadge();

  if (!user) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        {...swipeHandlers}
      >
        <BottomWhiteScent />
        <View style={[styles.emptyState, { paddingTop: insets.top + webTopInset + 40 }]}>
          <Ionicons name="star-outline" size={64} color={colors.textSecondary} />
          <AppText style={styles.emptyTitle} color={colors.text}>{t("Sign in to earn rewards")}</AppText>
          <AppText style={styles.emptyText} color={colors.textSecondary}>
            {t("Create an account to start earning points and badges for your eco-friendly actions.")}
          </AppText>
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push("/(auth)/login")}
            testID="rewards-sign-in-btn"
          >
            <AppText variant="button" color="#fff">{t("Sign In")}</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeHandlers}
    >
      <BottomWhiteScent />
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 20 }]}>
        <AppText variant="title" style={styles.title} color={colors.text}>{t("Rewards")}</AppText>
      </View>

      <LinearGradient
        colors={[Colors.accent, "#F97316"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pointsCard}
      >
        <View style={styles.pointsContent}>
          <Ionicons name="star" size={32} color="#fff" />
          <AppText style={styles.pointsLabel} color="rgba(255,255,255,0.9)">{t("Your Points")}</AppText>
          <AppText style={styles.pointsValue} color="#fff">{user.points}</AppText>
        </View>
        {nextBadge && (
          <View style={styles.progressSection}>
            <AppText style={styles.progressLabel} color="rgba(255,255,255,0.8)" center>
              {t("{points} points to {badge}", {
                points: nextBadge.pointsRequired - user.points,
                badge: t(nextBadge.name),
              })}
            </AppText>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((user.points / nextBadge.pointsRequired) * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <AppText style={styles.sectionTitle} color={colors.text}>{t("Your Badges")}</AppText>
          <View style={styles.badgesGrid}>
            {BADGES.map(badge => {
              const isEarned = user.badges.includes(badge.id) ||
                (badge.pointsRequired > 0 && user.points >= badge.pointsRequired);

              return (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    { backgroundColor: colors.surface },
                    !isEarned && styles.badgeLocked,
                  ]}
                >
                  <View
                    style={[
                      styles.badgeIcon,
                      { backgroundColor: isEarned ? Colors.primary + '20' : colors.surfaceSecondary },
                    ]}
                  >
                    <Ionicons
                      name={badge.icon as any}
                      size={28}
                      color={isEarned ? Colors.primary : colors.textSecondary}
                    />
                  </View>
                  <AppText
                    style={styles.badgeName}
                    color={isEarned ? colors.text : colors.textSecondary}
                    numberOfLines={1}
                  >
                    {t(badge.name)}
                  </AppText>
                  <AppText color={colors.textSecondary} style={styles.badgeDesc} numberOfLines={2}>
                    {t(badge.description)}
                  </AppText>
                  {!isEarned && badge.pointsRequired > 0 && (
                    <View style={[styles.pointsNeeded, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="star" size={10} color={Colors.accent} />
                      <AppText color={colors.textSecondary} style={styles.pointsNeededText}>
                        {badge.pointsRequired}
                      </AppText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle} color={colors.text}>
            {rewardsArea
              ? t("{area} Leaderboard", { area: rewardsArea })
              : t("Leaderboard")}
          </AppText>
          <View style={[styles.leaderboardCard, { backgroundColor: colors.surface }]}>
            {isLoadingLeaderboard ? (
              <View style={styles.emptyLeaderboard}>
                <AppText color={colors.textSecondary} style={styles.emptyLeaderboardText}>
                  {t("Loading leaderboard...")}
                </AppText>
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyLeaderboard}>
                <AppText color={colors.textSecondary} style={styles.emptyLeaderboardText}>
                  {t("No leaderboard data yet.")}
                </AppText>
              </View>
            ) : (
              leaderboard.map((entry, index) => (
                <View
                  key={entry.user_id}
                  style={[
                    styles.leaderRow,
                    index < leaderboard.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={styles.rankBadge}>
                    {index === 0 && <Ionicons name="trophy" size={20} color="#FFD700" />}
                    {index === 1 && <Ionicons name="trophy" size={20} color="#C0C0C0" />}
                    {index === 2 && <Ionicons name="trophy" size={20} color="#CD7F32" />}
                    {index > 2 && (
                      <AppText color={colors.textSecondary} style={styles.rankNumber}>{index + 1}</AppText>
                    )}
                  </View>
                  <View style={styles.leaderInfo}>
                    <AppText style={styles.leaderName} color={colors.text}>{entry.name}</AppText>
                    <AppText color={colors.textSecondary} style={styles.leaderNeighborhood}>
                      {summarizeLocationArea(entry.neighborhood) || "-"}
                    </AppText>
                  </View>
                  <View style={styles.leaderPoints}>
                    <Ionicons name="star" size={14} color={Colors.accent} />
                    <AppText style={styles.leaderPointsText} color={colors.text}>{entry.points}</AppText>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={[styles.earnMoreCard, { backgroundColor: Colors.primary + '10' }]}>
          <Ionicons name="bulb" size={24} color={Colors.primary} />
          <View style={styles.earnMoreContent}>
            <AppText style={styles.earnMoreTitle} color={Colors.primary}>{t("Earn More Points")}</AppText>
            <AppText color={colors.text} style={styles.earnMoreText}>
              {t("Completed pickups (+10), report issues (+15), participate in cleanups (+50)")}
            </AppText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.bold },
  pointsCard: { marginHorizontal: spacing.xl, borderRadius: radius.xxl, padding: spacing.xxl, marginBottom: 18 },
  scrollArea: { flex: 1 },
  pointsContent: { alignItems: "center" },
  pointsLabel: { fontSize: fontSizes.md, fontFamily: fonts.medium, marginTop: spacing.sm },
  pointsValue: { fontSize: fontSizes.hero + 20, fontFamily: fonts.bold, color: "#fff", marginTop: spacing.xs },
  progressSection: { marginTop: spacing.xl },
  progressLabel: { fontSize: fontSizes.xs, fontFamily: fonts.medium, textAlign: "center", marginBottom: spacing.sm },
  progressBar: { height: 6, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 3 },
  section: { paddingHorizontal: spacing.xl, marginBottom: spacing.xxl },
  sectionTitle: { fontSize: fontSizes.title - 2, fontFamily: fonts.semibold, marginBottom: spacing.md },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: {
    width: "48%", padding: spacing.md + 2, borderRadius: radius.xl, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  badgeName: { fontSize: fontSizes.md, fontFamily: fonts.semibold, textAlign: "center" },
  badgeDesc: { fontSize: fontSizes.xs - 1, fontFamily: fonts.regular, textAlign: "center", marginTop: spacing.xs, lineHeight: 14 },
  pointsNeeded: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 10, marginTop: spacing.sm },
  pointsNeededText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.medium },
  leaderboardCard: {
    borderRadius: radius.xl, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  emptyLeaderboard: { padding: spacing.md + 2, alignItems: "center" },
  emptyLeaderboardText: { fontSize: fontSizes.xs, fontFamily: fonts.medium },
  leaderRow: { flexDirection: "row", alignItems: "center", padding: spacing.md + 2 },
  rankBadge: { width: 32, alignItems: "center" },
  rankNumber: { fontSize: fontSizes.button, fontFamily: fonts.semibold },
  leaderInfo: { flex: 1, marginLeft: spacing.md },
  leaderName: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  leaderNeighborhood: { fontSize: fontSizes.xs, fontFamily: fonts.regular },
  leaderPoints: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  leaderPointsText: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  earnMoreCard: { flexDirection: "row", alignItems: "center", margin: spacing.xl, padding: spacing.lg, borderRadius: radius.xl, gap: spacing.md },
  earnMoreContent: { flex: 1 },
  earnMoreTitle: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  earnMoreText: { fontSize: fontSizes.xs, fontFamily: fonts.regular, marginTop: 2 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl },
  emptyTitle: { fontSize: fontSizes.title, fontFamily: fonts.semibold, marginTop: spacing.lg },
  emptyText: { fontSize: fontSizes.md, fontFamily: fonts.regular, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  signInButton: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xxxl, borderRadius: radius.lg, marginTop: spacing.xxl },
});