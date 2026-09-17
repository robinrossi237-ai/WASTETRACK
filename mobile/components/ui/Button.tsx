import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { radius, shadows } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import { AppText } from "./AppText";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  style?: ViewStyle | ViewStyle[];
};

const variantColors: Record<ButtonVariant, (colors: ReturnType<typeof useTheme>["colors"]) => { bg?: string; border?: string; label: string; icon?: string; loading?: string }> = {
  primary: () => ({ bg: Colors.primary, label: "#fff", loading: "#fff" }),
  secondary: (colors) => ({
    bg: colors.surface,
    border: colors.border,
    label: colors.text,
    icon: colors.text,
    loading: colors.textSecondary,
  }),
  ghost: () => ({ label: Colors.primary, icon: Colors.primary, loading: Colors.primary }),
  danger: () => ({ bg: Colors.error, label: "#fff", loading: "#fff" }),
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const palette = variantColors[variant](colors);
  const isDisabled = disabled || loading;

  const baseStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...(palette.bg != null ? { backgroundColor: palette.bg } : null),
    ...(palette.border != null ? { borderColor: palette.border, borderWidth: 1 } : null),
  };

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        baseStyle,
        shadows.button,
        (Array.isArray(style) ? style : [style]).filter(Boolean) as ViewStyle[],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.loading ?? palette.label} />
      ) : (
        <>
          {leftIcon != null ? (
            <Ionicons name={leftIcon as never} size={18} color={palette.icon ?? palette.label} />
          ) : null}
          {!loading && <AppText variant="button" color={palette.label}>{label}</AppText>}
          {rightIcon != null ? (
            <Ionicons name={rightIcon as never} size={18} color={palette.icon ?? palette.label} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.6 },
});