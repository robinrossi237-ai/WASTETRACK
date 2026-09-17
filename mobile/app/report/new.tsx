import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { WebView, WebViewMessageEvent } from "react-native-webview";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import FloatingInput from "@/components/FloatingInput";
import AddressSearchInput from "@/components/AddressSearchInput";
import LocationTrackingIndicator from "@/components/LocationTrackingIndicator";
import { useApp } from "@/lib/context";
import { useProtectedRoute } from "@/lib/navigation";
import { captureCurrentDeviceLocation } from "@/lib/device-location";
import { isReasonablePhoneStyleLocation, stripLocationCode, toPhoneStyleLocation } from "@/lib/location-label";
import { geocodeAddress, reverseGeocode } from "@/lib/logistics-map";
import type { ReportPriority } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";

type ReportType = "illegal_dumping" | "overflowing_bin" | "other";

const REPORT_TYPES: { value: ReportType; labelKey: string; icon: string; descriptionKey: string }[] = [
  {
    value: "illegal_dumping",
    labelKey: "Illegal Dumping",
    icon: "trash",
    descriptionKey: "Someone dumping waste in unauthorized areas",
  },
  {
    value: "overflowing_bin",
    labelKey: "Overflowing Bin",
    icon: "cube",
    descriptionKey: "Public bin that needs to be emptied",
  },
  { value: "other", labelKey: "Other Issue", icon: "alert-circle", descriptionKey: "Any other waste-related concern" },
];

const REPORT_STEPS = [
  {
    id: "details",
    titleKey: "Report details",
    subtitleKey: "Choose the issue type and location.",
  },
  {
    id: "evidence",
    titleKey: "Evidence",
    subtitleKey: "Add details and photo evidence.",
  },
  {
    id: "review",
    titleKey: "Review report",
    subtitleKey: "Confirm details before submitting.",
  },
];

export default function NewReportScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, createReport, isLoading: isAppLoading } = useApp();
  const toast = useToast();
  const hasPromptedAuth = useRef(false);
  const authState = useProtectedRoute(["resident"]);

  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [priority, setPriority] = useState<ReportPriority>("normal");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(user?.neighborhood || "");
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);
  const transition = useRef(new Animated.Value(1)).current;

  const steps = useMemo(
    () => REPORT_STEPS.map((step) => ({ ...step, title: t(step.titleKey), subtitle: t(step.subtitleKey) })),
    [t]
  );
  const totalSteps = steps.length;
  const stepMeta = steps[currentStep];

  useEffect(() => {
    if (user?.neighborhood && !location.trim()) {
      setLocation(user.neighborhood);
    }
  }, [user?.neighborhood, location]);

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
      t("Please sign in to submit a report."),
      [
        { text: t("Cancel"), style: "cancel", onPress: () => router.back() },
        { text: t("Sign In"), onPress: () => router.replace("/(auth)/login") },
      ],
    );
  }, [authState, isAppLoading, user, t]);

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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(resolvePickedImageUri(result.assets[0]));
      }
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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("Permission needed"), t("Camera permission is required to take photos"));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(resolvePickedImageUri(result.assets[0]));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Could not capture image. Please try again.");
      toast.error(message);
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === "web") {
      pickImage();
      return;
    }
    Alert.alert(
      t("Add Photo"),
      t("Choose an option"),
      [
        { text: t("Camera"), onPress: takePhoto },
        { text: t("Gallery"), onPress: pickImage },
        { text: t("Cancel"), style: "cancel" },
      ]
    );
  };

  const openMap = () => {
    if (Platform.OS === "web") {
      const query = encodeURIComponent(location || t("waste issue location"));
      const url = `https://www.openstreetmap.org/search?query=${query}`;
      Linking.openURL(url).catch(() => toast.error(t("Could not open map")));
    } else {
      setMapVisible(true);
    }
  };

  const mapHtml = useMemo(
    () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="initial-scale=1,maximum-scale=1">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <style>html,body,#map{height:100%;margin:0;padding:0}</style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const map = L.map('map').setView([4.05, 9.70], 12);
          L.tileLayer('https://tile.openfreemap.org/styles/liberty/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
          let marker = null;
          map.on('click', function(e){
            if (marker) { map.removeLayer(marker); }
            marker = L.marker(e.latlng).addTo(map);
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng }));
          });
        </script>
      </body>
      </html>
    `,
    []
  );

  const handleMapMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data || "{}") as { lat?: number; lng?: number };
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        setSelectedLat(data.lat);
        setSelectedLng(data.lng);
        const resolvedAddress = stripLocationCode(
          (await reverseGeocode({ lat: data.lat, lng: data.lng })) ?? ""
        ).trim();
        if (resolvedAddress.length > 0) {
          setLocation(resolvedAddress);
          toast.success(t("Location pinned"));
          setMapVisible(false);
          return;
        }
        toast.error(t("Could not resolve location"));
      }
    } catch {
      // ignore
    }
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
      setLocationAccuracy(
        typeof captured.accuracy === "number" && captured.accuracy > 0 ? captured.accuracy : null
      );
      const label = stripLocationCode(captured.label).trim();
      if (label.length > 0) {
        setLocation(label);
        toast.success(t("Location captured"));
        return;
      }
      toast.info(t("Location captured with approximate precision"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to get location"));
    } finally {
      setIsLocating(false);
    }
  };

  const resolveCoordinatesForSubmission = async (
    locationText: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    if (typeof selectedLat === "number" && typeof selectedLng === "number") {
      return { latitude: selectedLat, longitude: selectedLng };
    }

    try {
      const geocoded = await geocodeAddress(locationText);
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

  const handleSubmit = async () => {
    const trimmedLocation = toPhoneStyleLocation(location.trim());
    if (!reportType || !trimmedLocation) {
      toast.error(t("Please select a report type and enter location"));
      return;
    }
    if (!isReasonablePhoneStyleLocation(trimmedLocation)) {
      toast.error(t("Could not resolve location"));
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsSubmitting(true);

    try {
      const resolvedCoordinates = await resolveCoordinatesForSubmission(trimmedLocation);
      if (!resolvedCoordinates) {
        toast.error(t("Could not resolve location"));
        return;
      }
      await createReport({
        type: reportType,
        description,
        location: trimmedLocation,
        photoUri: photoUri || undefined,
        latitude: resolvedCoordinates.latitude,
        longitude: resolvedCoordinates.longitude,
        priority,
      });

      router.replace({
        pathname: "/report/submitted",
        params: {
          type: reportType,
          location: trimmedLocation,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to submit report");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeSelect = async (type: ReportType) => {
    if (Platform.OS !== "web") {
      await Haptics.selectionAsync();
    }
    setReportType(type);
  };

  const validateStep = (step: number) => {
    if (step === 0) {
      if (!reportType || !location.trim()) {
        toast.error(t("Please select a report type and enter location"));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps - 1) {
      setStepDirection(1);
      setCurrentStep((step) => step + 1);
      return;
    }
    void handleSubmit();
  };

  const handleBack = () => {
    if (currentStep === 0) return;
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
          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Issue Type *")}</AppText>
            {REPORT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={({ pressed }) => [
                  styles.typeCard,
                  { backgroundColor: reportType === type.value ? Colors.error + "10" : colors.surface },
                  { borderColor: reportType === type.value ? Colors.error : colors.border },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => handleTypeSelect(type.value)}
              >
                <View style={[styles.typeIcon, { backgroundColor: Colors.error + "15" }]}>
                  <Ionicons name={type.icon as never} size={24} color={Colors.error} />
                </View>
                <View style={styles.typeInfo}>
                  <AppText style={styles.typeLabel} color={colors.text}>{t(type.labelKey)}</AppText>
                  <AppText variant="caption" style={styles.typeDesc} color={colors.textSecondary}>
                    {t(type.descriptionKey)}
                  </AppText>
                </View>
                {reportType === type.value && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.error} />
                )}
              </Pressable>
            ))}
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Priority")}</AppText>
            <AppText variant="caption" style={styles.sectionSubtitle} color={colors.textSecondary}>
              {t("Flag urgent issues for faster attention")}
            </AppText>
            <View style={styles.priorityRow}>
              {([
                { value: "normal", label: t("Normal"), color: Colors.success, icon: "hourglass-outline" },
                { value: "high", label: t("High"), color: Colors.warning, icon: "alert-circle-outline" },
                { value: "emergency", label: t("Emergency"), color: Colors.error, icon: "warning-outline" },
              ] as const).map((option) => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.priorityChip,
                    {
                      borderColor: priority === option.value ? option.color : colors.border,
                      backgroundColor: priority === option.value ? option.color + "15" : colors.surface,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => setPriority(option.value)}
                >
                  <Ionicons
                    name={option.icon as never}
                    size={16}
                    color={priority === option.value ? option.color : colors.textSecondary}
                  />
                  <AppText
                    variant="label"
                    style={styles.priorityChipText}
                    color={priority === option.value ? option.color : colors.text}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Location *")}</AppText>
            <AddressSearchInput
              label={t("Location")}
              required
              value={location}
              onChange={(text) => {
                setLocation(text);
                setSelectedLat(null);
                setSelectedLng(null);
                setLocationAccuracy(null);
              }}
              onSelect={(suggestion) => {
                setLocation(suggestion.label);
                setSelectedLat(suggestion.latitude);
                setSelectedLng(suggestion.longitude);
                setLocationAccuracy(null);
                toast.success(t("Location selected"));
              }}
              icon="location-outline"
              rightAccessory={
                <View style={styles.accessoryRow}>
                  <Pressable onPress={() => void handleUseLocation()} disabled={isLocating} style={{ paddingHorizontal: 6 }}>
                    <Ionicons
                      name="navigate-outline"
                      size={18}
                      color={isLocating ? colors.textSecondary : Colors.primary}
                    />
                  </Pressable>
                  <Pressable onPress={openMap} style={{ paddingHorizontal: 6 }}>
                    <Ionicons name="map-outline" size={18} color={Colors.secondary} />
                  </Pressable>
                </View>
              }
            />
            {locationAccuracy != null ? (
              <View style={[styles.accuracyBadge, { borderColor: Colors.primary + "30", backgroundColor: Colors.primary + "0E" }]}>
                <Ionicons name="locate" size={12} color={Colors.primary} />
                <AppText variant="caption" style={styles.accuracyBadgeText} color={Colors.primary}>
                  {t("Accuracy ±{meters} m", { meters: Math.round(locationAccuracy) })}
                </AppText>
              </View>
            ) : null}
          </View>
        </>
      );
    }

    if (currentStep === 1) {
      return (
        <>
          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Description")}</AppText>
            <FloatingInput
              label={t("Description")}
              value={description}
              onChange={setDescription}
              multiline
              numberOfLines={4}
              style={{ backgroundColor: colors.surface }}
            />
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle} color={colors.text}>{t("Photo Evidence")}</AppText>
            {photoUri ? (
              <View style={[styles.imagePreview, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewActionRow}>
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
                    onPress={() => setPhotoUri(null)}
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
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={showImageOptions}
              >
                <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                <AppText style={styles.uploadText} color={colors.textSecondary}>
                  {t("Add a photo to help identify the issue")}
                </AppText>
              </Pressable>
            )}
          </View>
        </>
      );
    }

    const selectedReport = REPORT_TYPES.find((type) => type.value === reportType);
    const summaryDescription = description.trim();
    const summaryLocation = location.trim();

    return (
      <>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <AppText variant="overline" color={colors.textSecondary}>{t("Issue Type")}</AppText>
            <AppText style={styles.summaryValue} color={colors.text}>{selectedReport ? t(selectedReport.labelKey) : "--"}</AppText>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <AppText variant="overline" color={colors.textSecondary}>{t("Location")}</AppText>
            <AppText style={styles.summaryValue} color={colors.text}>{summaryLocation || "--"}</AppText>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <AppText variant="overline" color={colors.textSecondary}>{t("Description")}</AppText>
            <AppText style={styles.summaryValue} color={colors.text}>
              {summaryDescription || t("No additional description")}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle} color={colors.text}>{t("Photo Evidence")}</AppText>
          {photoUri ? (
            <View style={[styles.imagePreview, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
            </View>
          ) : (
            <View style={[styles.emptyPhotoBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
              <AppText style={styles.emptyPhotoText} color={colors.textSecondary}>
                {t("No photo added")}
              </AppText>
            </View>
          )}
        </View>
      </>
    );
  };

  if (isAppLoading && !user) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!user || authState === "loading") {
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BottomWhiteScent />
        <View style={[styles.infoCard, { backgroundColor: Colors.error + "10" }]}>
          <Ionicons name="megaphone" size={24} color={Colors.error} />
          <View style={styles.infoContent}>
            <AppText style={styles.infoTitle} color={Colors.error}>{t("Report an Issue")}</AppText>
            <AppText variant="caption" style={styles.infoText} color={colors.text}>
              {t("Help keep our community clean by reporting waste problems in your area.")}
            </AppText>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.stepper}>
            <AppText variant="overline" color={colors.textSecondary}>
              {t("Step {current} of {total}", { current: currentStep + 1, total: totalSteps })}
            </AppText>
            <AppText variant="title" style={styles.stepTitle} color={colors.text}>{stepMeta.title}</AppText>
            <AppText style={styles.stepSubtitle} color={colors.textSecondary}>{stepMeta.subtitle}</AppText>
            <View style={[styles.stepTrack, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.stepFill,
                  { width: `${((currentStep + 1) / totalSteps) * 100}%`, backgroundColor: Colors.error },
                ]}
              />
            </View>
          </View>

          <Animated.View style={[styles.stepContent, animatedStyle]}>
            {renderStepContent()}
          </Animated.View>

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
                { backgroundColor: Colors.error },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                isSubmitting && { opacity: 0.7 },
              ]}
              onPress={handleNext}
              disabled={isSubmitting}
              testID="submit-report-btn"
            >
              <AppText variant="button" style={styles.buttonText} color="#fff">
                {currentStep === totalSteps - 1
                  ? isSubmitting ? t("Submitting...") : t("Submit Report")
                  : t("Continue")}
              </AppText>
              <Ionicons
                name={currentStep === totalSteps - 1 ? "send" : "arrow-forward"}
                size={18}
                color="#fff"
              />
            </Pressable>
          </View>
        </View>

        <Modal visible={mapVisible} animationType="slide">
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={styles.mapHeader}>
              <AppText style={styles.mapHeaderTitle} color={colors.text}>
                {t("Search on map")}
              </AppText>
              <Pressable onPress={() => setMapVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <WebView originWhitelist={["*"]} source={{ html: mapHtml }} onMessage={handleMapMessage} />
            </View>
            <View style={styles.mapFooter}>
              <AppText variant="caption" color={colors.textSecondary}>
                {t("Tap anywhere on the map to drop a pin and fill the location.")}
              </AppText>
            </View>
          </View>
        </Modal>
      </ScrollView>

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
  infoCard: { flexDirection: "row", padding: spacing.lg, borderRadius: radius.xl, gap: spacing.md, marginBottom: spacing.xxl },
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
  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontSize: fontSizes.button, fontFamily: fonts.semibold, marginBottom: 10 },
  sectionSubtitle: { marginBottom: spacing.md, marginTop: -6 },
  priorityRow: { flexDirection: "row", gap: spacing.sm },
  priorityChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  priorityChipText: { fontSize: fontSizes.sm },
  typeCard: { flexDirection: "row", alignItems: "center", padding: spacing.md + 2, borderRadius: radius.lg, borderWidth: 2, marginBottom: spacing.sm, gap: spacing.md },
  typeIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  typeInfo: { flex: 1 },
  typeLabel: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  typeDesc: { marginTop: 2 },
  accessoryRow: { flexDirection: "row", alignItems: "center" },
  uploadButton: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  uploadText: { fontSize: fontSizes.md, fontFamily: fonts.medium, textAlign: "center" },
  imagePreview: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 10,
  },
  previewImage: { width: "100%", height: 220, borderRadius: radius.md },
  previewActionRow: { flexDirection: "row", gap: 10 },
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
  previewActionText: { fontSize: fontSizes.xs },
  accuracyBadge: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  accuracyBadgeText: { fontFamily: fonts.semibold },
  summaryCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
  },
  summaryRow: {
    gap: 6,
  },
  summaryValue: { fontSize: fontSizes.md, fontFamily: fonts.medium, lineHeight: 20 },
  summaryDivider: { height: 1, marginVertical: spacing.md },
  emptyPhotoBox: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: spacing.sm,
  },
  emptyPhotoText: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  navRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  primaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.lg },
  secondaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  buttonText: { fontSize: fontSizes.body },
  mapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md },
  mapHeaderTitle: { fontSize: fontSizes.button, fontFamily: fonts.semibold },
  mapFooter: { padding: spacing.md },
});