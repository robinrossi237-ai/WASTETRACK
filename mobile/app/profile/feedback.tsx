import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import FloatingInput from "@/components/FloatingInput";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { apiRequest } from "@/lib/api-client";

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useApp();

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (rating < 1) {
      toast.error(t("Please select a rating."));
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSubmitting(true);
    try {
      await apiRequest<{ success: true }>("POST", "/resident/feedback", {
        rating,
        message: message.trim() || null,
      });
      toast.success(t("Thanks for the feedback!"));
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to send feedback"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BottomWhiteScent />
        <View style={styles.emptyState}>
          <Ionicons name="chatbox-ellipses-outline" size={64} color={colors.textSecondary} />
          <AppText variant="title" color={colors.text} center style={styles.emptyTitle}>
            {t("Sign in to leave feedback")}
          </AppText>
          <AppText center color={colors.textSecondary}>
            {t("Create an account to share your experience and rate the app.")}
          </AppText>
          <Button
            label={t("Sign In")}
            onPress={() => router.push("/(auth)/login")}
            style={styles.signInButton}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <BottomWhiteScent />
        <View style={styles.header}>
          <AppText variant="caption" color={colors.textSecondary} style={styles.subtitle}>
            {t("Help us improve WasteTrack with your thoughts.")}
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="label" color={colors.text}>
            {t("Your rating")}
          </AppText>
          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const value = idx + 1;
              const active = value <= rating;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  style={({ pressed }) => [styles.starButton, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons
                    name={active ? "star" : "star-outline"}
                    size={28}
                    color={active ? Colors.accent : colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>

          <FloatingInput
            label={t("Share your feedback")}
            value={message}
            onChange={setMessage}
            multiline
            numberOfLines={5}
            style={{ backgroundColor: colors.surfaceSecondary }}
          />
        </View>

        <View style={styles.actionsRow}>
          <Button
            label={isSubmitting ? t("Sending...") : t("Submit feedback")}
            leftIcon="send-outline"
            loading={isSubmitting}
            onPress={handleSubmit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  subtitle: { marginTop: 6 },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: 16,
    gap: spacing.md,
  },
  ratingRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  starButton: { padding: 4 },
  actionsRow: { paddingHorizontal: 20, marginTop: 18 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: { marginTop: 8 },
  signInButton: { marginTop: 16, paddingHorizontal: 32 },
});