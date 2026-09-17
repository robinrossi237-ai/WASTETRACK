import React, { useCallback, useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { useApp } from "@/lib/context";
import { useTheme } from "@/lib/theme-context";
import { createUnifiedHeaderOptions, getDefaultRouteForRole } from "@/lib/navigation";
import { useLanguage } from "@/lib/language-context";
export default function AuthLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();
  useEffect(() => {
    const isAuthScreen = pathname === "/login" || pathname === "/register";
    if (!isAuthScreen) return;
    if (user) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [pathname, router, user]);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(getDefaultRouteForRole(user?.role));
  }, [router, user?.role]);

  const sharedHeaderOptions = createUnifiedHeaderOptions({
    colors,
    onBackPress: handleBackPress,
    backLabel: t("Go back"),
  });

  return (
    <Stack
      screenOptions={{
        ...sharedHeaderOptions,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: t("Sign In") }} />
      <Stack.Screen name="register" options={{ title: t("Create Account") }} />
      <Stack.Screen name="collector-submitted" options={{ title: t("Collector Application") }} />
      <Stack.Screen name="collector-approved" options={{ title: t("Collector Approved") }} />
    </Stack>
  );
}
