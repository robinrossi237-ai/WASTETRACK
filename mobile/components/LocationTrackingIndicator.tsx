import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";

type Props = {
  visible: boolean;
  variants?: string[];
  label?: string;
  onCancel?: () => void;
  overlay?: boolean;
};

export default function LocationTrackingIndicator({
  visible,
  variants = [],
  label,
  onCancel,
  overlay = false,
}: Props) {
  const { colors } = useTheme();
  const [reduced, setReduced] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [variantIndex, setVariantIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    setVariantIndex(0);
    const interval = setInterval(() => {
      setVariantIndex((index) => (variants.length > 1 ? (index + 1) % variants.length : 0));
    }, reduced ? 0 : 2200);
    return () => clearInterval(interval);
  }, [variants, reduced, visible]);

  useEffect(() => {
    if (!visible) return;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: reduced ? 0 : 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: reduced ? 0 : 1500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced, visible]);

  useEffect(() => {
    if (!visible) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: reduced ? 0 : 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, spin, visible]);

  if (!visible) return null;

  const gyro = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const message = variants[variantIndex] || label || "Locating…";

  return (
    <View
      pointerEvents={onCancel ? "box-none" : "none"}
      style={[styles.wrap, overlay && styles.wrapOverlay]}
    >
      <Animated.View style={[styles.ripple, { borderColor: Colors.primary }] as never}>
        <Animated.View
          style={[
            styles.rippleInner,
            { opacity, transform: [{ scale }] },
          ] as never}
        />
      </Animated.View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.ring}>
          <Animated.View
            style={[styles.ringIcon, { transform: [{ rotate: gyro }] }] as never}
          >
            <Ionicons name="navigate" size={20} color={Colors.primary} />
          </Animated.View>
          <Animated.View style={[styles.dot, { transform: [{ scale: dotScale }] }] as never} />
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {message}
          </Text>
          {variants.length > 1 ? (
            <View style={styles.dots}>
              {variants.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dotIndicator,
                    {
                      backgroundColor: index === variantIndex ? Colors.primary : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        {onCancel ? (
          <Pressable
            onPress={onCancel}
            hitSlop={8}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 92,
  },
  wrapOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 50,
  },
  ripple: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rippleInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primary,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    maxWidth: 320,
  },
  ring: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "18",
  },
  ringIcon: {},
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  textWrap: { flex: 1, gap: 6 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dots: { flexDirection: "row", gap: 5 },
  dotIndicator: { width: 6, height: 6, borderRadius: 3 },
  cancel: { padding: 4 },
});
