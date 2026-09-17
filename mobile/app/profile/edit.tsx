import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import FloatingInput from "@/components/FloatingInput";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { useLanguage } from "@/lib/language-context";
import {
  isReasonablePhoneStyleLocation,
  stripLocationCode,
  toPhoneStyleLocation,
} from "@/lib/location-label";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, updateProfile, isLoading: isAppLoading } = useApp();
  const toast = useToast();
  const hasPromptedAuth = useRef(false);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood ?? "");
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [showNeighborhoods, setShowNeighborhoods] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    setPhone(digits.slice(0, 9));
  };

  useEffect(() => {
    if (isAppLoading) return;
    if (user) return;
    if (hasPromptedAuth.current) return;
    hasPromptedAuth.current = true;

    if (Platform.OS === "web") {
      router.replace("/(auth)/login");
      return;
    }

    Alert.alert(t("Sign in required"), t("Please sign in to edit your profile."), [
      { text: t("Cancel"), style: "cancel", onPress: () => router.back() },
      { text: t("Sign In"), onPress: () => router.replace("/(auth)/login") },
    ]);
  }, [isAppLoading, user, t]);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? "");
    setNeighborhood(user.neighborhood ?? "");
  }, [user]);

  const handleUseLocation = async () => {
    try {
      setIsLocating(true);
      const captured = await captureCurrentDeviceLocation({
        requestPermission: true,
        includeLabel: true,
        allowCoordinateFallback: false,
        retries: 3,
      });

      if (!captured) {
        toast.error(t("Location permission denied"));
        return;
      }

      const label = stripLocationCode(captured.label).trim();
      if (label.length === 0) {
        toast.error(t("Could not resolve location"));
        return;
      }

      setNeighborhood(label);
      setNeighborhoods([label]);
      setShowNeighborhoods(true);
      toast.success(t("Location captured"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to get location");
      toast.error(message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const normalizedNeighborhood = toPhoneStyleLocation(neighborhood.trim());

    if (!name.trim() || !normalizedNeighborhood) {
      toast.error(t("Please fill in all fields"));
      return;
    }
    if (!isReasonablePhoneStyleLocation(normalizedNeighborhood)) {
      toast.error(t("Could not resolve location"));
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, "").length !== 9) {
      toast.error(t("Phone number must be exactly 9 digits"));
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone,
        neighborhood: normalizedNeighborhood,
      });
      toast.success(t("Profile updated"));
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to save profile");
      toast.error(message);
    }
    setIsSaving(false);
  };

  if (!user) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: 24, paddingHorizontal: 24 },
        ]}
      >
        <BottomWhiteScent />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BottomWhiteScent />
        <View style={styles.header}>
          <AppText color={colors.textSecondary}>{t("Update your details and save.")}</AppText>
        </View>

        <View style={styles.form}>
          <FloatingInput
            label={t("Email")}
            value={user.email}
            onChange={() => undefined}
            type="email"
            icon="mail-outline"
            disabled
            editable={false}
          />

          <FloatingInput
            label={t("Full Name")}
            value={name}
            onChange={setName}
            icon="person-outline"
            autoComplete="name"
            testID="profile-edit-name"
          />

          <FloatingInput
            label={t("Phone")}
            value={phone}
            onChange={handlePhoneChange}
            type="phone"
            icon="call-outline"
            autoComplete="tel"
            maxLength={9}
            testID="profile-edit-phone"
          />

          <FloatingInput
            label={t("Neighborhood")}
            value={neighborhood}
            onChange={(text) => {
              setNeighborhood(text);
              setNeighborhoods([]);
              setShowNeighborhoods(false);
            }}
            icon="location-outline"
            rightAccessory={
              <Pressable onPress={() => void handleUseLocation()} disabled={isLocating}>
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color={isLocating ? colors.textSecondary : Colors.primary}
                />
              </Pressable>
            }
            autoCorrect
            onFocus={() => setShowNeighborhoods(neighborhoods.length > 0)}
          />
          {showNeighborhoods && neighborhoods.length > 0 && (
            <View
              style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {neighborhoods.map((n) => (
                <Pressable
                  key={n}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    neighborhood === n && { backgroundColor: Colors.primary + "10" },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    setNeighborhood(n);
                    setShowNeighborhoods(false);
                  }}
                >
                  <AppText color={neighborhood === n ? Colors.primary : colors.text}>
                    {n}
                  </AppText>
                  {neighborhood === n && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              ))}
            </View>
          )}

          <Button
            label={isSaving ? t("Saving...") : t("Save Changes")}
            loading={isSaving}
            onPress={handleSave}
            testID="profile-save-btn"
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, flexGrow: 1 },
  header: { marginBottom: 24 },
  form: { gap: spacing.lg },
  dropdownList: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", marginTop: 4 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  actionButton: { marginTop: spacing.sm },
});