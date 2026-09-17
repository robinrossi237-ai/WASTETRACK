import React from "react";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

function ClassicTabLayout() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const pathname = usePathname();
  const router = useRouter();

  const tabBarHorizontalInset = 22;
  const tabBarMobileInsetPercent = "10%";
  const tabBarHeight = isWeb ? 76 : 72;
  const tabBarBottomInset = isWeb ? 14 : 12;
  const tabBarPaddingVertical = isWeb ? 8 : 0;
  const tabBarRadius = Math.round(tabBarHeight / 2);
  const mapFabSize = isWeb ? 58 : 60;
  const mapFabBottom = tabBarBottomInset + tabBarHeight + (isWeb ? 20 : 26);
  const mapFabRight = isWeb ? tabBarHorizontalInset + 24 : 30;
  const actionButtonSize = Math.round(tabBarHeight - 8);
  const isMapRoute = pathname === "/map";
  const hideMapFab =
    isMapRoute ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/guide";

  return (
    <View style={[styles.layoutRoot, { backgroundColor: colors.background }]}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.tabIconDefault,
          headerShown: false,
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
            overflow: "visible",
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
          name="index"
          options={{
            title: t("Home"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: t("Schedule"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="action"
          options={{
            title: t("New Request"),
            tabBarButton: (props) => (
              <Pressable
                {...(props as any)}
                style={({ pressed }) => [
                  props.style,
                  styles.actionButton,
                  {
                    width: actionButtonSize,
                    height: actionButtonSize,
                    borderRadius: actionButtonSize / 2,
                    top: 0,
                    borderColor: "#fff",
                    borderWidth: 4,
                    backgroundColor: Colors.primary,
                  },
                  pressed && styles.actionButtonPressed,
                ]}
                accessibilityLabel={t("Create a request")}
                testID="tab-action-btn"
              >
                <Image
                  source={require("../../assets/images/WasteTrack-transparent-matched.png")}
                  style={[
                    styles.actionLogo,
                    { width: actionButtonSize * 0.86, height: actionButtonSize * 0.86 },
                  ]}
                  resizeMode="cover"
                />
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: t("Rewards"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "star" : "star-outline"} size={24} color={color} />
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
          onPress={() => router.push("/(tabs)/map")}
          accessibilityRole="button"
          accessibilityLabel={t("Open map")}
          testID="tabs-map-fab"
        >
          <Ionicons name="map" size={26} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const { user, isLoading } = useApp();
  if (!user) {
    if (isLoading) return null;
    return <Redirect href="/(public)/get-started" />;
  }

  if (user.role === "collector") {
    return <Redirect href="/(collector)/assigned" />;
  }
  if (user.role === "admin") {
    return <Redirect href="/(public)/get-started" />;
  }

  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  layoutRoot: {
    flex: 1,
  },
  hiddenTabBar: {
    display: "none",
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    overflow: "hidden",
    padding: 0,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.95,
  },
  actionLogo: {
    width: 32,
    height: 32,
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
