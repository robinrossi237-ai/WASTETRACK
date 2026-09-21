import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import FloatingInput from "@/components/FloatingInput";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { radius, spacing } from "@/constants/theme";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, apiRequest } from "@/lib/api-client";

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword) {
      toast.error(t("Please enter your current password."));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("New password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("New passwords do not match."));
      return;
    }
    if (currentPassword === newPassword) {
      toast.error(t("New password must be different from the current one."));
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest<{ success: true }>("PATCH", "/auth/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(t("Password changed successfully."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CURRENT_PASSWORD") {
        toast.error(t("Current password is incorrect."));
        return;
      }
      toast.error(err instanceof Error ? err.message : t("Could not change password. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BottomWhiteScent />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <AppText variant="title" color={colors.text}>
          {t("Change password")}
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FloatingInput
            label={t("Current password")}
            value={currentPassword}
            onChange={setCurrentPassword}
            type="password"
            icon="lock-closed-outline"
            returnKeyType="next"
          />
          <FloatingInput
            label={t("New password (min. 8 characters)")}
            value={newPassword}
            onChange={setNewPassword}
            type="password"
            icon="lock-closed-outline"
            returnKeyType="next"
          />
          <FloatingInput
            label={t("Confirm new password")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            icon="lock-closed-outline"
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
          />
        </View>

        <Button
          label={t("Change password")}
          onPress={() => void handleSubmit()}
          loading={isSubmitting}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 20, width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
});
