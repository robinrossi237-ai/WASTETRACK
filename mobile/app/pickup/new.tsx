import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import FloatingInput from "@/components/FloatingInput";
import AddressSearchInput from "@/components/AddressSearchInput";
import LocationTrackingIndicator from "@/components/LocationTrackingIndicator";
import { useApp } from "@/lib/context";
import { useProtectedRoute } from "@/lib/navigation";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { useLanguage } from "@/lib/language-context";
import { isReasonablePhoneStyleLocation, stripLocationCode, toPhoneStyleLocation } from "@/lib/location-label";
import { geocodeAddress } from "@/lib/logistics-map";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { WASTE_TYPES, type WasteType } from "@/lib/types";

const padTime = (value: number) => String(value).padStart(2, "0");

const formatIsoDate = (date: Date) =>
  `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

const formatDisplayDate = (value: string, locale?: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString(locale ?? undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDisplayTime = (value: string, locale?: string): string => {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(locale ?? undefined, { hour: "2-digit", minute: "2-digit" });
};

const TIME_WINDOWS = [
  { value: "08:00", labelKey: "8 AM - 10 AM" },
  { value: "10:00", labelKey: "10 AM - 12 PM" },
  { value: "14:00", labelKey: "2 PM - 4 PM" },
];

const PICKUP_STEPS = [
  {
    id: "details",
    titleKey: "Pickup details",
    subtitleKey: "Choose the waste type, location and add a waste photo.",
  },
  {
    id: "schedule",
    titleKey: "Schedule Pickup",
    subtitleKey: "Choose your preferred pickup date and time.",
  },
  {
    id: "review",
    titleKey: "Review Request",
    subtitleKey: "Review details before you submit.",
  },
];

type FieldErrors = Partial<{
  wasteType: string;
  address: string;
  photoUri: string;
  scheduledDate: string;
  scheduledTime: string;
}>;

export default function NewPickupScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user, pickupQuota, createPickup, isLoading: isAppLoading, schedulePreference } = useApp();
  const toast = useToast();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const hasPromptedAuth = useRef(false);
  const authState = useProtectedRoute(["resident"]);

  const [wasteType, setWasteType] = useState<WasteType | null>(null);
  const [address, setAddress] = useState(user?.neighborhood ?? "");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState(schedulePreference?.timeWindow ?? "");
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [quotaModalVisible, setQuotaModalVisible] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const initial = parseIsoDate(scheduledDate) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  const transition = useRef(new Animated.Value(1)).current;

  const steps = useMemo(
    () =>
      PICKUP_STEPS.map((step) => ({
        ...step,
        title: t(step.titleKey),
        subtitle: t(step.subtitleKey),
      })),
    [t]
  );
  const totalSteps = steps.length;
  const stepMeta = steps[currentStep];

  useLayoutEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentStep, transition]);

  useEffect(() => {
    if (!schedulePreference?.timeWindow) return;
    setScheduledTime((current) => current || schedulePreference.timeWindow || "");
  }, [schedulePreference?.timeWindow]);

  useEffect(() => {
    if (user?.neighborhood && !address.trim()) {
      setAddress(user.neighborhood);
    }
  }, [user?.neighborhood, address]);

  useEffect(() => {
    if (isAppLoading) return;
    if (authState === "granted") return;
    if (hasPromptedAuth.current) return;

    if (authState === "forbidden" && user && user.role !== "resident") {
      router.replace("/(collector)/assigned");
      return;
    }
    hasPromptedAuth.current = true;

    if (Platform.OS === "web") {
      router.replace("/(auth)/login");
      return;
    }

    Alert.alert(
      t("Sign in required"),
      t("Please sign in to submit a pickup request."),
      [
        { text: t("Cancel"), style: "cancel", onPress: () => router.back() },
        { text: t("Sign In"), onPress: () => router.replace("/(auth)/login") },
      ]
    );
  }, [authState, isAppLoading, t, user]);

  const clearFieldError = (name: keyof FieldErrors) => {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const resolvePickedImageUri = (asset: ImagePicker.ImagePickerAsset) => {
    const mimeType =
      typeof asset.mimeType === "string" && asset.mimeType
        ? asset.mimeType
        : "image/jpeg";
    if (asset.base64 && asset.base64.trim().length > 0) {
      return `data:${mimeType};base64,${asset.base64.replace(/\s+/g, "")}`;
    }
    return asset.uri;
  };

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      setPhotoUri(resolvePickedImageUri(result.assets[0]));
      clearFieldError("photoUri");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Could not read selected image. Please choose another photo.");
      toast.error(message);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        toast.error(t("Camera permission denied"));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      setPhotoUri(resolvePickedImageUri(result.assets[0]));
      clearFieldError("photoUri");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Could not capture image. Please try again.");
      toast.error(message);
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === "web") {
      void pickImage();
      return;
    }
    Alert.alert(t("Add waste photo"), t("Choose an option"), [
      { text: t("Take Photo"), onPress: () => void takePhoto() },
      { text: t("Choose from Library"), onPress: () => void pickImage() },
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const handleUseLocation = async () => {
    try {
      setIsLocating(true);
      const captured = await captureCurrentDeviceLocation({
        requestPermission: true,
        includeLabel: true,
        allowCoordinateFallback: true,
        retries: 3,
      });
      if (!captured) {
        toast.error(t("Location permission denied"));
        return;
      }

      setSelectedLat(captured.latitude);
      setSelectedLng(captured.longitude);
      clearFieldError("address");

      const label = stripLocationCode(captured.label).trim();
      if (label.length > 0) {
        setAddress(label);
        toast.success(t("Location captured"));
        return;
      }

      setAddress(address.trim() || `${captured.latitude.toFixed(5)}, ${captured.longitude.toFixed(5)}`);
      toast.info(t("Location captured with approximate precision"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to get location");
      toast.error(message);
    } finally {
      setIsLocating(false);
    }
  };

  const validateStep = (step: number) => {
    const nextErrors: FieldErrors = {};

    if (step === 0) {
      if (!wasteType) nextErrors.wasteType = t("Please select a waste type.");
      if (!address.trim()) nextErrors.address = t("Please provide the pickup address.");
      if (!photoUri) nextErrors.photoUri = t("Please upload a waste photo.");
    }

    if (step === 1) {
      if (!scheduledDate.trim()) nextErrors.scheduledDate = t("Please choose a pickup date.");
      if (!scheduledTime.trim()) nextErrors.scheduledTime = t("Please choose a pickup time.");
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      if (step === 0) {
        toast.error(t("Please complete waste, address, and photo details."));
      } else if (step === 1) {
        toast.error(t("Please choose a pickup schedule."));
      }
      return false;
    }
    return true;
  };

  const resolveCoordinatesForSubmission = async (
    addressText: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    if (typeof selectedLat === "number" && typeof selectedLng === "number") {
      return { latitude: selectedLat, longitude: selectedLng };
    }

    try {
      const geocoded = await geocodeAddress(addressText);
      if (geocoded) {
        setSelectedLat(geocoded.coordinate.lat);
        setSelectedLng(geocoded.coordinate.lng);
        return { latitude: geocoded.coordinate.lat, longitude: geocoded.coordinate.lng };
      }
    } catch {
      // Best effort only.
    }

    return null;
  };

  const submitPickup = async () => {
    if (!wasteType || !photoUri) return;

    const hasCapturedCoords =
      typeof selectedLat === "number" &&
      typeof selectedLng === "number" &&
      Number.isFinite(selectedLat) &&
      Number.isFinite(selectedLng);

    const rawAddress = address.trim();

    if (!hasCapturedCoords) {
      const normalizedAddress = toPhoneStyleLocation(rawAddress);
      if (!isReasonablePhoneStyleLocation(normalizedAddress)) {
        toast.error(t("Could not resolve location"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const resolvedCoordinates = await resolveCoordinatesForSubmission(rawAddress);
      if (!resolvedCoordinates) {
        toast.error(t("Could not resolve location"));
        return;
      }
      const normalizedAddress = toPhoneStyleLocation(rawAddress) || rawAddress;
      const resolvedLat = hasCapturedCoords ? (selectedLat as number) : resolvedCoordinates.latitude;
      const resolvedLng = hasCapturedCoords ? (selectedLng as number) : resolvedCoordinates.longitude;

      await createPickup({
        wasteType,
        description: notes.trim(),
        photoUri,
        pickupCategory: wasteType === "hazardous" || wasteType === "electronic" ? "hazardous" : "standard",
        scheduledDate,
        scheduledTime,
        address: normalizedAddress,
        latitude: resolvedLat,
        longitude: resolvedLng,
      });

      toast.success(t("Pickup request submitted"), {
        message: t("A nearby collector will be notified and you will get an update as soon as one accepts."),
      });

      router.replace({
        pathname: "/pickup/confirmed",
        params: {
          address: normalizedAddress,
          scheduledDate,
          scheduledTime,
          wasteType,
        },
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "PICKUP_QUOTA_EXCEEDED") {
        setQuotaModalVisible(true);
      } else {
        const message = err instanceof Error ? err.message : t("Could not submit pickup request");
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStep < totalSteps - 1) {
      setStepDirection(1);
      setCurrentStep((step) => step + 1);
      return;
    }

    void submitPickup();
  };

  const handleBack = () => {
    if (currentStep === 0) return;
    setStepDirection(-1);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        slots.push(`${padTime(hour)}:${padTime(minutes)}`);
      }
    }
    return slots;
  }, []);

  const calendarDays = useMemo(() => {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let index = 0; index < startWeekday; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [calendarCursor]);

  const weekdayLabels = useMemo(
    () => [t("Sun"), t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat")],
    [t]
  );

  const openDatePicker = () => {
    const base = parseIsoDate(scheduledDate) ?? new Date();
    setCalendarCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setDatePickerVisible(true);
  };

  const handleSelectDate = (date: Date) => {
    setScheduledDate(formatIsoDate(date));
    clearFieldError("scheduledDate");
    setDatePickerVisible(false);
  };

  const handleSelectTime = (time: string) => {
    setScheduledTime(time);
    clearFieldError("scheduledTime");
    setTimePickerVisible(false);
  };

  const selectedWasteLabel = wasteType ? t(WASTE_TYPES.find((item) => item.type === wasteType)?.label ?? "") : "--";
  const selectedDateLabel = scheduledDate ? formatDisplayDate(scheduledDate, locale) : "--";
  const selectedTimeLabel = scheduledTime ? formatDisplayTime(scheduledTime, locale) : "--";

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
          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Waste type *")}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wasteCarousel}>
              {WASTE_TYPES.map((item) => {
                const selected = wasteType === item.type;
                return (
                  <Pressable
                    key={item.type}
                    style={({ pressed }) => [
                      styles.wasteCard,
                      {
                        borderColor: selected ? item.color : colors.border,
                        backgroundColor: selected ? item.color + "12" : colors.surface,
                      },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={async () => {
                      if (Platform.OS !== "web") {
                        await Haptics.selectionAsync();
                      }
                      setWasteType(item.type);
                      clearFieldError("wasteType");
                    }}
                  >
                    <Ionicons name={item.icon as never} size={24} color={item.color} />
                    <AppText style={styles.wasteLabel} color={colors.text}>{t(item.label)}</AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {fieldErrors.wasteType ? <AppText variant="caption" style={styles.fieldError} color={Colors.error}>{fieldErrors.wasteType}</AppText> : null}
          </View>

          <View style={styles.section}>
            <AddressSearchInput
              label={t("Pickup address")}
              required
              value={address}
              onChange={(value) => {
                setAddress(value);
                setSelectedLat(null);
                setSelectedLng(null);
                clearFieldError("address");
              }}
              onSelect={(suggestion) => {
                setAddress(suggestion.label);
                setSelectedLat(suggestion.latitude);
                setSelectedLng(suggestion.longitude);
                clearFieldError("address");
                toast.success(t("Location selected"));
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
            />
            {fieldErrors.address ? <AppText variant="caption" style={styles.fieldError} color={Colors.error}>{fieldErrors.address}</AppText> : null}
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Waste photo *")}</AppText>
            {photoUri ? (
              <View style={[styles.imagePreviewCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.previewActionButton,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={showImageOptions}
                  >
                    <Ionicons name="refresh-outline" size={15} color={Colors.primary} />
                    <AppText variant="label" style={styles.previewActionText} color={colors.text}>{t("Replace photo")}</AppText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.previewActionButton,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={() => {
                      setPhotoUri(null);
                      clearFieldError("photoUri");
                    }}
                  >
                    <Ionicons name="trash-outline" size={15} color={Colors.error} />
                    <AppText variant="label" style={styles.previewActionText} color={colors.text}>{t("Remove")}</AppText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={showImageOptions}
              >
                <Ionicons name="camera-outline" size={26} color={Colors.primary} />
                <AppText style={styles.uploadText} color={colors.text}>{t("Add waste photo")}</AppText>
              </Pressable>
            )}
            {fieldErrors.photoUri ? <AppText variant="caption" style={styles.fieldError} color={Colors.error}>{fieldErrors.photoUri}</AppText> : null}
          </View>

          <View style={styles.section}>
            <FloatingInput
              label={t("Pickup note (optional)")}
              value={notes}
              onChange={setNotes}
              icon="create-outline"
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />
          </View>
        </>
      );
    }

    if (currentStep === 1) {
      return (
        <>
          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Pickup date *")}</AppText>
            <Pressable
              style={({ pressed }) => [
                styles.selectCard,
                { borderColor: colors.border, backgroundColor: colors.surface },
                pressed && { opacity: 0.9 },
              ]}
              onPress={openDatePicker}
            >
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              <AppText style={styles.selectCardText} color={scheduledDate ? colors.text : colors.textSecondary}>
                {scheduledDate ? formatDisplayDate(scheduledDate, locale) : t("Select pickup date")}
              </AppText>
            </Pressable>
            {fieldErrors.scheduledDate ? <AppText variant="caption" style={styles.fieldError} color={Colors.error}>{fieldErrors.scheduledDate}</AppText> : null}
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Pickup time *")}</AppText>
            <View style={styles.timeWindowList}>
              {TIME_WINDOWS.map((slot) => {
                const selected = scheduledTime === slot.value;
                return (
                  <Pressable
                    key={slot.value}
                    style={({ pressed }) => [
                      styles.timeWindowCard,
                      {
                        borderColor: selected ? Colors.primary : colors.border,
                        backgroundColor: selected ? Colors.primary + "12" : colors.surface,
                      },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={async () => {
                      if (Platform.OS !== "web") {
                        await Haptics.selectionAsync();
                      }
                      setScheduledTime(slot.value);
                      clearFieldError("scheduledTime");
                    }}
                  >
                    <AppText style={styles.timeWindowLabel} color={colors.text}>{t(slot.labelKey)}</AppText>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={selected ? Colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.customTimeButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => setTimePickerVisible(true)}
            >
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <AppText variant="caption" style={styles.customTimeText} color={colors.textSecondary}>
                {t("Choose a custom time")} {scheduledTime ? `(${formatDisplayTime(scheduledTime, locale)})` : ""}
              </AppText>
            </Pressable>
            {fieldErrors.scheduledTime ? <AppText variant="caption" style={styles.fieldError} color={Colors.error}>{fieldErrors.scheduledTime}</AppText> : null}
          </View>
        </>
      );
    }

    return (
      <>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <AppText variant="caption" style={styles.summaryLabel} color={colors.textSecondary}>{t("Waste type")}</AppText>
            <AppText variant="label" style={styles.summaryValue} color={colors.text}>{selectedWasteLabel}</AppText>
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" style={styles.summaryLabel} color={colors.textSecondary}>{t("Address")}</AppText>
            <AppText variant="label" style={styles.summaryValue} color={colors.text}>{address.trim() || "--"}</AppText>
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" style={styles.summaryLabel} color={colors.textSecondary}>{t("Date")}</AppText>
            <AppText variant="label" style={styles.summaryValue} color={colors.text}>{selectedDateLabel}</AppText>
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" style={styles.summaryLabel} color={colors.textSecondary}>{t("Time")}</AppText>
            <AppText variant="label" style={styles.summaryValue} color={colors.text}>{selectedTimeLabel}</AppText>
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" style={styles.summaryLabel} color={colors.textSecondary}>{t("Photo")}</AppText>
            <AppText variant="label" style={styles.summaryValue} color={colors.text}>{photoUri ? t("Attached") : "--"}</AppText>
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" style={styles.summaryLabel} color={colors.textSecondary}>{t("Note")}</AppText>
            <AppText variant="label" style={styles.summaryValue} color={colors.text}>{notes.trim() || "--"}</AppText>
          </View>
        </View>

        <View style={[styles.nextCard, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "25" }]}>
          <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
          <AppText variant="caption" style={styles.nextCardText} color={colors.text}>
            {t("After submission, the closest available collector will be notified automatically.")}
          </AppText>
        </View>
      </>
    );
  };

  if (authState === "loading") {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.infoCard, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "20" }]}>
          <Ionicons name="leaf-outline" size={24} color={Colors.primary} />
          <View style={styles.infoContent}>
            <AppText style={styles.infoTitle} color={Colors.primary}>{t("Free pickup request")}</AppText>
            <AppText variant="caption" style={styles.infoText} color={colors.text}>
              {t("Submitting a pickup request is free. Add your waste details and schedule a time.")}
            </AppText>
          </View>
        </View>

        {pickupQuota && !pickupQuota.isUnlimited && (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor:
                  (pickupQuota.remaining ?? 0) > 0
                    ? Colors.primary + "10"
                    : "#FEF2F2",
                borderColor:
                  (pickupQuota.remaining ?? 0) > 0
                    ? Colors.primary + "20"
                    : "#FECACA",
              },
            ]}
          >
            <Ionicons
              name={(pickupQuota.remaining ?? 0) > 0 ? "flash-outline" : "warning-outline"}
              size={22}
              color={(pickupQuota.remaining ?? 0) > 0 ? Colors.accent : "#EF4444"}
            />
            <View style={styles.infoContent}>
              <AppText
                style={[
                  styles.infoTitle,
                  {
                    color:
                      (pickupQuota.remaining ?? 0) > 0 ? Colors.accent : "#DC2626",
                  },
                ]}
              >
                {t("Free plan: {remaining} of {limit} pickups left this month", {
                  remaining: String(pickupQuota.remaining ?? 0),
                  limit: String(pickupQuota.limit ?? 0),
                })}
              </AppText>
              {(pickupQuota.remaining ?? 0) === 0 && (
                <AppText variant="caption" style={styles.infoText} color="#991B1B">
                  {t("You have reached your monthly limit. Subscribe for unlimited pickups.")}
                </AppText>
              )}
            </View>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.stepper}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("STEP {current} OF {total}", { current: currentStep + 1, total: totalSteps })}
            </AppText>
            <AppText variant="title" style={styles.stepTitle} color={colors.text}>{stepMeta.title}</AppText>
            <AppText style={styles.stepSubtitle} color={colors.textSecondary}>{stepMeta.subtitle}</AppText>
            <View style={[styles.stepTrack, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.stepFill,
                  { width: `${((currentStep + 1) / totalSteps) * 100}%`, backgroundColor: Colors.primary },
                ]}
              />
            </View>
          </View>

          <Animated.View style={[styles.stepContent, animatedStyle]}>{renderStepContent()}</Animated.View>

          <View style={styles.navRow}>
            {currentStep > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                  isSubmitting && { opacity: 0.7 },
                ]}
                onPress={handleBack}
                disabled={isSubmitting}
              >
                <Ionicons name="arrow-back" size={18} color={colors.text} />
                <AppText variant="button" style={styles.buttonText} color={colors.text}>{t("Back")}</AppText>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: Colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                isSubmitting && { opacity: 0.7 },
              ]}
              onPress={handleNext}
              disabled={isSubmitting}
              testID="submit-pickup-btn"
            >
              <AppText variant="button" style={styles.buttonText} color="#fff">
                {currentStep === totalSteps - 1 ? (isSubmitting ? t("Submitting...") : t("Submit Request")) : t("Continue")}
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal visible={datePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalNavBtn}
                onPress={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <AppText style={styles.modalTitle} color={colors.text}>
                {calendarCursor.toLocaleDateString(locale, { month: "long", year: "numeric" })}
              </AppText>
              <Pressable
                style={styles.modalNavBtn}
                onPress={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {weekdayLabels.map((day) => (
                <AppText key={day} variant="caption" style={styles.weekdayText} color={colors.textSecondary}>
                  {day}
                </AppText>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isDisabled = !day || day < today;
                const isSelected = day && scheduledDate && formatIsoDate(day) === scheduledDate;

                return (
                  <Pressable
                    key={`${day?.toISOString() ?? "empty"}-${index}`}
                    style={({ pressed }) => [
                      styles.calendarCell,
                      isSelected && { backgroundColor: Colors.primary },
                      pressed && !isDisabled && { opacity: 0.85 },
                    ]}
                    onPress={() => day && !isDisabled && handleSelectDate(day)}
                    disabled={isDisabled}
                  >
                    <AppText
                      style={[
                        styles.calendarCellText,
                        { color: isDisabled ? colors.textSecondary : colors.text },
                        isSelected && { color: "#fff" },
                      ]}
                    >
                      {day ? day.getDate() : ""}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalSecondaryBtn} onPress={() => setDatePickerVisible(false)}>
                <AppText style={styles.modalSecondaryText} color={colors.textSecondary}>{t("Close")}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryBtn, { backgroundColor: Colors.primary }]}
                onPress={() => handleSelectDate(new Date())}
              >
                <AppText variant="label" style={styles.modalPrimaryText} color="#fff">{t("Today")}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={timePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle} color={colors.text}>{t("Select time")}</AppText>
              <Pressable style={styles.modalNavBtn} onPress={() => setTimePickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.timeList} contentContainerStyle={{ paddingBottom: 6 }}>
              {timeSlots.map((slot) => {
                const selected = scheduledTime === slot;
                return (
                  <Pressable
                    key={slot}
                    style={({ pressed }) => [
                      styles.timeSlot,
                      selected && { backgroundColor: Colors.primary + "18" },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => handleSelectTime(slot)}
                  >
                    <AppText style={styles.timeSlotText} color={selected ? Colors.primary : colors.text}>
                      {formatDisplayTime(slot, locale)}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={quotaModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, maxWidth: 380 }]}>
            <View style={[styles.modalHeader, { marginBottom: spacing.md }]}>
              <Ionicons name="warning" size={28} color="#EF4444" />
              <Pressable style={styles.modalNavBtn} onPress={() => setQuotaModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <AppText style={[styles.modalTitle, { fontSize: 18, marginBottom: spacing.sm }]} color={colors.text}>
              {t("Monthly pickup limit reached")}
            </AppText>
            <AppText variant="caption" style={[styles.infoText, { marginBottom: 20 }]} color={colors.textSecondary}>
              {t(
                "You have used all {limit} free pickups this month. Upgrade to Plus or Pro for unlimited pickups.",
                { limit: String(pickupQuota?.limit ?? 3) },
              )}
            </AppText>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}
                onPress={() => setQuotaModalVisible(false)}
              >
                <AppText variant="label" style={styles.modalPrimaryText} color={colors.text}>{t("Later")}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryBtn, { backgroundColor: Colors.primary, flex: 1 }]}
                onPress={() => {
                  setQuotaModalVisible(false);
                  router.push("/profile/settings");
                }}
              >
                <AppText variant="label" style={styles.modalPrimaryText} color="#fff">{t("View plans")}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <LocationTrackingIndicator
        visible={isLocating}
        overlay
        variants={[
          t("Acquiring your location…"),
          t("Detecting nearby streets…"),
          t("Confirming your position…"),
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, width: "100%", maxWidth: 720, alignSelf: "center" },
  infoCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold, marginBottom: 4 },
  infoText: { fontSize: fontSizes.sm, lineHeight: 18 },
  form: { gap: 18 },
  stepper: { gap: 6 },
  stepTitle: { fontFamily: fonts.semibold },
  stepSubtitle: { fontSize: fontSizes.md },
  stepTrack: { height: 6, borderRadius: radius.full, overflow: "hidden", marginTop: 6 },
  stepFill: { height: "100%", borderRadius: radius.full },
  stepContent: { gap: spacing.lg },
  section: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSizes.button, fontFamily: fonts.semibold, marginBottom: 10 },
  fieldError: { marginTop: spacing.sm, fontFamily: fonts.medium },
  wasteCarousel: { flexDirection: "row", gap: spacing.md, paddingVertical: 4, paddingHorizontal: 2 },
  wasteCard: {
    width: 120,
    height: 120,
    borderRadius: radius.xxl,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  wasteLabel: { fontFamily: fonts.medium, textAlign: "center" },
  uploadButton: {
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm,
  },
  uploadText: { fontSize: fontSizes.md, fontFamily: fonts.medium, textAlign: "center" },
  imagePreviewCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 10,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
  },
  previewActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  previewActionButton: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewActionText: {
    fontSize: fontSizes.xs,
  },
  notesInput: {
    minHeight: 86,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconButton: { paddingHorizontal: 6, paddingVertical: 6 },
  selectCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectCardText: { fontSize: fontSizes.md, fontFamily: fonts.medium, flex: 1 },
  timeWindowList: { gap: 10 },
  timeWindowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  timeWindowLabel: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  customTimeButton: {
    marginTop: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  customTimeText: { fontFamily: fonts.medium },
  summaryCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.md + 2,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", gap: 10, justifyContent: "space-between", alignItems: "flex-start" },
  summaryLabel: { fontFamily: fonts.medium, width: 90 },
  summaryValue: { fontSize: fontSizes.sm, flex: 1, textAlign: "right" },
  nextCard: {
    marginTop: 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  nextCardText: { flex: 1, fontFamily: fonts.medium, lineHeight: 18 },
  navRow: { flexDirection: "row", gap: spacing.md + 2, marginTop: spacing.md },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.full,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  buttonText: { fontSize: fontSizes.body },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSizes.button,
    fontFamily: fonts.semibold,
  },
  modalNavBtn: {
    padding: 6,
    borderRadius: radius.lg,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  weekdayText: {
    width: "14.2%",
    textAlign: "center",
    fontFamily: fonts.medium,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.2%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    marginBottom: 6,
  },
  calendarCellText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  modalSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  modalSecondaryText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
  },
  modalPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  modalPrimaryText: {
    color: "#fff",
    fontSize: fontSizes.md,
  },
  timeList: { maxHeight: 280 },
  timeSlot: {
    paddingVertical: spacing.md,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  timeSlotText: {
    fontFamily: fonts.medium,
  },
});