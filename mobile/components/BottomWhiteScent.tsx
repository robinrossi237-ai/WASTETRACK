import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "@/lib/theme-context";

type BottomWhiteScentProps = {
  style?: ViewStyle;
};

export default function BottomWhiteScent({ style }: BottomWhiteScentProps) {
  const { isDark } = useTheme();

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <View
        style={[
          styles.glowLarge,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.85)",
          },
        ]}
      />
      <View
        style={[
          styles.glowSmall,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(255,255,255,0.62)",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: -90,
    right: -90,
    bottom: -170,
    height: 280,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  glowLarge: {
    position: "absolute",
    bottom: 0,
    width: 420,
    height: 240,
    borderRadius: 220,
  },
  glowSmall: {
    position: "absolute",
    bottom: 42,
    width: 260,
    height: 150,
    borderRadius: 140,
  },
});
