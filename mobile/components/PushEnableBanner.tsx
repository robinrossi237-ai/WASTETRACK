import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

import { AppText } from "@/components/ui/AppText";
import Colors from "@/constants/colors";
import { radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import * as storage from "@/lib/storage";
import { registerPushTokenWithBackend } from "@/lib/push-notifications";

const isUnsupportedRuntime = (): boolean =>
  Platform.OS === "web" || Constants.appOwnership === "expo";

export function PushEnableBanner() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useApp();

  const [visible, setVisible] = useState<boolean>(false);
  const [isWorking, setIsWorking] = useState<boolean>(false);

  const refreshVisibility = useCallback(async () => {
    if (!user || isUnsupportedRuntime()) {
      setVisible(false);
      return;
    }
    try {
      const [enabled, token] = await Promise.all([
        storage.getPushEnabled(user.id),
        storage.getPushToken(),
      ]);
      setVisible(!enabled || !token);
    } catch {
      setVisible(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshVisibility();
    }, [refreshVisibility])
  );

  const openSystemSettings = useCallback(() => {
    Alert.alert(t("Permission needed"), t("Allow notifications in system settings to receive pickup updates."), [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Open Settings"), onPress: () => void Linking.openSettings() },
    ]);
  }, [t]);

  const handleEnable = useCallback(async () => {
    if (!user || isWorking) return;
    setIsWorking(true);
    try {
      await storage.setPushEnabled(true, user.id);
      const token = await registerPushTokenWithBackend({ forcePrompt: true });
      if (token) {
        toast.success(t("Notifications enabled."));
        setVisible(false);
        return;
      }
      openSystemSettings();
    } catch {
      openSystemSettings();
    } finally {
      setIsWorking(false);
      void refreshVisibility();
    }
  }, [user, isWorking, t, toast, openSystemSettings, refreshVisibility]);

  if (!visible) return null;

  return (
    <View style={[styles.banner, { backgroundColor: Colors.primary + "12", borderColor: Colors.primary + "45" }]}>
      <View style={[styles.iconWrap, { backgroundColor: Colors.primary }]}>
        <Ionicons name="notifications-outline" size={20} color="#fff" />
      </View>
      <View style={styles.textWrap}>
        <AppText color={colors.text} style={styles.title}>
          {t("Enable notifications")}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary} style={styles.subtitle}>
          {t("Get pickup updates instantly on your phone.")}
        </AppText>
      </View>
      <Pressable
        style={({ pressed }) => [styles.cta, { backgroundColor: Colors.primary }, pressed && { opacity: 0.85 }]}
        onPress={() => void handleEnable()}
        disabled={isWorking}
      >
        {isWorking ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <AppText variant="label" color="#fff">
            {t("Enable")}
          </AppText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700" },
  subtitle: { fontSize: 12, lineHeight: 16 },
  cta: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
});
