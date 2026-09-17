import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const toReportTypeLabel = (value: string | undefined, t: (key: string, params?: Record<string, string | number>) => string) => {
  if (value === "illegal_dumping") return t("Illegal Dumping");
  if (value === "overflowing_bin") return t("Overflowing Bin");
  return t("Other Issue");
};

export default function ReportSubmittedScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const params = useLocalSearchParams();

  const typeParam = getParamValue(params.type);
  const locationParam = getParamValue(params.location);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: spacing.xxl,
        paddingBottom: insets.bottom + 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <BottomWhiteScent />
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.success + "14" }]}>
          <Ionicons name="checkmark-circle" size={52} color={Colors.success} />
        </View>

        <AppText variant="title" center color={colors.text}>{t("Report submitted")}</AppText>
        <AppText color={colors.textSecondary} center style={styles.subtitle}>
          {t("Thanks for reporting. The app is matching the nearest available collector and will notify you once accepted.")}
        </AppText>

        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.detailsRow}>
            <AppText variant="overline" color={colors.textSecondary}>{t("Issue Type")}</AppText>
            <AppText style={styles.value} color={colors.text}>{toReportTypeLabel(typeParam, t)}</AppText>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.detailsRow}>
            <AppText variant="overline" color={colors.textSecondary}>{t("Location")}</AppText>
            <AppText style={styles.value} color={colors.text}>{locationParam || t("Location not provided")}</AppText>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.detailsRow}>
            <AppText variant="overline" color={colors.textSecondary}>{t("Status")}</AppText>
            <AppText style={styles.value} color={Colors.error}>{t("Reported")}</AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: Colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.replace("/(tabs)")}
          >
            <AppText variant="button" color="#fff">{t("Go to Dashboard")}</AppText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.replace("/profile/history")}
          >
            <AppText variant="button" color={colors.text}>{t("View History")}</AppText>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  subtitle: {
    marginTop: 6,
    fontSize: fontSizes.md,
    lineHeight: 20,
  },
  detailsCard: {
    width: "100%",
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    marginTop: 20,
  },
  detailsRow: { gap: 6 },
  value: { fontSize: fontSizes.md, fontFamily: fonts.medium, lineHeight: 20 },
  divider: { height: 1, marginVertical: spacing.md },
  actions: { width: "100%", gap: 10, marginTop: 18 },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
});