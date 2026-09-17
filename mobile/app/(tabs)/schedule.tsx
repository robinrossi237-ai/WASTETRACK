import React, { useState, useMemo } from "react";
import {
  Alert,
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import ReschedulePickupModal from "@/components/ReschedulePickupModal";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useResidentTabSwipe } from "@/lib/use-resident-tab-swipe";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { WASTE_TYPES, WasteType, PickupRequest } from "@/lib/types";

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user, pickups, reschedulePickup, cancelPickup } = useApp();
  const toast = useToast();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    pickupId: string;
    date: string;
    time: string;
  } | null>(null);
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const swipeHandlers = useResidentTabSwipe("schedule");
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const shortDays = useMemo(
    () => [t("Sun"), t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat")],
    [t]
  );
  const fullDays = useMemo(
    () => [t("Sunday"), t("Monday"), t("Tuesday"), t("Wednesday"), t("Thursday"), t("Friday"), t("Saturday")],
    [t]
  );

  const weekDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      return date;
    });
  }, []);

  const selectedDate = useMemo(
    () => weekDates[selectedIndex] ?? weekDates[0] ?? new Date(),
    [selectedIndex, weekDates]
  );
  const selectedDayOfWeek = selectedDate.getDay();

  const parsePickupDate = (pickup: PickupRequest): Date | null => {
    if (pickup.scheduledAt) {
      const parsed = new Date(pickup.scheduledAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    if (pickup.scheduledDate) {
      const parsed = new Date(pickup.scheduledDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  };

  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

  const pickupsForSelectedDay = useMemo(() => {
    return pickups
      .filter(
        (pickup) =>
          pickup.status !== 'cancelled' && pickup.status !== 'completed' && pickup.status !== 'overdue'
      )
      .map((pickup) => {
        const date = parsePickupDate(pickup);
        return date ? { pickup, date } : null;
      })
      .filter((item): item is { pickup: PickupRequest; date: Date } => item !== null)
      .filter((item) => isSameDay(item.date, selectedDate))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [pickups, selectedDate]);

  const getWasteInfo = (type: WasteType) => {
    return WASTE_TYPES.find(w => w.type === type);
  };

  const handleDaySelect = async (index: number) => {
    if (Platform.OS !== "web") {
      await Haptics.selectionAsync();
    }
    setSelectedIndex(index);
  };

  const handleConfirmCancel = (pickupId: string) => {
    Alert.alert(
      t("Cancel pickup request?"),
      t("This will cancel your pickup request."),
      [
        { text: t("Keep"), style: "cancel" },
        {
          text: t("Cancel pickup"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await cancelPickup(pickupId);
                toast.success(t("Pickup cancelled"));
              } catch (err) {
                const message = err instanceof Error ? err.message : t("Failed to cancel pickup");
                toast.error(message);
              }
            })();
          },
        },
      ]
    );
  };

  const handleSaveReschedule = async (payload: { date: string; time: string; iso: string }) => {
    if (!rescheduleTarget) return;
    try {
      await reschedulePickup(rescheduleTarget.pickupId, payload.iso);
      toast.success(t("Pickup rescheduled"));
      setRescheduleTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to reschedule pickup");
      toast.error(message);
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
          <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
          <AppText style={styles.emptyTitle} color={colors.text}>{t("Sign in to view schedule")}</AppText>
          <AppText style={styles.emptyText} color={colors.textSecondary}>
            {t("Create an account to see collection schedules for your neighborhood.")}
          </AppText>
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push("/(auth)/login")}
            testID="schedule-sign-in-btn"
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
        <AppText variant="title" style={styles.title} color={colors.text}>{t("Collection Schedule")}</AppText>
        <AppText color={colors.textSecondary} style={styles.subtitle}>
          {user.neighborhood ?? t("Your area")}
        </AppText>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 132 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.weekContainer}>
          {weekDates.map((date, index) => {
            const dayOfWeek = date.getDay();
            const isToday = index === 0;
            const isSelected = index === selectedIndex;
            const hasPickup = pickups.some((pickup) => {
              if (
                pickup.status === 'cancelled'
                || pickup.status === 'completed'
                || pickup.status === 'overdue'
              ) {
                return false;
              }
              const scheduled = parsePickupDate(pickup);
              return scheduled ? isSameDay(scheduled, date) : false;
            });

            return (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.dayCard,
                  { backgroundColor: colors.surface },
                  isSelected && { backgroundColor: Colors.primary },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
                ]}
                onPress={() => handleDaySelect(index)}
              >
                <AppText
                  style={styles.dayName}
                  color={isSelected ? "#fff" : colors.textSecondary}
                >
                  {shortDays[dayOfWeek]}
                </AppText>
                <AppText
                  style={styles.dayNumber}
                  color={isSelected ? "#fff" : colors.text}
                >
                  {date.getDate()}
                </AppText>
                <AppText
                  style={styles.dayMeta}
                  color={isSelected ? "#fff" : colors.textSecondary}
                >
                  {isToday
                    ? t("Today")
                    : date.toLocaleDateString(locale, { month: "short" })}
                </AppText>
                {hasPickup && (
                  <View
                    style={[
                      styles.dayDot,
                      { backgroundColor: isSelected ? '#fff' : Colors.primary },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.content}>
          <AppText style={styles.sectionTitle} color={colors.text}>
            {selectedIndex === 0
              ? t("Today's Collections")
              : t("Collections for {day}", { day: fullDays[selectedDayOfWeek] })}
          </AppText>
          <AppText color={colors.textSecondary} style={styles.sectionDate}>
            {selectedDate.toLocaleDateString(locale, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </AppText>

          {pickupsForSelectedDay.length > 0 ? (
            pickupsForSelectedDay.map(({ pickup, date }) => {
              const wasteInfo = getWasteInfo(pickup.wasteType);
              const timeLabel =
                pickup.scheduledTime
                  ? pickup.scheduledTime
                  : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              return (
                <View key={pickup.id} style={[styles.scheduleCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.wasteIcon, { backgroundColor: wasteInfo?.color + "20" }]}>
                    <Ionicons name={wasteInfo?.icon as any} size={28} color={wasteInfo?.color} />
                  </View>
                  <View style={styles.scheduleInfo}>
                    <AppText style={styles.wasteType} color={colors.text}>
                      {wasteInfo?.label ? t(wasteInfo.label) : ""}
                    </AppText>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <AppText color={colors.textSecondary} style={styles.timeText}>
                        {timeLabel}
                      </AppText>
                    </View>
                  </View>
                  <View style={[styles.reminderBadge, { backgroundColor: Colors.primary + '10' }]}>
                    <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() =>
                        setRescheduleTarget({
                          pickupId: pickup.id,
                          date: pickup.scheduledDate,
                          time: pickup.scheduledTime || "09:00",
                        })
                      }
                    >
                      <AppText color={Colors.error} style={styles.cardActionLink}>{t("Reschedule")}</AppText>
                    </Pressable>
                    <Pressable onPress={() => handleConfirmCancel(pickup.id)}>
                      <AppText color={Colors.error} style={styles.cardActionLink}>{t("Cancel")}</AppText>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={[styles.noPickupCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
              <AppText style={styles.noPickupTitle} color={colors.text}>{t("No collections")}</AppText>
              <AppText color={colors.textSecondary} style={styles.noPickupText}>
                {t("No scheduled pickups for this day")}
              </AppText>
            </View>
          )}

          <View style={styles.legendSection}>
            <AppText style={styles.legendTitle} color={colors.text}>{t("Waste Types")}</AppText>
            <View style={styles.legendGrid}>
              {WASTE_TYPES.map(waste => (
                <View key={waste.type} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: waste.color }]} />
                  <AppText color={colors.textSecondary} style={styles.legendText}>{t(waste.label)}</AppText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <ReschedulePickupModal
        visible={!!rescheduleTarget}
        initialDate={rescheduleTarget?.date}
        initialTime={rescheduleTarget?.time}
        onClose={() => setRescheduleTarget(null)}
        onSave={handleSaveReschedule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.bold,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    marginTop: spacing.xs,
  },
  weekContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  dayCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  dayName: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.medium,
    marginBottom: spacing.xs,
  },
  dayNumber: {
    fontSize: 18,
    fontFamily: fonts.semibold,
  },
  dayMeta: {
    fontSize: fontSizes.xs - 2,
    fontFamily: fonts.medium,
    marginTop: 2,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  content: {
    padding: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSizes.title - 2,
    fontFamily: fonts.semibold,
    marginBottom: spacing.lg,
  },
  sectionDate: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm + 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  wasteIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: spacing.md + 2,
  },
  wasteType: {
    fontSize: fontSizes.button,
    fontFamily: fonts.semibold,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
  },
  reminderBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md + 2,
    marginTop: spacing.md,
    paddingRight: 2,
  },
  cardActionLink: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.semibold,
  },
  noPickupCard: {
    alignItems: "center",
    padding: spacing.xxxl,
    borderRadius: radius.xxl,
  },
  noPickupTitle: {
    fontSize: fontSizes.title - 2,
    fontFamily: fonts.semibold,
    marginTop: spacing.md,
  },
  noPickupText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    marginTop: spacing.xs,
  },
  legendSection: {
    marginTop: spacing.xxl,
  },
  legendTitle: {
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
    marginBottom: spacing.md,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSizes.title,
    fontFamily: fonts.semibold,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  signInButton: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xxxl, borderRadius: radius.lg, marginTop: spacing.xxl },
});