import React, { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import FloatingInput from "@/components/FloatingInput";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { layout } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { useLanguage } from "@/lib/language-context";
import { locationApi } from "@/lib/location-api";
import { getCollectorApprovalSeen } from "@/lib/storage";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import type { UserRole } from "@/lib/types";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { login, logout } = useApp();
  const toast = useToast();

  const stableWindowHeightRef = useRef(windowHeight);
  if (windowHeight > stableWindowHeightRef.current) {
    stableWindowHeightRef.current = windowHeight;
  }
  const stableWindowHeight = stableWindowHeightRef.current;

  const isSmallScreen = screenWidth < 400 || stableWindowHeight < 760;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const topPadding = 16;
  const bottomPadding = insets.bottom + 20;
  const availableHeight = Math.max(0, stableWindowHeight - insets.bottom);
  const contentMinHeight = Math.max(0, availableHeight - topPadding - bottomPadding);
  const shellMinHeight = Math.max(contentMinHeight, isSmallScreen ? 460 : 520);

  const getDashboardRoute = (role: UserRole) => {
    if (role === "collector") return "/(collector)/assigned";
    return "/(tabs)";
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      toast.error(t("Please enter your email"));
      return;
    }
    if (!password) {
      toast.error(t("Please enter your password"));
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsLoading(true);

    try {
      const signedInUser = await login(email, password);
      if (signedInUser.role === "collector") {
        const loginLocation = await captureCurrentDeviceLocation({
          requestPermission: true,
          includeLabel: false,
          retries: 2,
        });
        const areaText = (signedInUser.neighborhood ?? "").toLowerCase();
        const looksCameroonArea =
          /douala|bonaberi|littoral|cameroon|cameroun|yaounde|buea|bamenda/.test(areaText);
        const isWithinCameroon =
          loginLocation != null &&
          loginLocation.latitude >= 1 &&
          loginLocation.latitude <= 14 &&
          loginLocation.longitude >= 8 &&
          loginLocation.longitude <= 17;

        if (loginLocation && (!looksCameroonArea || isWithinCameroon)) {
          try {
            await locationApi.trackLocation({
              latitude: loginLocation.latitude,
              longitude: loginLocation.longitude,
              accuracy: loginLocation.accuracy,
            });
          } catch {
            // Best effort only; authentication flow should not fail.
          }
        }
      }
      if (signedInUser.role === "collector") {
        const verificationStatus = signedInUser.collectorVerificationStatus ?? "approved";
        if (verificationStatus !== "approved") {
          toast.info(t("Waiting for admin review"));
          router.replace({
            pathname: "/(auth)/collector-submitted",
            params: {
              name: signedInUser.name,
              email: signedInUser.email,
              phone: signedInUser.phone ?? "",
              area: signedInUser.neighborhood ?? "",
              status: verificationStatus,
              submittedAt: signedInUser.collectorSubmittedAt ?? "",
            },
          });
          return;
        }

        const hasSeenApproval = await getCollectorApprovalSeen(signedInUser.id);
        if (!hasSeenApproval) {
          router.replace({
            pathname: "/(auth)/collector-approved",
            params: { name: signedInUser.name },
          });
          return;
        }
      }

      if (signedInUser.role === "admin") {
        await logout();
        toast.info(t("Admin access is available on the web dashboard."));
        return;
      }

      toast.success(t("Signed in"));
      router.replace(getDashboardRoute(signedInUser.role));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Sign in failed");
      toast.error(message);
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: contentMinHeight,
            paddingHorizontal: isSmallScreen ? 16 : 24,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        <View style={[styles.shell, { minHeight: shellMinHeight }]}>
          <View style={styles.mainContent}>
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: Colors.primary + "15" }]}>
                <Image
                  source={require("../../assets/images/WasteTrack-transparent-matched.png")}
                  style={styles.logoMark}
                  resizeMode="contain"
                />
              </View>
              <AppText variant="hero" color={colors.text} center>
                {t("Welcome back")}
              </AppText>
              <AppText center color={colors.textSecondary}>
                {t("Sign in to continue managing your waste")}
              </AppText>
            </View>

            <View style={styles.formFields}>
              <FloatingInput
                label={t("Email")}
                value={email}
                onChange={setEmail}
                type="email"
                icon="mail-outline"
                autoComplete="email"
                testID="login-email"
              />

              <FloatingInput
                label={t("Password")}
                value={password}
                onChange={setPassword}
                type="password"
                icon="lock-closed-outline"
                autoComplete="current-password"
                testID="login-password"
              />
            </View>

            <Button
              label={isLoading ? t("Signing in...") : t("Sign In")}
              onPress={() => void handleLogin()}
              loading={isLoading}
              disabled={isLoading}
              testID="login-btn"
              style={styles.actionButton}
            />

            <View style={styles.footer}>
              <AppText color={colors.textSecondary}>{t("Don't have an account?")}</AppText>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <AppText variant="label" color={Colors.primary}>
                    {t("Create Account")}
                  </AppText>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    maxWidth: layout.shellMaxWidth,
    alignSelf: "center",
    justifyContent: "center",
  },
  mainContent: { width: "100%", justifyContent: "center", gap: 18 },
  bgGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(13,150,104,0.07)",
  },
  header: { alignItems: "center", gap: 6 },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoMark: { width: 78, height: 78 },
  formFields: { gap: 16 },
  actionButton: { marginTop: 4 },
  footer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    width: "100%",
  },
});