import React, { useEffect } from "react";
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { layout, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { setCollectorApprovalSeen } from "@/lib/storage";
import { useTheme } from "@/lib/theme-context";

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function CollectorApprovedScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { user } = useApp();

  const nameParam = getParamValue(params.name) || "";
  const firstName = (nameParam || user?.name || "").trim().split(/\s+/)[0] || t("Collector");

  useEffect(() => {
    if (!user?.id) return;
    void setCollectorApprovalSeen(true, user.id);
  }, [user?.id]);

  const handleContinue = async () => {
    if (user?.id) {
      await setCollectorApprovalSeen(true, user.id);
    }
    router.replace("/(collector)/assigned");
  };

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
            { backgroundColor: Colors.success + "12", borderColor: Colors.success + "33" },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <AppText variant="label" color={Colors.success}>
            {t("Approved")}
          </AppText>
        </View>

        <AppText variant="title" color={colors.text} center>
          {t("Welcome, {name}", { name: firstName })}
        </AppText>
        <AppText color={colors.textSecondary} center>
          {t("Your collector account has been approved successfully. You can now start receiving assignments.")}
        </AppText>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="list-outline" size={18} color={Colors.primary} />
            <AppText style={styles.infoText} color={colors.text}>
              {t("View pickups and reports assigned to you.")}
            </AppText>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
            <AppText style={styles.infoText} color={colors.text}>
              {t("Open map routes and complete tasks quickly.")}
            </AppText>
          </View>
        </View>

        <Button
          label={t("Go to Dashboard")}
          rightIcon="arrow-forward"
          onPress={() => void handleContinue()}
          style={styles.actionButton}
        />
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
  infoCard: {
    width: "100%",
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.sm + 6,
    gap: 10,
    marginTop: spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
  },
  infoText: { flex: 1, lineHeight: 18 },
  actionButton: { width: "100%", marginTop: spacing.lg },
});