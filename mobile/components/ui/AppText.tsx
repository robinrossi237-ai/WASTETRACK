import React from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { fonts, fontSizes } from "@/constants/theme";

type AppTextVariant =
  | "hero"
  | "title"
  | "subtitle"
  | "body"
  | "label"
  | "caption"
  | "button"
  | "overline";

const variantStyle: Record<AppTextVariant, TextStyle> = {
  hero: { fontSize: fontSizes.hero, fontFamily: fonts.bold, lineHeight: 34 },
  title: { fontSize: fontSizes.title, fontFamily: fonts.bold, lineHeight: 26 },
  subtitle: { fontSize: fontSizes.body, fontFamily: fonts.regular, lineHeight: 22 },
  body: { fontSize: fontSizes.body, fontFamily: fonts.regular, lineHeight: 21 },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, lineHeight: 18 },
  caption: { fontSize: fontSizes.xs, fontFamily: fonts.regular, lineHeight: 16 },
  button: { fontSize: fontSizes.button, fontFamily: fonts.semibold, lineHeight: 22 },
  overline: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.semibold,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
};

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: string;
  center?: boolean;
};

export function AppText({
  variant = "body",
  color,
  center = false,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        variantStyle[variant],
        color != null && { color },
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
});