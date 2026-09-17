import React from "react";
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { layout, radius, spacing } from "@/constants/theme";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export default function CollectorSubmittedScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();

  const name = getParamValue(params.name) || "-";
  const email = getParamValue(params.email) || "-";
  const phone = getParamValue(params.phone) || "-";
  const area = getParamValue(params.area) || "-";
  const submittedAt = getParamValue(params.submittedAt) || "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: width < 400 ? 16 : 24,
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <View pointerEvents="none" style={styles.bottomGlow} />

      <View style={styles.contentWrap}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.primary + "14" }]}>
          <Image
            source={require("../../assets/images/WasteTrack-transparent-matched.png")}
            style={styles.logoMark}
            resizeMode="contain"
          />
        </View>

        <View
          style={[
            styles.successChip,
            { backgroundColor: Colors.primary + "12", borderColor: Colors.primary + "30" },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
          <AppText variant="label" color={Colors.primary}>
            {t("Submitted")}
          </AppText>
        </View>

        <AppText variant="title" color={colors.text} center>
          {t("Details submitted successfully")}
        </AppText>
        <AppText color={colors.textSecondary} center>
          {t("Your collector application is now waiting for admin validation.")}
        </AppText>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="label" color={colors.text}>
            {t("Submitted details")}
          </AppText>

          <View style={styles.row}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Name")}
            </AppText>
            <AppText style={styles.value} color={colors.text}>
              {name}
            </AppText>
          </View>
          <View style={styles.row}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Email")}
            </AppText>
            <AppText style={styles.value} color={colors.text}>
              {email}
            </AppText>
          </View>
          <View style={styles.row}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Phone")}
            </AppText>
            <AppText style={styles.value} color={colors.text}>
              {phone}
            </AppText>
          </View>
          <View style={styles.row}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Neighborhood")}
            </AppText>
            <AppText style={styles.value} color={colors.text}>
              {area}
            </AppText>
          </View>
          <View style={styles.row}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Submitted")}
            </AppText>
            <AppText style={styles.value} color={colors.text}>
              {formatDateTime(submittedAt)}
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label={t("Go to Sign In")}
            onPress={() => router.replace("/(auth)/login")}
          />
          <Button
            variant="secondary"
            label={t("Back to Home")}
            onPress={() => router.replace("/(public)/get-started")}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  contentWrap: {
    width: "100%",
    maxWidth: layout.shellMaxWidth,
    alignSelf: "center",
    alignItems: "center",
  },
  bottomGlow: {
    position: "absolute",
    left: -90,
    bottom: -140,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(13,150,104,0.07)",
  },
  iconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    marginTop: spacing.sm + 2,
  },
  logoMark: { width: 64, height: 64 },
  successChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.sm + 2,
  },
  card: {
    width: "100%",
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.sm + 6,
    gap: 10,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
  },
  actions: {
    width: "100%",
    gap: 10,
  },
});