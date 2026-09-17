import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SystemUI from "expo-system-ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PushNotificationsGate } from "@/components/PushNotificationsGate";
import { queryClient } from "@/lib/query-client";
import { AppProvider, useApp } from "@/lib/context";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { ToastProvider } from "@/lib/toast-context";
import { createUnifiedHeaderOptions, getDefaultRouteForRole } from "@/lib/navigation";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const { user } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();

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
    <Stack screenOptions={{ ...sharedHeaderOptions, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="+not-found" options={{ title: t("Oops!") }} />
      <Stack.Screen name="guide" options={{ title: t("Guide"), headerShown: true }} />
      <Stack.Screen name="pickup/new" options={{ title: t("New Pickup Request"), headerShown: true }} />
      <Stack.Screen name="pickup/confirmed" options={{ title: t("Request Confirmed"), headerShown: true }} />
      <Stack.Screen name="pickup/tracking" options={{ title: t("Collector Arriving"), headerShown: true }} />
      <Stack.Screen name="report/new" options={{ title: t("New Report"), headerShown: true }} />
      <Stack.Screen name="report/submitted" options={{ title: t("Report Submitted"), headerShown: true }} />
      <Stack.Screen name="profile/edit" options={{ title: t("Edit Profile"), headerShown: true }} />
      <Stack.Screen name="profile/settings" options={{ title: t("Settings"), headerShown: true }} />
      <Stack.Screen name="profile/history" options={{ title: t("History"), headerShown: true }} />
      <Stack.Screen name="profile/feedback" options={{ title: t("Feedback & Rating"), headerShown: true }} />
      <Stack.Screen name="notifications/index" options={{ title: t("Notification Center"), headerShown: true }} />
      <Stack.Screen name="learn" options={{ title: t("Learn"), headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <LanguageProvider>
                <ToastProvider>
                  <AppProvider>
                    <PollingGate />
                  </AppProvider>
                </ToastProvider>
              </LanguageProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function PollingGate() {
  const { colors } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PushNotificationsGate />
      <RootLayoutNav />
    </View>
  );
}
