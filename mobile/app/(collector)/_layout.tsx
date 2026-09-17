import React, { useCallback, useEffect, useRef } from "react";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Alert, AppState, type AppStateStatus, Platform, Pressable, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";
import { useApp } from "@/lib/context";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { createUnifiedHeaderOptions, getDefaultRouteForRole } from "@/lib/navigation";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { locationApi } from "@/lib/location-api";

export default function CollectorLayout() {
  const { user, isLoading } = useApp();
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const lastAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pendingExitLocationRef = useRef<{ latitude: number; longitude: number; label: string } | null>(null);
  const isExitPromptVisibleRef = useRef(false);
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const tabBarHorizontalInset = 22;
  const tabBarMobileInsetPercent = "10%";
  const tabBarHeight = isWeb ? 76 : 72;
  const tabBarBottomInset = isWeb ? 14 : 12;
  const tabBarPaddingVertical = isWeb ? 8 : 0;
  const tabBarRadius = Math.round(tabBarHeight / 2);
  const mapFabSize = isWeb ? 58 : 60;
  const mapFabBottom = tabBarBottomInset + tabBarHeight + (isWeb ? 20 : 26);
  const mapFabRight = isWeb ? tabBarHorizontalInset + 24 : 30;
  const isMapRoute = pathname === "/map";
  const hideMapFab =
    isMapRoute ||
    pathname === "/profile" ||
    pathname === "/settings" ||
    pathname === "/guide";
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

  const captureExitLocation = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!user || user.role !== "collector") return;
    if (user.collectorExitLocationCaptureEnabled === false) return;

    const location = await captureCurrentDeviceLocation({
      requestPermission: false,
      includeLabel: true,
      allowCoordinateFallback: false,
      retries: 2,
    });
    if (!location) {
      pendingExitLocationRef.current = null;
      return;
    }

    pendingExitLocationRef.current = {
      latitude: location.latitude,
      longitude: location.longitude,
      label: location.label,
    };
  }, [user]);

  const promptSaveExitLocation = useCallback(() => {
    if (Platform.OS === "web") return;
    if (user?.collectorExitLocationCaptureEnabled === false) return;
    if (isExitPromptVisibleRef.current) return;
    const location = pendingExitLocationRef.current;
    if (!location) return;

    isExitPromptVisibleRef.current = true;
    Alert.alert(
      t("Save last location?"),
      t("Last location captured: {location}", {
        location: location.label.trim() || t("Location unavailable"),
      }),
      [
        {
          text: t("Not now"),
          style: "cancel",
          onPress: () => {
            isExitPromptVisibleRef.current = false;
            pendingExitLocationRef.current = null;
          },
        },
        {
          text: t("Save"),
          onPress: () => {
            void (async () => {
              try {
                await locationApi.trackLocation({
                  latitude: location.latitude,
                  longitude: location.longitude,
                });
                toast.success(t("Last location saved"));
              } catch (err) {
                const message = err instanceof Error ? err.message : t("Could not save last location");
                toast.error(message);
              } finally {
                isExitPromptVisibleRef.current = false;
                pendingExitLocationRef.current = null;
              }
            })();
          },
        },
      ]
    );
  }, [t, toast, user?.collectorExitLocationCaptureEnabled]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!user || user.role !== "collector") return;
    if (user.collectorExitLocationCaptureEnabled === false) {
      pendingExitLocationRef.current = null;
      return;
    }

    const appStateListener = AppState.addEventListener("change", (nextState) => {
      const previous = lastAppStateRef.current;
      lastAppStateRef.current = nextState;

      const movedToBackground = previous === "active" && (nextState === "inactive" || nextState === "background");
      if (movedToBackground) {
        void captureExitLocation();
        return;
      }

      const movedToForeground =
        (previous === "inactive" || previous === "background") &&
        nextState === "active";
      if (movedToForeground) {
        promptSaveExitLocation();
      }
    });

    return () => {
      appStateListener.remove();
    };
  }, [captureExitLocation, promptSaveExitLocation, user]);

  if (!user) {
    if (isLoading) return null;
    return <Redirect href="/(public)/get-started" />;
  }
  if (user.role !== "collector") {
    return <Redirect href="/(tabs)" />;
  }
  if (user.collectorVerificationStatus && user.collectorVerificationStatus !== "approved") {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/collector-submitted",
          params: {
            name: user.name,
            email: user.email,
            phone: user.phone ?? "",
            area: user.neighborhood ?? "",
            status: user.collectorVerificationStatus,
            submittedAt: user.collectorSubmittedAt ?? "",
          },
        }}
      />
    );
  }

  return (
    <View style={[styles.layoutRoot, { backgroundColor: colors.background }]}>
      <Tabs
        screenOptions={{
          ...sharedHeaderOptions,
          headerShown: false,
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.tabIconDefault,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: "absolute",
            left: isWeb ? tabBarHorizontalInset : tabBarMobileInsetPercent,
            right: isWeb ? tabBarHorizontalInset : tabBarMobileInsetPercent,
            bottom: tabBarBottomInset,
            height: tabBarHeight,
            backgroundColor: "transparent",
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: tabBarRadius,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.12,
            shadowRadius: 18,
            paddingTop: tabBarPaddingVertical,
            paddingBottom: tabBarPaddingVertical,
            overflow: "hidden",
            zIndex: 30,
          },
          tabBarIconStyle: {
            marginTop: 0,
            marginBottom: 0,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          },
          tabBarItemStyle: {
            paddingTop: 0,
            paddingBottom: 0,
            paddingHorizontal: 4,
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            height: "100%",
          },
          tabBarLabelStyle: {
            fontSize: 11,
            lineHeight: 14,
            marginTop: 1,
            marginBottom: 0,
            paddingBottom: 0,
            fontFamily: "Inter_600SemiBold",
            textAlign: "center",
          },
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, { borderRadius: tabBarRadius, overflow: "hidden" }]}>
              {isIOS ? (
                <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
              )}
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="assigned"
          options={{
            title: t("Assignments"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "list" : "list-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t("History"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("Profile"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: styles.hiddenTabBar,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
            headerShown: true,
            title: t("Settings"),
            tabBarStyle: styles.hiddenTabBar,
          }}
        />
        <Tabs.Screen
          name="detail"
          options={{
            href: null,
            headerShown: true,
            title: t("Task Detail"),
            tabBarStyle: styles.hiddenTabBar,
          }}
        />
      </Tabs>

      {!hideMapFab ? (
        <Pressable
          style={({ pressed }) => [
            styles.mapFab,
            {
              width: mapFabSize,
              height: mapFabSize,
              borderRadius: mapFabSize / 2,
              bottom: mapFabBottom,
              right: mapFabRight,
              backgroundColor: Colors.primary,
              borderColor: colors.surface,
            },
            pressed && styles.mapFabPressed,
          ]}
          onPress={() => router.push("/(collector)/map")}
          accessibilityRole="button"
          accessibilityLabel={t("Open collector map")}
          testID="collector-map-fab"
        >
          <Ionicons name="map" size={26} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layoutRoot: {
    flex: 1,
  },
  hiddenTabBar: {
    display: "none",
    backgroundColor: Colors.primary,
  },
  mapFab: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 80,
    gap: 2,
  },
  mapFabPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.95,
  },
});
