import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Redirect, useIsFocused } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { PushEnableBanner } from "@/components/PushEnableBanner";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";

type NotificationCategory = "pickup" | "rewards";

type NotificationItem = {
  id: string;
  user_id: string;
  message: string;
  category?: NotificationCategory;
  is_read: boolean;
  created_at: string;
};

type CategoryFilter = "all" | NotificationCategory;
type NotificationEvent = "pickup_confirmed" | "collector_arriving" | "reward_earned";
type EventFilter = "all_events" | NotificationEvent;

const getCategoryLabels = (t: (key: string) => string): Record<CategoryFilter, string> => ({
  all: t("All"),
  pickup: t("Pickup"),
  rewards: t("Rewards"),
});

const getEventLabels = (t: (key: string) => string): Record<EventFilter, string> => ({
  all_events: t("All events"),
  pickup_confirmed: t("Pickup confirmed"),
  collector_arriving: t("Collector arriving"),
  reward_earned: t("Reward earned"),
});

const normalizeCategory = (value?: string): NotificationCategory => {
  if (value === "rewards") {
    return value;
  }
  return "pickup";
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const categoryColor = (category: NotificationCategory) => {
  switch (category) {
    case "rewards":
      return Colors.success;
    default:
      return Colors.primary;
  }
};

const inferNotificationEvent = (item: NotificationItem): NotificationEvent | null => {
  const message = item.message.toLowerCase();
  const category = normalizeCategory(item.category);

  if (
    category === "rewards" ||
    message.includes("reward") ||
    message.includes("point") ||
    message.includes("recompense")
  ) {
    return "reward_earned";
  }

  if (
    message.includes("arriv") ||
    message.includes("in progress") ||
    message.includes("on the way") ||
    message.includes("nearby") ||
    message.includes("en cours") ||
    message.includes("en route") ||
    message.includes("proche")
  ) {
    return "collector_arriving";
  }

  if (
    (message.includes("pickup") || message.includes("collecte")) &&
    (
      message.includes("confirm") ||
      message.includes("approved") ||
      message.includes("assigned") ||
      message.includes("approuve") ||
      message.includes("assigne")
    )
  ) {
    return "pickup_confirmed";
  }

  return null;
};

export default function NotificationCenterScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const isFocused = useIsFocused();
  const toast = useToast();
  const { user } = useApp();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all_events");
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);
  const categoryLabels = useMemo(() => getCategoryLabels(t), [t]);
  const eventLabels = useMemo(() => getEventLabels(t), [t]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ success: true; notifications: NotificationItem[] }>("GET", "/notifications");
      const normalized = data.notifications.map((item) => ({
        ...item,
        category: normalizeCategory(item.category),
      }));
      setItems(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to load notifications");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const { id: userId } = user ?? {};

  useEffect(() => {
    if (!userId) return;
    void loadNotifications();
  }, [userId, loadNotifications]);

  useRealtimeRefresh({
    enabled: !!user && isFocused,
    onRefresh: loadNotifications,
    pollMs: 30_000,
    eventTypes: [
      "notification.created",
      "notification.read",
      "pickup.updated",
      "reward.updated",
      "report.updated",
    ],
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemCategory = normalizeCategory(item.category);
      if (categoryFilter !== "all" && itemCategory !== categoryFilter) return false;
      const eventType = inferNotificationEvent(item);
      if (eventFilter !== "all_events" && eventType !== eventFilter) return false;
      if (showUnreadOnly && item.is_read) return false;
      return true;
    });
  }, [items, categoryFilter, eventFilter, showUnreadOnly]);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);
  const countByCategory = useMemo(() => {
    return {
      pickup: items.filter((item) => normalizeCategory(item.category) === "pickup").length,
      rewards: items.filter((item) => normalizeCategory(item.category) === "rewards").length,
    };
  }, [items]);

  const countByEvent = useMemo(() => {
    return {
      pickup_confirmed: items.filter((item) => inferNotificationEvent(item) === "pickup_confirmed").length,
      collector_arriving: items.filter((item) => inferNotificationEvent(item) === "collector_arriving").length,
      reward_earned: items.filter((item) => inferNotificationEvent(item) === "reward_earned").length,
    };
  }, [items]);

  const markRead = async (notificationId: string) => {
    try {
      await apiRequest<{ success: true }>("POST", `/notifications/${notificationId}/read`);
      setItems((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to mark as read");
      toast.error(message);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest<{ success: true; updated: number }>("POST", "/notifications/read-all");
      setItems((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
      toast.success(t("All notifications marked as read"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to mark all as read");
      toast.error(message);
    }
  };

  if (!user) {
    return <Redirect href="/(public)/get-started" />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadNotifications} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <AppText variant="caption" color={colors.textSecondary} style={styles.subtitle}>
          {t("Track updates by category and mark read states.")}
        </AppText>
      </View>

      <View style={styles.bannerWrap}>
        <PushEnableBanner />
      </View>

      <View style={styles.content}>
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statCell}>
            <AppText variant="caption" color={colors.textSecondary} style={styles.statLabel}>
              {t("Unread")}
            </AppText>
            <AppText color={colors.text} style={styles.statValue}>
              {unreadCount}
            </AppText>
          </View>
          <View style={styles.statCell}>
            <AppText variant="caption" color={colors.textSecondary} style={styles.statLabel}>
              {t("Pickup")}
            </AppText>
            <AppText color={colors.text} style={styles.statValue}>
              {countByCategory.pickup}
            </AppText>
          </View>
          <View style={styles.statCell}>
            <AppText variant="caption" color={colors.textSecondary} style={styles.statLabel}>
              {t("Rewards")}
            </AppText>
            <AppText color={colors.text} style={styles.statValue}>
              {countByCategory.rewards}
            </AppText>
          </View>
        </View>

        {unreadCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.markAllButton,
              { backgroundColor: Colors.primary + "12", borderColor: Colors.primary },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => void markAllRead()}
          >
            <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
            <AppText variant="label" color={Colors.primary}>
              {t("Mark all as read")}
            </AppText>
          </Pressable>
        )}

        <View style={styles.filterRow}>
          {(Object.keys(categoryLabels) as CategoryFilter[]).map((category) => {
            const isActive = categoryFilter === category;
            return (
              <Pressable
                key={category}
                style={[
                  styles.filterChip,
                  {
                    borderColor: isActive ? Colors.primary : colors.border,
                    backgroundColor: isActive ? Colors.primary + "14" : colors.surface,
                  },
                ]}
                onPress={() => setCategoryFilter(category)}
              >
                <AppText variant="label" style={styles.filterChipText} color={isActive ? Colors.primary : colors.textSecondary}>
                  {categoryLabels[category]}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[
            styles.unreadChip,
            {
              borderColor: showUnreadOnly ? Colors.primary : colors.border,
              backgroundColor: showUnreadOnly ? Colors.primary + "14" : colors.surface,
            },
          ]}
          onPress={() => setShowUnreadOnly((prev) => !prev)}
        >
          <Ionicons
            name={showUnreadOnly ? "checkbox" : "square-outline"}
            size={16}
            color={showUnreadOnly ? Colors.primary : colors.textSecondary}
          />
          <AppText variant="label" style={styles.unreadChipText} color={showUnreadOnly ? Colors.primary : colors.textSecondary}>
            {t("Unread only")}
          </AppText>
        </Pressable>

        <View style={styles.eventRow}>
          {(Object.keys(eventLabels) as EventFilter[]).map((eventKey) => {
            const isActive = eventFilter === eventKey;
            const count =
              eventKey === "all_events"
                ? items.length
                : countByEvent[eventKey as keyof typeof countByEvent];
            return (
              <Pressable
                key={eventKey}
                style={[
                  styles.eventChip,
                  {
                    borderColor: isActive ? Colors.secondary : colors.border,
                    backgroundColor: isActive ? Colors.secondary + "15" : colors.surface,
                  },
                ]}
                onPress={() => setEventFilter(eventKey)}
              >
                <AppText variant="caption" style={styles.eventChipText} color={isActive ? Colors.secondary : colors.textSecondary}>
                  {eventLabels[eventKey]}
                </AppText>
                <AppText variant="caption" style={styles.eventChipCount} color={isActive ? Colors.secondary : colors.textSecondary}>
                  {count}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {filteredItems.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={26} color={colors.textSecondary} />
            <AppText variant="caption" color={colors.textSecondary} style={styles.emptyText}>
              {t("No notifications match this filter.")}
            </AppText>
          </View>
        ) : (
          filteredItems.map((item) => {
            const category = normalizeCategory(item.category);
            const tint = categoryColor(category);
            return (
              <View key={item.id} style={[styles.notificationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.notificationHeader}>
                  <View style={[styles.categoryPill, { backgroundColor: tint + "16", borderColor: tint + "40" }]}>
                    <AppText variant="caption" style={styles.categoryPillText} color={tint}>
                      {categoryLabels[category]}
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {formatTimestamp(item.created_at)}
                  </AppText>
                </View>
                <AppText color={colors.text} style={styles.message}>
                  {item.message}
                </AppText>
                <View style={styles.notificationFooter}>
                  <AppText variant="caption" style={styles.readState} color={item.is_read ? colors.textSecondary : Colors.primary}>
                    {item.is_read ? t("Read") : t("Unread")}
                  </AppText>
                  {!item.is_read ? (
                    <Pressable style={styles.readButton} onPress={() => void markRead(item.id)}>
                      <Ionicons name="checkmark-done-outline" size={16} color={Colors.primary} />
                      <AppText variant="label" style={styles.readButtonText} color={Colors.primary}>
                        {t("Mark read")}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: spacing.md },
  subtitle: { marginTop: 6 },
  bannerWrap: { paddingHorizontal: 20, paddingBottom: spacing.md },
  content: { paddingHorizontal: 20, gap: 10 },
  statsCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCell: { minWidth: 62 },
  statLabel: { fontFamily: fonts.medium },
  statValue: { fontSize: fontSizes.button, fontFamily: fonts.bold, marginTop: 2 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filterChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7 },
  filterChipText: { fontSize: fontSizes.xs },
  unreadChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  unreadChipText: { fontSize: fontSizes.xs },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  eventRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  eventChip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventChipText: { fontFamily: fonts.semibold },
  eventChipCount: { fontFamily: fonts.bold },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  emptyText: { fontSize: fontSizes.sm },
  notificationCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 10,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  categoryPill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  categoryPillText: { fontFamily: fonts.semibold },
  message: { fontSize: fontSizes.md, fontFamily: fonts.medium, lineHeight: 20 },
  notificationFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  readState: { fontFamily: fonts.semibold },
  readButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  readButtonText: { fontSize: fontSizes.xs },
});