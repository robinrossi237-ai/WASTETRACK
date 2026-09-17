import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import FloatingInput from "@/components/FloatingInput";
import { AppText } from "@/components/ui/AppText";
import {
  collectorApi,
  getCollectorQueuedActionCount,
  syncCollectorActionQueue,
  type CollectorAssignment,
  type CollectorWasteReport
} from "@/lib/collector-api";
import { useLanguage } from "@/lib/language-context";
import { normalizeMediaUrl } from "@/lib/media-url";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

const ISSUE_REASONS = [
  { value: "Cannot access location", labelKey: "Cannot access location" },
  { value: "Resident not available", labelKey: "Resident not available" },
  { value: "Hazardous situation", labelKey: "Hazardous situation" },
  { value: "Wrong address", labelKey: "Wrong address" },
];

export default function CollectorDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const isFocused = useIsFocused();
  const toast = useToast();
  const locale = language === "fr" ? "fr-FR" : "en-US";

  const params = useLocalSearchParams<{ id?: string | string[]; kind?: string | string[] }>();
  const assignmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const kindParam = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind: "pickup" | "report" = kindParam === "report" ? "report" : "pickup";

  const [assignment, setAssignment] = useState<CollectorAssignment | null>(null);
  const [report, setReport] = useState<CollectorWasteReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [completionPhotoUri, setCompletionPhotoUri] = useState<string | null>(null);
  const didHydrateCompletion = useRef(false);
  const [cleanupNote, setCleanupNote] = useState("");
  const [cleanupPhotoUri, setCleanupPhotoUri] = useState<string | null>(null);
  const didHydrateCleanup = useRef(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queuedActionsCount, setQueuedActionsCount] = useState<number>(0);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      if (kind === "report") {
        const r = await collectorApi.getReport(assignmentId);
        setReport(r);
        setAssignment(null);

        if (!didHydrateCleanup.current) {
          didHydrateCleanup.current = true;
          setCleanupNote(r.cleaned_note ?? "");
          setCleanupPhotoUri(r.cleaned_photo_url ?? null);
        }
      } else {
        const a = await collectorApi.getAssignment(assignmentId);
        setAssignment(a);
        setReport(null);

        if (!didHydrateCompletion.current) {
          didHydrateCompletion.current = true;
          setCompletionNote(a.completion_note ?? "");
          setCompletionPhotoUri(a.completion_photo_url ?? null);
        }
      }
      setLastSyncedAt(new Date().toISOString());
      setQueuedActionsCount(await getCollectorQueuedActionCount());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to load task"));
    } finally {
      setLoading(false);
    }
  }, [assignmentId, kind, t, toast]);

  useEffect(() => {
    didHydrateCompletion.current = false;
    didHydrateCleanup.current = false;
    setCompletionNote("");
    setCompletionPhotoUri(null);
    setCleanupNote("");
    setCleanupPhotoUri(null);
  }, [assignmentId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    enabled: !!assignmentId && isFocused,
    onRefresh: load,
    pollMs: 20_000,
    eventTypes: ["assignment.updated", "pickup.updated", "report.updated"],
  });

  useEffect(() => {
    if (assignmentId) return;
    router.replace("/(collector)/assigned");
  }, [assignmentId]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setIsOnline(true);
      return;
    }
    if (typeof window === "undefined") {
      setIsOnline(true);
      return;
    }

    const updateOnlineStatus = () => setIsOnline(window.navigator.onLine);
    updateOnlineStatus();

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const openExternalNavigation = async () => {
    const address = kind === "report" ? report?.location_text : assignment?.address;
    const lat = kind === "report" ? report?.latitude : assignment?.latitude;
    const lng = kind === "report" ? report?.longitude : assignment?.longitude;
    if (!address && (lat == null || lng == null)) return;

    const destination = address ? encodeURIComponent(address) : `${lat},${lng}`;
    const candidates = Platform.select<string[]>({
      ios: [`maps://?daddr=${destination}`, `maps://?q=${destination}`],
      android: [`google.navigation:q=${destination}`, `geo:0,0?q=${destination}`],
      default: [`https://www.google.com/maps/dir/?api=1&destination=${destination}`],
    }) ?? [];

    for (const url of candidates) {
      try {
        const can = await Linking.canOpenURL(url);
        if (can) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // try the next candidate
      }
    }

    toast.error(t("Unable to open maps"));
  };

  const openRouteTrace = () => {
    if (!assignmentId) return;
    router.push({
      pathname: "/(collector)/map",
      params: { id: assignmentId, kind },
    });
  };

  const callResident = () => {
    const phone = kind === "report" ? report?.resident_phone : assignment?.resident_phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => toast.error(t("Cannot open dialer")));
  };

  const startJob = async () => {
    if (kind !== "pickup") return;
    if (!assignment) return;
    if (assignment.status !== "assigned") return;
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await collectorApi.start(assignment.id);
      toast.success(t("Job started"));
      router.push({
        pathname: "/(collector)/map",
        params: { id: assignment.id, kind: "pickup" },
      });
      await load();
    } catch (err) {
      toast.info(err instanceof Error ? err.message : t("Action queued"));
      await load();
    }
  };

  const completeJob = async () => {
    if (kind !== "pickup") return;
    if (!assignment) return;
    if (assignment.status !== "in_progress") return;
    if (!completionPhotoUri?.trim()) {
      toast.error(t("Please add completion photo proof before submitting"));
      return;
    }
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await collectorApi.complete(assignment.id, {
        completionPhotoUrl: completionPhotoUri ?? null,
        completionNote: completionNote.trim() ? completionNote.trim() : null,
      });
      toast.success(t("Completion proof submitted"), {
        message: t("Resident has been notified to approve or reject this pickup in History."),
      });
      router.replace("/(collector)/assigned");
    } catch (err) {
      toast.info(err instanceof Error ? err.message : t("Action queued"));
      await load();
    }
  };

  const cleanReport = async () => {
    if (kind !== "report") return;
    if (!report) return;
    if (report.status !== "assigned") return;
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await collectorApi.cleanReport(report.id, {
        cleanedPhotoUrl: cleanupPhotoUri ?? null,
        cleanedNote: cleanupNote.trim() ? cleanupNote.trim() : null,
      });
      toast.success(t("Cleanup proof submitted"), {
        message: t("Resident has been notified to approve or reject this cleanup in History."),
      });
      router.replace("/(collector)/assigned");
    } catch (err) {
      toast.info(err instanceof Error ? err.message : t("Action queued"));
      await load();
    }
  };

  const reportIssue = () => {
    if (kind === "pickup") {
      if (!assignment) return;
      if (!["assigned", "in_progress"].includes(assignment.status)) return;
    } else {
      if (!report) return;
      if (report.status !== "assigned") return;
    }
    Alert.alert(t("Report issue"), t("Select a reason"), [
      ...ISSUE_REASONS.map((reason) => ({
        text: t(reason.labelKey),
        onPress: () => {
          void (async () => {
            try {
              if (kind === "pickup") {
                if (!assignment) return;
                await collectorApi.issue(assignment.id, reason.value);
              } else {
                if (!report) return;
                await collectorApi.issueReport(report.id, reason.value);
              }
              toast.success(t("Issue reported"));
              router.replace("/(collector)/assigned");
            } catch (err) {
              toast.info(err instanceof Error ? err.message : t("Issue action queued"));
              await load();
            }
          })();
        },
      })),
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType =
        typeof (asset as any).mimeType === "string" && (asset as any).mimeType
          ? (asset as any).mimeType
          : "image/jpeg";
      const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
      if (kind === "report") {
        setCleanupPhotoUri(uri);
      } else {
        setCompletionPhotoUri(uri);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("Permission needed"), t("Camera permission is required to take photos"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType =
        typeof (asset as any).mimeType === "string" && (asset as any).mimeType
          ? (asset as any).mimeType
          : "image/jpeg";
      const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
      if (kind === "report") {
        setCleanupPhotoUri(uri);
      } else {
        setCompletionPhotoUri(uri);
      }
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === "web") {
      void pickImage();
      return;
    }
    Alert.alert(kind === "report" ? t("Add cleanup photo") : t("Add completion photo"), t("Choose an option"), [
      { text: t("Camera"), onPress: () => void takePhoto() },
      { text: t("Gallery"), onPress: () => void pickImage() },
      { text: t("Cancel"), style: "cancel" },
    ]);
  };

  const task = kind === "report" ? report : assignment;
  const proofPhotoUri = kind === "report" ? cleanupPhotoUri : completionPhotoUri;
  const setProofPhotoUri = kind === "report" ? setCleanupPhotoUri : setCompletionPhotoUri;
  const proofNote = kind === "report" ? cleanupNote : completionNote;
  const setProofNote = kind === "report" ? setCleanupNote : setCompletionNote;
  const residentName = kind === "report" ? report?.resident_name : assignment?.resident_name;
  const residentPhone = kind === "report" ? report?.resident_phone : assignment?.resident_phone;
  const canStart = kind === "pickup" && assignment?.status === "assigned";
  const canComplete = kind === "pickup" && assignment?.status === "in_progress";
  const canClean = kind === "report" && report?.status === "assigned";
  const canIssue = kind === "pickup"
    ? !!assignment && ["assigned", "in_progress"].includes(assignment.status)
    : !!report && report.status === "assigned";
  const primaryActionLabel = canStart
    ? t("Start job")
    : canComplete
      ? t("Complete job")
      : canClean
        ? t("Mark cleaned")
        : null;
  const formatStatus = (value?: string | null) => {
    if (!value) return "";
    return t(value.replace(/_/g, " "));
  };
  const formatWasteType = (value?: string | null) => {
    if (!value) return t("Pickup");
    const normalized = value.replace(/_/g, " ");
    const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
    return t(title);
  };
  const formatReportType = (value?: string | null) => {
    if (!value) return t("Waste Report");
    if (value === "illegal_dumping") return t("Illegal Dumping");
    if (value === "overflowing_bin") return t("Overflowing Bin");
    if (value === "other") return t("Other Issue");
    const normalized = value.replace(/_/g, " ");
    const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
    return t(title);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: (primaryActionLabel || canIssue ? 108 : 24) + Math.max(insets.bottom, 8) },
        ]}
      >
        {loading && !task ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : task ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.headerRow}>
                <AppText style={[styles.title, { flex: 1 }]} color={colors.text}>
                  {kind === "report"
                    ? formatReportType(report?.report_type)
                    : formatWasteType(assignment?.waste_type)}
                </AppText>
                <AppText style={styles.status} color={Colors.secondary}>{formatStatus(task.status)}</AppText>
              </View>
              <AppText style={styles.label} color={colors.textSecondary}>
                {kind === "report"
                  ? report?.location_text || t("No location")
                  : assignment?.address || t("No address")}
              </AppText>
              {kind === "pickup" && assignment?.scheduled_date ? (
                <AppText style={styles.label} color={colors.textSecondary}>
                  {new Date(assignment.scheduled_date).toLocaleString(locale)}
                </AppText>
              ) : null}
              {kind === "report" && report?.description ? (
                <AppText style={styles.label} color={colors.textSecondary}>{report.description}</AppText>
              ) : null}
              <AppText style={styles.label} color={colors.textSecondary}>
                {t("Resident: {name}", { name: residentName || t("Unknown") })}
              </AppText>

              <View style={styles.actionsRow}>
                <Pressable style={styles.actionBtn} onPress={openRouteTrace}>
                  <Ionicons name="map-outline" size={18} color={Colors.primary} />
                  <AppText style={styles.actionText} color={Colors.primary}>{t("Trace route")}</AppText>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => void openExternalNavigation()}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.secondary} />
                  <AppText style={styles.actionText} color={Colors.secondary}>{t("Open maps")}</AppText>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={callResident} disabled={!residentPhone}>
                  <Ionicons name="call-outline" size={18} color={residentPhone ? Colors.secondary : colors.textSecondary} />
                  <AppText style={styles.actionText} color={residentPhone ? Colors.secondary : colors.textSecondary}>
                    {t("Call")}
                  </AppText>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => void load()}>
                  <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                  <AppText style={styles.actionText} color={colors.textSecondary}>{t("Refresh")}</AppText>
                </Pressable>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText style={styles.sectionTitle} color={colors.text}>{t("Route confidence")}</AppText>
              <View style={styles.confidenceRow}>
                <View
                  style={[
                    styles.confidencePill,
                    {
                      borderColor: isOnline ? Colors.secondary + "33" : Colors.error + "33",
                      backgroundColor: isOnline ? Colors.secondary + "12" : Colors.error + "12",
                    },
                  ]}
                >
                  <AppText style={styles.confidenceText} color={isOnline ? Colors.secondary : Colors.error}>
                    {t("Network {state}", { state: isOnline ? t("Online") : t("Offline") })}
                  </AppText>
                </View>
                <View style={[styles.confidencePill, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <AppText style={styles.confidenceText} color={colors.textSecondary}>
                    {t("Last sync {time}", {
                      time: lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString(locale) : t("not yet"),
                    })}
                  </AppText>
                </View>
                {queuedActionsCount > 0 ? (
                  <View style={[styles.confidencePill, { borderColor: Colors.warning + "33", backgroundColor: Colors.warning + "12" }]}>
                    <AppText style={styles.confidenceText} color={Colors.warning}>
                      {queuedActionsCount > 1
                        ? t("{count} queued actions", { count: queuedActionsCount })
                        : t("{count} queued action", { count: queuedActionsCount })}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText style={styles.label} color={colors.textSecondary}>
                {t("Keep this screen open to auto-refresh assignment state while on route.")}
              </AppText>
              {queuedActionsCount > 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.retryQueueButton,
                    { borderColor: Colors.warning, backgroundColor: Colors.warning + "12" },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() =>
                    void (async () => {
                      await syncCollectorActionQueue();
                      await load();
                    })()
                  }
                >
                  <Ionicons name="refresh-outline" size={16} color={Colors.warning} />
                  <AppText style={styles.retryQueueText} color={Colors.warning}>{t("Retry queued sync")}</AppText>
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText style={styles.sectionTitle} color={colors.text}>
                {kind === "report" ? t("Cleanup Proof") : t("Completion Proof")}
              </AppText>

              {proofPhotoUri ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: proofPhotoUri }} style={styles.previewImage} />
                  <Pressable style={styles.removeImage} onPress={() => setProofPhotoUri(null)}>
                    <Ionicons name="close-circle" size={28} color={Colors.error} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.uploadButton, { borderColor: colors.border }]} onPress={showImageOptions}>
                  <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
                  <AppText style={styles.uploadText} color={colors.textSecondary}>
                    {kind === "report"
                      ? t("Add cleanup photo (optional)")
                      : t("Add completion photo (required)")}
                  </AppText>
                </Pressable>
              )}

              <View style={styles.actionsRow}>
                <Pressable style={styles.actionBtn} onPress={showImageOptions}>
                  <Ionicons name="repeat-outline" size={18} color={colors.textSecondary} />
                  <AppText style={styles.actionText} color={colors.textSecondary}>{t("Replace photo")}</AppText>
                </Pressable>
              </View>

              <FloatingInput
                label={
                  kind === "report"
                    ? t("Cleanup note (optional)")
                    : t("Completion note (optional)")
                }
                value={proofNote}
                onChange={setProofNote}
                multiline
                numberOfLines={3}
                style={{ backgroundColor: colors.background }}
              />
            </View>

            {kind === "report" && report?.photo_url ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppText style={styles.sectionTitle} color={colors.text}>{t("Reported Photo")}</AppText>
                <Image source={{ uri: normalizeMediaUrl(report.photo_url) }} style={styles.previewImage} />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.center}>
            <AppText color={colors.textSecondary}>{t("Task not found.")}</AppText>
          </View>
        )}
      </ScrollView>

      {task && (primaryActionLabel || canIssue) ? (
        <View
          style={[
            styles.bottomBar,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          {primaryActionLabel ? (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, styles.bottomPrimaryBtn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                if (canStart) {
                  void startJob();
                  return;
                }
                if (canComplete) {
                  void completeJob();
                  return;
                }
                if (canClean) {
                  void cleanReport();
                }
              }}
            >
              <AppText style={styles.primaryText} color="#fff">{primaryActionLabel}</AppText>
            </Pressable>
          ) : null}
          {canIssue ? (
            <Pressable
              style={({ pressed }) => [styles.outlineBtn, styles.bottomIssueBtn, pressed && { opacity: 0.9 }]}
              onPress={reportIssue}
            >
              <AppText style={styles.outlineText} color={Colors.error}>{t("Issue")}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  center: { padding: spacing.xxl, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  title: { fontSize: fontSizes.button, fontFamily: fonts.semibold },
  status: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, textTransform: "capitalize" },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.regular },
  sectionTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold, marginBottom: spacing.xs },
  confidenceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xs },
  confidencePill: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 10 },
  confidenceText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  retryQueueButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  retryQueueText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  actionText: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: spacing.md, paddingHorizontal: 14, borderRadius: radius.md },
  primaryText: { color: "#fff", fontFamily: fonts.semibold },
  outlineBtn: { borderWidth: 1, borderColor: Colors.error, paddingVertical: spacing.md, paddingHorizontal: 14, borderRadius: radius.md },
  outlineText: { fontFamily: fonts.semibold },
  uploadButton: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  uploadText: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  imagePreview: { position: "relative" },
  previewImage: { width: "100%", height: 180, borderRadius: radius.xl },
  removeImage: { position: "absolute", top: spacing.sm, right: spacing.sm, backgroundColor: "#fff", borderRadius: radius.xl },
  bottomBar: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    gap: 10,
  },
  bottomPrimaryBtn: { flex: 1, alignItems: "center" },
  bottomIssueBtn: { minWidth: 92, alignItems: "center", justifyContent: "center" },
});