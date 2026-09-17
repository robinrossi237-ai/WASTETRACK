import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

export default function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const resolvedRetryLabel = retryLabel ?? t("Try again");

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: Colors.error + "66" }]}>
      <View style={[styles.iconWrap, { backgroundColor: Colors.error + "1A" }]}>
        <Ionicons name="warning-outline" size={22} color={Colors.error} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            { borderColor: Colors.error },
            pressed && { opacity: 0.9 },
          ]}
          onPress={onRetry}
        >
          <Ionicons name="refresh-outline" size={16} color={Colors.error} />
          <Text style={[styles.retryText, { color: Colors.error }]}>{resolvedRetryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  retryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
