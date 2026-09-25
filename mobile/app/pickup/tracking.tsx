import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, radius, spacing } from "@/constants/theme";
import NativeMap from "@/components/NativeMap";
import LocationTrackingIndicator from "@/components/LocationTrackingIndicator";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { locationApi, type CollectorLocation } from "@/lib/location-api";
import {
  buildFallbackRoute,
  DOUALA_CENTER,
  formatDistance,
  formatDuration,
  getRoadRoute,
  type LogisticsRouteSummary,
} from "@/lib/logistics-map";
import { useTheme } from "@/lib/theme-context";
import { WASTE_TYPES } from "@/lib/types";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  normalizeWhatsappTemplate,
  resolveWhatsappTemplate,
} from "@/lib/whatsapp-template";

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function PickupTrackingScreen() {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { pickups } = useApp();
  const params = useLocalSearchParams();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const pickupIdParam = getParamValue(params.pickupId);

  const [collectors, setCollectors] = useState<CollectorLocation[]>([]);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [routeSummary, setRouteSummary] = useState<LogisticsRouteSummary | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    locationApi
      .listCollectorLocations()
      .then((data) => {
        if (isMounted) setCollectors(data);
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiRequest<{ success: true; settings: { whatsapp_message_template?: string | null } }>("GET", "/pricing")
      .then((res) => {
        if (!isMounted) return;
        setWhatsappTemplate(normalizeWhatsappTemplate(res.settings?.whatsapp_message_template));
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  const activePickup = useMemo(() => {
    if (pickupIdParam) {
      const explicitPickup = pickups.find((pickup) => pickup.id === pickupIdParam);
      if (explicitPickup) {
        return explicitPickup;
      }
    }
    const pending = pickups.filter(
      (pickup) => !["completed", "cancelled", "overdue"].includes(pickup.status)
    );
    return pending[0] ?? null;
  }, [pickups, pickupIdParam]);

  const pickupPoint = useMemo(() => {
    if (activePickup && typeof activePickup.latitude === "number" && typeof activePickup.longitude === "number") {
      return { lat: activePickup.latitude, lng: activePickup.longitude };
    }
    return { lat: DOUALA_CENTER.lat + 0.012, lng: DOUALA_CENTER.lng + 0.012 };
  }, [activePickup]);

  const assignedCollector = useMemo(() => {
    if (!activePickup) return null;
    if (activePickup.assignedCollectorId) {
      const byCollectorId = collectors.find(
        (collector) => collector.collector_id === activePickup.assignedCollectorId
      );
      if (byCollectorId) {
        return byCollectorId;
      }
    }
    const byPickupId = collectors.find((collector) => collector.pickup_request_id === activePickup.id);
    if (byPickupId) {
      return byPickupId;
    }
    if (activePickup.assignedCollectorName) {
      const targetName = activePickup.assignedCollectorName.trim().toLowerCase();
      if (targetName.length > 0) {
        const byName = collectors.find((collector) => collector.name.trim().toLowerCase() === targetName);
        if (byName) {
          return byName;
        }
      }
    }
    return null;
  }, [activePickup, collectors]);

  const collectorPoint = useMemo(() => {
    if (assignedCollector) {
      return { lat: assignedCollector.latitude, lng: assignedCollector.longitude };
    }
    return null;
  }, [assignedCollector]);

  useEffect(() => {
    if (!collectorPoint) {
      setRouteSummary(null);
      setRouteNotice(t("Collector location is not available yet."));
      setIsRouteLoading(false);
      return;
    }

    const fallback = buildFallbackRoute(collectorPoint, pickupPoint);
    if (fallback.distanceKm <= 0.03) {
      setRouteSummary({
        ...fallback,
        distanceKm: 0,
        durationMin: 0,
      });
      setRouteNotice(null);
      setIsRouteLoading(false);
      return;
    }

    let cancelled = false;
    setIsRouteLoading(true);
    setRouteNotice(null);

    void (async () => {
      try {
        const route = await getRoadRoute([collectorPoint, pickupPoint], {
          vehicle: "car",
          locale: language === "fr" ? "fr" : "en",
        });
        if (cancelled) return;
        setRouteSummary(route);
      } catch (err) {
        if (cancelled) return;
        setRouteSummary(fallback);
        setRouteNotice(
          t("{message}. Showing direct estimate.", {
            message: err instanceof Error ? err.message : t("Road route unavailable"),
          })
        );
      } finally {
        if (!cancelled) {
          setIsRouteLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collectorPoint, language, pickupPoint, t]);

  const collectorName = assignedCollector?.name || activePickup?.assignedCollectorName || t("Collector");
  const collectorPhone = assignedCollector?.phone || activePickup?.assignedCollectorPhone || null;
  const distanceLabel = routeSummary
    ? formatDistance(routeSummary.distanceKm)
    : t("Distance unavailable");
  const durationLabel = routeSummary
    ? formatDuration(routeSummary.durationMin)
    : t("ETA pending");

  const wasteTypeParam = getParamValue(params.wasteType);
  const address = getParamValue(params.address) || activePickup?.address || t("Pickup address pending");
  const scheduledTime = getParamValue(params.scheduledTime) || activePickup?.scheduledTime || "";
  const scheduledDate = getParamValue(params.scheduledDate) || activePickup?.scheduledDate || "";

  const wasteInfo = WASTE_TYPES.find((item) => item.type === wasteTypeParam) ?? WASTE_TYPES[0];
  const scheduleLabel = scheduledDate
    ? new Date(`${scheduledDate}T${scheduledTime || "00:00"}`).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : t("Schedule pending");

  const markers = useMemo(() => {
    const nextMarkers: {
      id: string;
      label: string;
      lat: number;
      lng: number;
      color: string;
      kind: string;
      isHighlighted?: boolean;
    }[] = [];
    if (collectorPoint) {
      nextMarkers.push({
        id: "collector",
        label: collectorName,
        lat: collectorPoint.lat,
        lng: collectorPoint.lng,
        color: "#2563eb",
        kind: "collector",
        isHighlighted: true,
      });
    }
    nextMarkers.push({
      id: "pickup",
      label: t("Pickup"),
      lat: pickupPoint.lat,
      lng: pickupPoint.lng,
      color: Colors.primary,
      kind: "pickup",
    });
    return nextMarkers;
  }, [collectorName, collectorPoint, pickupPoint.lat, pickupPoint.lng, t]);

  const polylines = useMemo(
    () => (
      routeSummary
        ? [
            {
              id: "route",
              points: routeSummary.points,
              color: Colors.primary,
              weight: 4,
              dashed: routeSummary.source === "fallback",
            },
          ]
        : []
    ),
    [routeSummary]
  );

  const handleChatCollector = async () => {
    if (!collectorPhone) return;
    const digits = collectorPhone.replace(/[^\d]/g, "");
    if (!digits) return;
    const message = encodeURIComponent(
      resolveWhatsappTemplate(whatsappTemplate, {
        collector_name: collectorName,
        pickup_address: address,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
      })
    );
    const appUrl = `whatsapp://send?phone=${digits}&text=${message}`;
    const webUrl = `https://wa.me/${digits}?text=${message}`;
    const canOpen = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpen ? appUrl : webUrl);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapWrap}>
        <NativeMap
          markers={markers}
          polylines={polylines}
          focusPoints={collectorPoint ? [collectorPoint, pickupPoint] : [pickupPoint]}
          initialCenter={pickupPoint}
          initialZoom={14}
          autoFitToData
        />
        <View style={[styles.mapEta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <AppText variant="label" color={colors.text}>{durationLabel}</AppText>
          {isRouteLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View>
        <LocationTrackingIndicator
          visible={isRouteLoading || !assignedCollector}
          overlay
          variants={!assignedCollector
            ? [
                t("Waiting for collector location…"),
                t("Tracking live collector position…"),
              ]
            : [
                t("Calculating route…"),
                t("Estimating arrival…"),
              ]}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.collectorRow}>
          <View style={[styles.avatar, { backgroundColor: Colors.primary + "15" }]}>
            <AppText variant="button" color={Colors.primary}>
              {collectorName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AppText>
          </View>
          <View style={styles.collectorInfo}>
            <AppText style={styles.collectorName} color={colors.text}>{collectorName}</AppText>
            <AppText variant="caption" style={styles.collectorMeta} color={colors.textSecondary}>
              {distanceLabel} - {durationLabel}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" style={styles.tapHint} color={colors.textSecondary}>
          {assignedCollector ? t("Tap to view live location") : t("Collector location is not available yet.")}
        </AppText>
        {routeNotice ? (
          <AppText variant="caption" style={styles.tapHint} color={colors.textSecondary}>{routeNotice}</AppText>
        ) : null}

        <View style={styles.detailRow}>
          <Ionicons name={wasteInfo.icon as never} size={18} color={wasteInfo.color} />
          <AppText variant="body" style={styles.detailText} color={colors.text}>{t(wasteInfo.label)}</AppText>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <AppText variant="body" style={styles.detailText} color={colors.text}>
            {scheduleLabel}
          </AppText>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
          <AppText variant="body" style={styles.detailText} color={colors.text}>{address}</AppText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: Colors.primary },
            pressed && { opacity: 0.9 },
            !collectorPhone && { opacity: 0.6 },
          ]}
          disabled={!collectorPhone}
          onPress={() => void handleChatCollector()}
        >
          <AppText variant="button" color="#fff">{t("Chat on WhatsApp")}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1, minHeight: 280 },
  mapEta: {
    position: "absolute",
    left: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  card: {
    margin: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: 10,
  },
  collectorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  collectorInfo: { flex: 1 },
  collectorName: { fontFamily: fonts.bold },
  collectorMeta: { fontFamily: fonts.medium, marginTop: 2 },
  tapHint: { fontFamily: fonts.medium },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailText: { fontFamily: fonts.medium, flex: 1 },
  primaryButton: {
    marginTop: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
});