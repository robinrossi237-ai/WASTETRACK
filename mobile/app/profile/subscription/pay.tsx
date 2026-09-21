import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomWhiteScent from "@/components/BottomWhiteScent";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { ApiError } from "@/lib/api-client";
import type { PaymentMethodDetails, PaymentMethodId, PlanDetails } from "@/lib/types";
import {
  buildUssdDialUrl,
  createSubscriptionRequest,
  fetchPricing,
  formatPrice,
  uploadPaymentProof,
} from "@/lib/subscription";

const METHOD_BRAND: Record<PaymentMethodId, { bg: string; fg: string; label: string }> = {
  mtn: { bg: "#FFCC00", fg: "#1a1a1a", label: "MTN" },
  orange: { bg: "#FF7900", fg: "#ffffff", label: "Orange" },
};

export default function SubscriptionPayScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { refreshData } = useApp();
  const toast = useToast();
  const { plan: planParam } = useLocalSearchParams<{ plan?: string }>();

  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [methods, setMethods] = useState<PaymentMethodDetails[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("mtn");
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { plans, paymentMethods } = await fetchPricing();
      const target = plans.find((item) => item.id === planParam) ?? null;
      if (!target) {
        toast.error(t("Unable to load plans. Please try again."));
        router.back();
        return;
      }
      setPlan(target);
      setMethods(paymentMethods);
      if (paymentMethods.length > 0) {
        setSelectedMethod(paymentMethods[0].id);
      }
    } catch {
      toast.error(t("Unable to load plans. Please try again."));
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [planParam, t, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeMethod = useMemo(
    () => methods.find((method) => method.id === selectedMethod) ?? null,
    [methods, selectedMethod]
  );

  const dialCode = useMemo(() => {
    if (!plan || !activeMethod) return "";
    return activeMethod.ussd_template.replace("{amount}", String(plan.price_amount));
  }, [plan, activeMethod]);

  const handleOpenDialer = useCallback(async () => {
    if (!plan || !activeMethod) return;
    try {
      await Linking.openURL(buildUssdDialUrl(activeMethod.ussd_template, plan.price_amount));
      toast.info(t("Dialer opened. Complete the payment, then upload your screenshot."));
    } catch {
      toast.error(t("Could not open dialer"));
    }
  }, [plan, activeMethod, t, toast]);

  const resolvePickedImageUri = (asset: ImagePicker.ImagePickerAsset) => {
    const mimeType =
      typeof asset.mimeType === "string" && asset.mimeType ? asset.mimeType : "image/jpeg";
    if (asset.base64 && asset.base64.trim().length > 0) {
      return `data:${mimeType};base64,${asset.base64.replace(/\s+/g, "")}`;
    }
    return asset.uri;
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      setScreenshotUri(resolvePickedImageUri(result.assets[0]));
    } catch {
      toast.error(t("Could not read selected image. Please choose another photo."));
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        toast.error(t("Camera permission denied"));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      setScreenshotUri(resolvePickedImageUri(result.assets[0]));
    } catch {
      toast.error(t("Could not capture image. Please try again."));
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === "web") {
      void pickImage();
      return;
    }
    Alert.alert(t("Add payment screenshot"), t("Choose an option"), [
      { text: t("Take Photo"), onPress: () => void takePhoto() },
      { text: t("Choose from Library"), onPress: () => void pickImage() },
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    if (!plan || !activeMethod || isSubmitting) return;
    if (plan.price_amount > 0 && !screenshotUri) {
      toast.error(t("Payment screenshot is required for paid plans."));
      return;
    }
    setIsSubmitting(true);
    try {
      let proofUrl: string | null = null;
      if (screenshotUri) {
        proofUrl = await uploadPaymentProof(screenshotUri);
      }
      await createSubscriptionRequest({
        planId: plan.id,
        paymentMethod: activeMethod.id,
        proofUrl,
      });
      toast.success(
        plan.price_amount === 0
          ? t("Free plan activated.")
          : t("Request submitted. An admin will review it shortly.")
      );
      await refreshData();
      router.replace("/profile/subscription/requests");
    } catch (err) {
      if (err instanceof ApiError && err.code === "SUBSCRIPTION_REQUEST_PENDING") {
        toast.error(t("You already have a pending request."));
        router.replace("/profile/subscription/requests");
        return;
      }
      if (err instanceof ApiError && err.code === "SUBSCRIPTION_ALREADY_ON_PLAN") {
        toast.error(t("You are already on this plan."));
        router.back();
        return;
      }
      toast.error(err instanceof Error ? err.message : t("Unable to load plans. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !plan) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <AppText color={colors.textSecondary} style={styles.loadingText}>
          {t("Loading plans...")}
        </AppText>
      </View>
    );
  }

  const isFree = plan.price_amount === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BottomWhiteScent />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <AppText variant="title" color={colors.text}>
          {t("Pay for {plan}", { plan: plan.name })}
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.planRow}>
            <View style={styles.planInfo}>
              <AppText color={colors.text} style={styles.planName}>
                {plan.name}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {plan.monthly_limit === null
                  ? t("Unlimited pickups")
                  : t("{limit} pickups / month", { limit: String(plan.monthly_limit) })}
              </AppText>
            </View>
            <AppText color={Colors.primary} style={styles.planPrice}>
              {isFree ? t("Free") : formatPrice(plan.price_amount, plan.currency)}
            </AppText>
          </View>
        </View>

        {isFree ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText color={colors.textSecondary} style={styles.hint}>
              {t("This plan is free — no payment needed.")}
            </AppText>
            <Button
              label={t("Activate free plan")}
              onPress={() => void handleSubmit()}
              loading={isSubmitting}
              style={styles.submitBtn}
            />
          </View>
        ) : (
          <>
            <AppText color={colors.textSecondary} style={styles.stepHint}>
              {t("1. Pay via the dialer")}
            </AppText>
            <View style={styles.methodRow}>
              {methods.map((method) => {
                const brand = METHOD_BRAND[method.id] ?? { bg: colors.surfaceSecondary, fg: colors.text, label: method.id };
                const selected = method.id === selectedMethod;
                return (
                  <Pressable
                    key={method.id}
                    onPress={() => setSelectedMethod(method.id)}
                    style={[
                      styles.methodCard,
                      {
                        backgroundColor: brand.bg,
                        borderColor: selected ? colors.text : "transparent",
                        borderWidth: selected ? 3 : 0,
                      },
                    ]}
                  >
                    <AppText style={[styles.methodLabel, { color: brand.fg }]}>{brand.label}</AppText>
                    <AppText style={[styles.methodSub, { color: brand.fg }]}>{method.name}</AppText>
                  </Pressable>
                );
              })}
            </View>

            {activeMethod && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.detailRow}>
                  <AppText color={colors.textSecondary}>{t("Merchant number")}</AppText>
                  <AppText color={colors.text} style={styles.detailValue}>
                    {activeMethod.merchant_number}
                  </AppText>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.detailRow}>
                  <AppText color={colors.textSecondary}>{t("Amount to pay")}</AppText>
                  <AppText color={Colors.primary} style={styles.detailValue}>
                    {formatPrice(plan.price_amount, plan.currency)}
                  </AppText>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.detailRow}>
                  <AppText color={colors.textSecondary}>USSD</AppText>
                  <AppText color={colors.text} style={styles.detailValue}>
                    {dialCode}
                  </AppText>
                </View>
                <Button
                  label={t("Pay with {method}", { method: activeMethod.name })}
                  onPress={() => void handleOpenDialer()}
                  style={styles.submitBtn}
                />
              </View>
            )}

            <AppText color={colors.textSecondary} style={styles.stepHint}>
              {t("2. Upload your screenshot")}
            </AppText>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {screenshotUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: screenshotUri }} style={styles.preview} resizeMode="cover" />
                  <Pressable
                    onPress={() => setScreenshotUri(null)}
                    style={[styles.removeBtn, { backgroundColor: colors.background }]}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={showImageOptions}
                  style={[styles.uploadBox, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                  <AppText color={colors.textSecondary} style={styles.uploadText}>
                    {t("Upload payment screenshot")}
                  </AppText>
                </Pressable>
              )}
              {screenshotUri && (
                <Button
                  variant="secondary"
                  label={t("Change")}
                  onPress={showImageOptions}
                  style={styles.changeBtn}
                />
              )}
            </View>

            <AppText color={colors.textSecondary} style={styles.stepHint}>
              {t("3. Submit for admin review")}
            </AppText>
            <Button
              label={t("Submit for review")}
              onPress={() => void handleSubmit()}
              loading={isSubmitting}
              disabled={!screenshotUri}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 20, width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  planRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  planInfo: { flex: 1, gap: 4 },
  planName: { fontSize: fontSizes.body, fontFamily: fonts.bold },
  planPrice: { fontSize: fontSizes.body, fontFamily: fonts.bold },
  stepHint: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, marginTop: spacing.sm },
  methodRow: { flexDirection: "row", gap: spacing.md },
  methodCard: { flex: 1, borderRadius: radius.xl, padding: spacing.md, alignItems: "center", gap: 2 },
  methodLabel: { fontSize: 22, fontFamily: fonts.bold },
  methodSub: { fontSize: 11, fontFamily: fonts.medium, opacity: 0.85, textAlign: "center" },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  detailValue: { fontSize: fontSizes.body, fontFamily: fonts.bold, textAlign: "right", flexShrink: 1 },
  divider: { height: 1, marginVertical: spacing.sm },
  submitBtn: { marginTop: spacing.md },
  hint: { fontSize: 14, lineHeight: 20 },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.xl,
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  uploadText: { fontSize: 14 },
  previewWrap: { position: "relative", borderRadius: radius.xl, overflow: "hidden" },
  preview: { width: "100%", height: 220 },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBtn: { marginTop: spacing.sm },
});
