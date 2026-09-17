import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

type Props = {
  visible: boolean;
  points: number;
  reason: string;
  totalPoints: number;
  onDismiss: () => void;
};

const formatReason = (reason: string): string => {
  const table: Record<string, string> = {
    pickup_participation: "Pickup completed",
    waste_report: "Community report",
    cleanup_verified: "Cleanup verified",
    bonus: "Bonus",
  };
  if (table[reason]) return table[reason];
  return reason
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export function RewardCelebrationModal({ visible, points, reason, totalPoints, onDismiss }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const sparkles = useMemo(
    () => [
      { top: 18, left: 24, size: 16, delay: 0 },
      { top: 34, right: 26, size: 20, delay: 80 },
      { bottom: 46, left: 40, size: 18, delay: 140 },
      { bottom: 30, right: 40, size: 16, delay: 220 },
      { top: 76, left: 62, size: 14, delay: 280 },
      { top: 92, right: 62, size: 14, delay: 340 },
    ],
    []
  );

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    scale.setValue(0.9);
    shimmer.setValue(0);

    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
    ]).start();

    return () => {
      opacity.stopAnimation();
      scale.stopAnimation();
      shimmer.stopAnimation();
    };
  }, [visible, opacity, scale, shimmer]);

  const reasonLabel = formatReason(reason);
  const shimmerRotate = shimmer.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Animated.View style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}>
          <LinearGradient
            colors={[Colors.accent, Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Animated.View style={[styles.shimmerRing, { transform: [{ rotate: shimmerRotate }] }]} />

            {sparkles.map((s, idx) => (
              <Animated.View
                key={idx}
                style={[
                  styles.sparkle,
                  { top: s.top, left: s.left, right: s.right, bottom: s.bottom, opacity },
                  { transform: [{ rotate: shimmerRotate }] },
                ]}
              >
                <Ionicons name="sparkles" size={s.size} color="rgba(255,255,255,0.92)" />
              </Animated.View>
            ))}

            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="star" size={22} color="#fff" />
              </View>
              <Text style={styles.title}>{t("Reward Unlocked")}</Text>
            </View>

            <Text style={styles.pointsText}>{t("+{points} points", { points })}</Text>
            <Text style={styles.reasonText}>{t(reasonLabel)}</Text>

            <View style={[styles.metaRow, { borderTopColor: "rgba(255,255,255,0.18)" }]}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t("Total")}</Text>
                <Text style={styles.metaValue}>{totalPoints}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t("Keep going")}</Text>
                <Text style={styles.metaValue}>{t("Next badge soon")}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: "rgba(255,255,255,0.92)" },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
              onPress={onDismiss}
            >
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={[styles.ctaText, { color: Colors.primary }]}>{t("Continue")}</Text>
            </Pressable>

            <Text style={[styles.footerHint, { color: "rgba(255,255,255,0.85)" }]}>
              {t("Tip: Locations are saved in words first; proof photos are optional.")}
            </Text>
          </LinearGradient>

          <View style={[styles.shadowPad, { backgroundColor: colors.background }]} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  cardWrap: { width: "100%", maxWidth: 420 },
  card: {
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
  },
  shimmerRing: {
    position: "absolute",
    top: -120,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  sparkle: { position: "absolute" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  pointsText: { fontSize: 44, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 10 },
  reasonText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.92)", marginTop: 2 },
  metaRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  metaValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginTop: 3 },
  metaDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.18)" },
  cta: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  footerHint: { marginTop: 10, fontSize: 12, fontFamily: "Inter_400Regular" },
  shadowPad: { height: 10, opacity: 0 },
});
