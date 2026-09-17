import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import type { UserRole } from "@/lib/types";
import { useApp } from "@/lib/context";

type ThemeColors = typeof Colors.light;

export const getDefaultRouteForRole = (role?: UserRole | null) => {
  if (role === "collector") return "/(collector)/assigned";
  if (role === "resident") return "/(tabs)";
  return "/(public)/get-started";
};

type UnifiedHeaderOptionsParams = {
  colors: ThemeColors;
  onBackPress: () => void;
  backLabel?: string;
};

export const createUnifiedHeaderOptions = ({ colors, onBackPress, backLabel }: UnifiedHeaderOptionsParams) => ({
  headerBackTitleVisible: false,
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.text,
  headerTitleAlign: "left" as const,
  headerTitleStyle: styles.headerTitle,
  headerLeftContainerStyle: styles.headerLeftContainer,
  headerTitleContainerStyle: styles.headerTitleContainer,
  headerLeft: () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={backLabel ?? "Go back"}
      hitSlop={10}
      onPress={onBackPress}
      style={({ pressed }) => [
        styles.backButton,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.backButtonPressed,
      ]}
    >
      <Ionicons name="arrow-back" size={18} color={colors.text} />
    </Pressable>
  ),
});

export type ProtectedRouteState = "loading" | "granted" | "forbidden";

/**
 * Guards a protected screen against unauthenticated / role-mismatched access.
 * - "loading": auth is still restoring; the screen should render a loading view
 *   (or nothing) so the protected form doesn't flash before the session is known.
 * - "granted": user is signed in and has a permitted role.
 * - "forbidden": user is signed in but lacks the required role (or is signed out);
 *   the screen should redirect away (its existing effect already does this).
 *
 * Pure function of auth state — no navigation side effects performed here.
 */
export function useProtectedRoute(roles: UserRole[] = []): ProtectedRouteState {
  const { user, isLoading } = useApp();

  if (!user) {
    return isLoading ? "loading" : "forbidden";
  }

  const allowed = roles.length === 0 || roles.includes(user.role);
  return allowed ? "granted" : "forbidden";
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  headerLeftContainer: {
    paddingLeft: 20,
  },
  headerTitleContainer: {
    paddingLeft: 18,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    opacity: 0.7,
  },
});
