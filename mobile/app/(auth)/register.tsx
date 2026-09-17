import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import FloatingInput from "@/components/FloatingInput";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/colors";
import { layout, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { useLanguage } from "@/lib/language-context";
import {
  isReasonablePhoneStyleLocation,
  stripLocationCode,
  toPhoneStyleLocation,
} from "@/lib/location-label";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import type { UserRole } from "@/lib/types";

const ROLES: { value: UserRole; labelKey: string; descriptionKey: string; icon: string }[] = [
  {
    value: "resident",
    labelKey: "Resident",
    descriptionKey: "Request pickups and submit waste reports for free.",
    icon: "home",
  },
  {
    value: "collector",
    labelKey: "Waste Collector",
    descriptionKey: "Collect pickups and help keep the city clean.",
    icon: "trash",
  },
];

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const buildSteps = (t: (key: string, values?: Record<string, string | number>) => string) => [
  {
    id: "account",
    title: t("Your details"),
    subtitle: t("Share your basic contact details."),
  },
  {
    id: "security_location",
    title: t("Location & security"),
    subtitle: t("Select your pickup area and secure your account."),
  },
  {
    id: "role",
    title: t("Role selection"),
    subtitle: t("Choose how you will use the app."),
  },
  {
    id: "review",
    title: t("Verify details"),
    subtitle: t("Confirm your details before creating the account."),
  },
];

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { register } = useApp();
  const toast = useToast();
  const { width, height: windowHeight } = useWindowDimensions();

  const stableWindowHeightRef = useRef(windowHeight);
  if (windowHeight > stableWindowHeightRef.current) {
    stableWindowHeightRef.current = windowHeight;
  }
  const stableWindowHeight = stableWindowHeightRef.current;

  const isSmallScreen = width < 400;
  const availableHeight = Math.max(0, stableWindowHeight - insets.bottom);
  const topPadding = isSmallScreen ? 12 : 16;
  const bottomPadding = insets.bottom + 20;
  const contentMinHeight = Math.max(0, availableHeight - topPadding - bottomPadding);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("resident");
  const [neighborhood, setNeighborhood] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showNeighborhoods, setShowNeighborhoods] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const contentJustify: "flex-start" | "center" =
    isSmallScreen || currentStep === 1 ? "flex-start" : "center";

  const transition = useRef(new Animated.Value(1)).current;
  const shellMinHeight = Math.max(contentMinHeight, isSmallScreen ? 560 : 610);
  const wizardFrameHeight =
    currentStep === 0
      ? isSmallScreen ? 248 : 268
      : currentStep === 1
        ? isSmallScreen ? 300 : 332
        : currentStep === 2
          ? isSmallScreen ? 300 : 320
          : (isSmallScreen ? 300 : 320);

  const steps = useMemo(() => buildSteps(t), [t]);
  const totalSteps = steps.length;
  const stepMeta = steps[currentStep];

  const passwordRules = {
    length: password.length >= 8,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordStrong =
    passwordRules.length &&
    passwordRules.hasLetter &&
    passwordRules.hasNumber &&
    passwordRules.hasSymbol;

  const selectedRole = useMemo(
    () => ROLES.find((item) => item.value === role) ?? ROLES[0],
    [role]
  );

  const handlePhoneChange = (value: string) => {
    const digits = normalizePhone(value);
    setPhone(digits.slice(0, 9));
  };

  const getDashboardRoute = (selectedRoleValue: UserRole) => {
    if (selectedRoleValue === "collector") return "/(collector)/assigned";
    if (selectedRoleValue === "admin") return "/(public)/get-started";
    return "/(tabs)";
  };

  useLayoutEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentStep, transition]);

  useEffect(() => {
    if (currentStep !== 1) {
      setPasswordFocused(false);
    }
  }, [currentStep]);

  const handleRegister = async () => {
    const normalizedNeighborhood = toPhoneStyleLocation(neighborhood.trim());
    if (!name.trim() || !email.trim() || !phone.trim() || !normalizedNeighborhood) {
      toast.error(t("Please fill in all fields"));
      return;
    }
    if (!isReasonablePhoneStyleLocation(normalizedNeighborhood)) {
      toast.error(t("Could not resolve location"));
      return;
    }
    if (!isValidEmail(email)) {
      toast.error(t("Please enter a valid email address"));
      return;
    }
    if (normalizePhone(phone).length !== 9) {
      toast.error(t("Phone number must be exactly 9 digits"));
      return;
    }
    if (!isPasswordStrong) {
      toast.error(t("Password must be at least 8 characters and include letters, numbers, and symbols"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("Passwords do not match"));
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsLoading(true);

    try {
      const result = await register(name, email, password, phone, role, normalizedNeighborhood);
      if (result.type === "collector_pending") {
        toast.success(t("Details submitted"));
        router.replace({
          pathname: "/(auth)/collector-submitted",
          params: {
            name: result.application.name,
            email: result.application.email,
            phone: result.application.phone ?? "",
            area: result.application.area ?? "",
            status: result.application.status,
            submittedAt: result.application.submittedAt ?? "",
          },
        });
        return;
      }

      toast.success(t("Account created"));
      router.replace(getDashboardRoute(result.user.role));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to create account");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = async (selectedRoleValue: UserRole) => {
    if (Platform.OS !== "web") {
      await Haptics.selectionAsync();
    }
    setRole(selectedRoleValue);
  };

  const handleNeighborhoodSelect = async (value: string) => {
    if (Platform.OS !== "web") {
      await Haptics.selectionAsync();
    }
    setNeighborhood(value);
    setShowNeighborhoods(false);
  };

  const handleUseLocation = async () => {
    try {
      setIsLocating(true);
      const captured = await captureCurrentDeviceLocation({
        requestPermission: true,
        includeLabel: true,
        allowCoordinateFallback: false,
        retries: 3,
      });
      if (!captured) {
        toast.error(t("Location permission denied"));
        return;
      }

      const label = stripLocationCode(captured.label).trim();
      if (label.length > 0) {
        setNeighborhood(label);
        setSuggestions([label]);
        setShowNeighborhoods(false);
        toast.success(t("Location captured"));
        return;
      }
      toast.error(t("Could not resolve location"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to get location");
      toast.error(message);
    } finally {
      setIsLocating(false);
    }
  };

  const validateStep = (step: number) => {
    if (step === 0) {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        toast.error(t("Please enter your name, email, and phone number"));
        return false;
      }
      if (!isValidEmail(email)) {
        toast.error(t("Please enter a valid email address"));
        return false;
      }
      if (normalizePhone(phone).length !== 9) {
        toast.error(t("Phone number must be exactly 9 digits"));
        return false;
      }
    }

    if (step === 1) {
      const normalizedNeighborhood = toPhoneStyleLocation(neighborhood.trim());
      if (!normalizedNeighborhood) {
        toast.error(t("Please choose your neighborhood"));
        return false;
      }
      if (!isReasonablePhoneStyleLocation(normalizedNeighborhood)) {
        toast.error(t("Could not resolve location"));
        return false;
      }
      if (!password || !confirmPassword) {
        toast.error(t("Please fill in all fields"));
        return false;
      }
      if (!isPasswordStrong) {
        toast.error(t("Password must be at least 8 characters and include letters, numbers, and symbols"));
        return false;
      }
      if (password !== confirmPassword) {
        toast.error(t("Passwords do not match"));
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }
    if (currentStep < totalSteps - 1) {
      setStepDirection(1);
      setCurrentStep((step) => step + 1);
      return;
    }
    void handleRegister();
  };

  const handleBack = () => {
    if (currentStep === 0) {
      return;
    }
    setStepDirection(-1);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const animatedStyle = {
    opacity: transition,
    transform: [
      {
        translateX: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [stepDirection * 24, 0],
        }),
      },
    ],
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <>
          <FloatingInput
            label={t("Full Name")}
            value={name}
            onChange={setName}
            icon="person-outline"
            autoComplete="name"
            testID="register-name"
          />

          <FloatingInput
            label={t("Email")}
            value={email}
            onChange={setEmail}
            type="email"
            icon="mail-outline"
            autoComplete="email"
            testID="register-email"
          />

          <FloatingInput
            label={t("Phone")}
            value={phone}
            onChange={handlePhoneChange}
            type="phone"
            icon="call-outline"
            autoComplete="tel"
            maxLength={9}
            testID="register-phone"
          />
        </>
      );
    }

    if (currentStep === 1) {
      return (
        <>
          <View style={styles.section}>
            <FloatingInput
              label={t("Neighborhood")}
              value={neighborhood}
              onChange={(text) => {
                setNeighborhood(text);
                setSuggestions([]);
                setShowNeighborhoods(false);
              }}
              icon="location-outline"
              rightAccessory={
                <Pressable
                  onPress={() => void handleUseLocation()}
                  disabled={isLocating}
                  style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={18}
                    color={isLocating ? colors.textSecondary : Colors.primary}
                  />
                </Pressable>
              }
              onFocus={() => setShowNeighborhoods(suggestions.length > 0)}
              testID="register-neighborhood"
            />
            {showNeighborhoods && suggestions.length > 0 && (
              <View
                style={[styles.dropdownList, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {suggestions.map((item) => (
                    <Pressable
                      key={item}
                      style={({ pressed }) => [
                        styles.dropdownItem,
                        neighborhood === item && { backgroundColor: Colors.primary + "10" },
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => void handleNeighborhoodSelect(item)}
                    >
                      <AppText color={colors.text}>{item}</AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {passwordFocused ? (
            <View style={[styles.passwordHint, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText variant="label" color={colors.textSecondary}>
                {t("Password must include:")}
              </AppText>
              <View style={styles.passwordHintRow}>
                <Ionicons
                  name={passwordRules.length ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={passwordRules.length ? Colors.success : colors.textSecondary}
                />
                <AppText variant="caption" color={colors.textSecondary}>
                  {t("At least 8 characters")}
                </AppText>
              </View>
              <View style={styles.passwordHintRow}>
                <Ionicons
                  name={passwordRules.hasLetter && passwordRules.hasNumber ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={passwordRules.hasLetter && passwordRules.hasNumber ? Colors.success : colors.textSecondary}
                />
                <AppText variant="caption" color={colors.textSecondary}>
                  {t("Letters and numbers")}
                </AppText>
              </View>
              <View style={styles.passwordHintRow}>
                <Ionicons
                  name={passwordRules.hasSymbol ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={passwordRules.hasSymbol ? Colors.success : colors.textSecondary}
                />
                <AppText variant="caption" color={colors.textSecondary}>
                  {t("A symbol like ! @ # $")}
                </AppText>
              </View>
            </View>
          ) : null}

          <FloatingInput
            label={t("Password")}
            value={password}
            onChange={setPassword}
            type="password"
            icon="lock-closed-outline"
            autoComplete="new-password"
            testID="register-password"
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />

          <FloatingInput
            label={t("Confirm Password")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            icon="shield-checkmark-outline"
            autoComplete="new-password"
            testID="register-confirm"
          />

          <View
            style={[
              styles.freeInfoCard,
              { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "30" },
            ]}
          >
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <View style={styles.freeInfoText}>
              <AppText variant="label" color={Colors.primary}>
                {t("Free access for residents")}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {t("No activation is required to request pickups and submit reports.")}
              </AppText>
            </View>
          </View>
        </>
      );
    }

    if (currentStep === 2) {
      return (
        <View style={styles.section}>
          <AppText variant="title" color={colors.text}>
            {t("Choose your role")}
          </AppText>
          {ROLES.map((roleItem) => {
            const isSelected = role === roleItem.value;
            return (
              <Pressable
                key={roleItem.value}
                style={({ pressed }) => [
                  styles.roleCard,
                  {
                    backgroundColor: isSelected ? Colors.primary + "10" : colors.surface,
                    borderColor: isSelected ? Colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => void handleRoleSelect(roleItem.value)}
              >
                <View style={[styles.roleIcon, { backgroundColor: Colors.primary + "15" }]}>
                  <Ionicons name={roleItem.icon as never} size={22} color={Colors.primary} />
                </View>
                <View style={styles.roleInfo}>
                  <AppText color={colors.text}>{t(roleItem.labelKey)}</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {t(roleItem.descriptionKey)}
                  </AppText>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      );
    }

    return (
      <>
        <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="title" color={colors.text}>
            {t("Please verify your details")}
          </AppText>

          <View style={styles.reviewRow}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Full Name")}
            </AppText>
            <AppText style={styles.reviewValue} color={colors.text}>
              {name.trim() || "--"}
            </AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Email")}
            </AppText>
            <AppText style={styles.reviewValue} color={colors.text}>
              {email.trim() || "--"}
            </AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Phone")}
            </AppText>
            <AppText style={styles.reviewValue} color={colors.text}>
              {phone.trim() || "--"}
            </AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Neighborhood")}
            </AppText>
            <AppText style={styles.reviewValue} color={colors.text}>
              {neighborhood.trim() || "--"}
            </AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Role")}
            </AppText>
            <AppText style={styles.reviewValue} color={colors.text}>
              {t(selectedRole.labelKey)}
            </AppText>
          </View>
        </View>

        <View
          style={[
            styles.reviewNotice,
            { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "30" },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
          <AppText variant="caption" color={colors.text} style={styles.reviewNoticeText}>
            {t("If these details are correct, tap Create Account to continue.")}
          </AppText>
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: contentMinHeight,
            paddingHorizontal: isSmallScreen ? 16 : 24,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
            justifyContent: contentJustify,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        <View style={[styles.shell, { minHeight: shellMinHeight }]}>
          <View style={[styles.mainContent, { gap: isSmallScreen ? 10 : 12 }]}>
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: Colors.primary + "15" }]}>
                <Image
                  source={require("../../assets/images/WasteTrack-transparent-matched.png")}
                  style={styles.logoMark}
                  resizeMode="contain"
                />
              </View>
              <AppText center color={colors.textSecondary}>
                {t("Join your community in keeping our neighborhood clean")}
              </AppText>
            </View>

            <View style={[styles.form, { gap: isSmallScreen ? 10 : 12 }]}>
              <View style={styles.stepper}>
                <AppText variant="overline" color={colors.textSecondary}>
                  {t("Step {current} of {total}", { current: currentStep + 1, total: totalSteps })}
                </AppText>
                <AppText variant="title" color={colors.text}>
                  {stepMeta.title}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {stepMeta.subtitle}
                </AppText>
                <View style={[styles.stepTrack, { backgroundColor: colors.surfaceSecondary }]}>
                  <View
                    style={[
                      styles.stepFill,
                      { width: `${((currentStep + 1) / totalSteps) * 100}%`, backgroundColor: Colors.primary },
                    ]}
                  />
                </View>
              </View>

              <View style={[styles.wizardBody, { minHeight: wizardFrameHeight }]}>
                <Animated.View style={[styles.stepPane, animatedStyle]}>
                  <ScrollView
                    style={styles.stepScroll}
                    contentContainerStyle={[
                      styles.stepContent,
                      currentStep === 1 && styles.stepContentCompact,
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {renderStepContent()}
                  </ScrollView>
                </Animated.View>
              </View>
            </View>
          </View>

          <View style={styles.actionWrap}>
            <View style={styles.navRow}>
              {currentStep > 0 && (
                <Button
                  variant="secondary"
                  label={t("Back")}
                  leftIcon="arrow-back"
                  onPress={handleBack}
                  disabled={isLoading}
                  style={styles.navButton}
                />
              )}
              <Button
                label={
                  currentStep === totalSteps - 1
                    ? isLoading
                      ? t("Creating...")
                      : t("Create Account")
                    : t("Continue")
                }
                rightIcon={
                  currentStep === totalSteps - 1 ? "checkmark" : "arrow-forward"
                }
                loading={isLoading}
                onPress={handleNext}
                testID="register-submit"
                style={styles.navButton}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <AppText color={colors.textSecondary}>{t("Already have an account?")}</AppText>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <AppText variant="label" color={Colors.primary}>
                  {t("Sign In")}
                </AppText>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    maxWidth: layout.shellMaxWidth,
    alignSelf: "center",
    justifyContent: "center",
  },
  mainContent: { justifyContent: "center" },
  bgGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(13,150,104,0.07)",
  },
  header: { alignItems: "center", gap: 8 },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoMark: { width: 78, height: 78 },
  form: { gap: 14 },
  wizardBody: { justifyContent: "flex-start", overflow: "hidden" },
  actionWrap: { marginTop: 0 },
  stepper: { gap: 4 },
  stepTrack: { height: 6, borderRadius: radius.full, overflow: "hidden", marginTop: 4 },
  stepFill: { height: "100%", borderRadius: radius.full },
  stepPane: { flex: 1 },
  stepScroll: { flex: 1 },
  stepContent: { gap: 14, paddingBottom: 0 },
  stepContentCompact: { gap: 6 },
  iconButton: { paddingHorizontal: 6, paddingVertical: 6 },
  section: { marginBottom: 2 },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  roleIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  roleInfo: { flex: 1, gap: 2 },
  dropdownList: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", marginTop: 6, maxHeight: 160 },
  dropdownItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm + 6 },
  freeInfoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  freeInfoText: { flex: 1, gap: 1 },
  reviewCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  reviewValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
  },
  reviewNotice: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewNoticeText: { flex: 1, lineHeight: 18 },
  navRow: { flexDirection: "row", gap: spacing.md, marginTop: 0 },
  navButton: { flex: 1 },
  passwordHint: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 8,
    gap: 3,
  },
  passwordHintRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    width: "100%",
  },
});