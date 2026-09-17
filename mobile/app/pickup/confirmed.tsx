import React, { useEffect, useMemo, useRef } from "react";
import { Alert, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";

const TIME_WINDOWS = [
  { value: "08:00", labelKey: "8 AM - 10 AM" },
  { value: "10:00", labelKey: "10 AM - 12 PM" },
  { value: "14:00", labelKey: "2 PM - 4 PM" },
];

const formatDisplayDate = (value?: string | null, locale?: string, fallbackLabel = ""): string => {
  if (!value) return fallbackLabel;
  const parts = value.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return value;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString(locale ?? undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDisplayTime = (
  value?: string | null,
  locale?: string,
  fallbackLabel = "",
  resolveLabel?: (value: string) => string | null
): string => {
  if (!value) return fallbackLabel;
  const slotLabel = resolveLabel?.(value);
  if (slotLabel) return slotLabel;
  const [hours, minutes] = value.split(":").map((p) => Number(p));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(locale ?? undefined, { hour: "2-digit", minute: "2-digit" });
};

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function PickupConfirmedScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { pickups } = useApp();
  const toast = useToast();
  const params = useLocalSearchParams();
  const hasNotified = useRef(false);
  const checkAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const locale = language === "fr" ? "fr-FR" : "en-US";

  const address = getParamValue(params.address) || t("Pickup address pending");
  const scheduledDate = getParamValue(params.scheduledDate);
  const scheduledTime = getParamValue(params.scheduledTime);

  const resolveTimeWindowLabel = useMemo(
    () => (value: string) => {
      const slot = TIME_WINDOWS.find((window) => window.value === value);
      return slot ? t(slot.labelKey) : null;
    },
    [t]
  );

  const dateLabel = useMemo(
    () =>
      `${formatDisplayDate(scheduledDate, locale, t("Date not set"))} - ${formatDisplayTime(
        scheduledTime,
        locale,
        t("Time not set"),
        resolveTimeWindowLabel
      )}`,
    [scheduledDate, scheduledTime, locale, resolveTimeWindowLabel, t]
  );

  const matchingPickup = useMemo(() => {
    if (!pickups || pickups.length === 0) return null;
    const matched = pickups.find(
      (pickup) =>
        pickup.address === address
        && pickup.scheduledDate === scheduledDate
        && pickup.scheduledTime === scheduledTime
    );
    return matched ?? pickups[0] ?? null;
  }, [pickups, address, scheduledDate, scheduledTime]);

  const assignedCollectorName = matchingPickup?.assignedCollectorName ?? null;
  const isCollectorAssigned = !!matchingPickup?.assignedCollectorId || !!assignedCollectorName;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(checkAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        delay: 60,
      }),
    ]).start();
  }, [checkAnim, contentAnim]);

  useEffect(() => {
    if (!isCollectorAssigned || hasNotified.current) return;
    hasNotified.current = true;
    toast.info(t("Collector assigned"), {
      message: t("{name} is ready. You can track when you're ready.", {
        name: assignedCollectorName ?? t("A collector"),
      }),
    });
  }, [assignedCollectorName, isCollectorAssigned, t, toast]);

  const handleTrackCollector = () => {
    if (!isCollectorAssigned) return;
    const routeParams = {
      address,
      scheduledDate,
      scheduledTime,
      wasteType: getParamValue(params.wasteType),
    };

    if (Platform.OS === "web") {
      router.push({ pathname: "/pickup/tracking", params: routeParams });
      return;
    }

    Alert.alert(
      t("Track collector?"),
      t("{name} has been assigned. Do you want to view live tracking now?", {
        name: assignedCollectorName ?? t("A collector"),
      }),
      [
        { text: t("Not now"), style: "cancel" },
        { text: t("Track"), onPress: () => router.push({ pathname: "/pickup/tracking", params: routeParams }) },
      ]
    );
  };

  const checkStyle = {
    opacity: checkAnim,
    transform: [
      {
        scale: checkAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };

  const contentStyle = {
    opacity: contentAnim,
    transform: [
      {
        translateY: contentAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 20, paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View pointerEvents="none" style={styles.bgGlowBottom} />
      <Animated.View style={[styles.checkWrap, checkStyle]}>
        <View style={[styles.checkCircle, { backgroundColor: Colors.success + "15" }]}>
          <Ionicons name="checkmark" size={28} color={Colors.success} />
        </View>
        <AppText variant="title" color={colors.text}>{t("Request Confirmed!")}</AppText>
        <AppText color={colors.textSecondary} center>
          {t("Your pickup request has been submitted.")}
        </AppText>
      </Animated.View>

      <Animated.View style={contentStyle}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: Colors.primary + "12" }]}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.infoTextWrap}>
              <AppText variant="label" style={styles.infoLabel} color={colors.textSecondary}>{t("Pickup address")}</AppText>
              <AppText style={styles.infoValue} color={colors.text}>{address}</AppText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: Colors.secondary + "12" }]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.secondary} />
            </View>
            <View style={styles.infoTextWrap}>
              <AppText variant="label" style={styles.infoLabel} color={colors.textSecondary}>{t("Pickup time")}</AppText>
              <AppText style={styles.infoValue} color={colors.text}>{dateLabel}</AppText>
            </View>
          </View>
        </View>

        {isCollectorAssigned ? (
          <View style={[styles.assignmentCard, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary }]}>
            <View style={styles.assignmentRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              <View style={styles.assignmentTextWrap}>
                <AppText style={styles.assignmentTitle} color={Colors.primary}>{t("Collector assigned")}</AppText>
                <AppText variant="caption" color={colors.textSecondary} style={styles.assignmentText}>
                  {t("{name} is ready. Track when you are ready.", {
                    name: assignedCollectorName ?? t("A collector"),
                  })}
                </AppText>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: Colors.primary },
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleTrackCollector}
            >
              <AppText variant="button" color="#fff">{t("Track Collector")}</AppText>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.assignmentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.assignmentRow}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <View style={styles.assignmentTextWrap}>
                <AppText style={styles.assignmentTitle} color={colors.text}>{t("Waiting for assignment")}</AppText>
                <AppText variant="caption" color={colors.textSecondary} style={styles.assignmentText}>
                  {t("We will notify you as soon as a nearby collector accepts your pickup request.")}
                </AppText>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.nextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText style={styles.nextTitle} color={colors.text}>{t("What happens next:")}</AppText>
          <AppText variant="caption" color={colors.textSecondary} style={styles.nextText}>
            {t("1. The app sends your request to the nearest available collector.")}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} style={styles.nextText}>
            {t("2. You get notified when a collector accepts.")}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} style={styles.nextText}>
            {t("3. You can track live pickup until completion.")}
          </AppText>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(13,150,104,0.07)",
  },
  checkWrap: { alignItems: "center", gap: spacing.sm, marginBottom: 20 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  infoCard: { borderRadius: radius.xxl, borderWidth: 1, padding: spacing.md + 2, gap: spacing.md, marginBottom: 18 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: { width: 36, height: 36, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  infoTextWrap: { flex: 1 },
  infoLabel: { letterSpacing: 0.4 },
  infoValue: { fontSize: fontSizes.md, fontFamily: fonts.semibold, marginTop: 4 },
  assignmentCard: { borderRadius: radius.xxl, borderWidth: 1, padding: spacing.md + 2, gap: spacing.md, marginBottom: 18 },
  assignmentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  assignmentTextWrap: { flex: 1 },
  assignmentTitle: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  assignmentText: { lineHeight: 18 },
  primaryButton: {
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  nextCard: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.md + 2, gap: 6 },
  nextTitle: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  nextText: { lineHeight: 18 },
});