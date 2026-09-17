import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useRouter } from "expo-router";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import FloatingInput from "@/components/FloatingInput";
import LeafletMap, {
  LeafletMapCommand,
  LeafletMarker,
  LeafletPolyline,
  LeafletPolylinePoint,
  LeafletUserLocation,
} from "@/components/LeafletMap";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/lib/context";
import { locationApi, type CollectorLocation } from "@/lib/location-api";
import {
  buildFallbackRoute,
  buildMultiStopWaypoints,
  DOUALA_CENTER,
  DOUALA_DEFAULT_ZOOM,
  formatDistance,
  formatDuration,
  geocodeAddress,
  getRoadRoute,
  reverseGeocode,
} from "@/lib/logistics-map";
import {
  buildEtaBaseline,
  formatEtaCountdown,
  getRemainingEtaSeconds,
  type EtaBaseline,
} from "@/lib/eta";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { useLanguage } from "@/lib/language-context";
import { WASTE_TYPES } from "@/lib/types";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  normalizeWhatsappTemplate,
  resolveWhatsappTemplate,
} from "@/lib/whatsapp-template";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const FINAL_PICKUP_STATUSES = new Set(["completed", "cancelled"]);
const FINAL_REPORT_STATUSES = new Set(["cleaned", "approved", "rejected", "cancelled"]);

const isPickupClosed = (status?: string | null) =>
  FINAL_PICKUP_STATUSES.has(String(status ?? "").toLowerCase());

const isReportClosed = (status?: string | null) =>
  FINAL_REPORT_STATUSES.has(String(status ?? "").toLowerCase());

type DestinationTarget = {
  point: LeafletPolylinePoint;
  title: string;
  subtitle: string;
  pickupId?: string;
};

const toTitleCase = (value: string) =>
  value
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");

const getUpdateInfo = (
  updatedAt: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string
) => {
  if (!updatedAt) return { label: t("No recent update"), isStale: true };
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return { label: t("Update time unknown"), isStale: true };
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return { label: t("Updated just now"), isStale: false };
  if (minutes < 60) return { label: t("Updated {minutes}m ago", { minutes }), isStale: diff > STALE_THRESHOLD_MS };
  return {
    label: t("Updated {hours}h ago", { hours: Math.floor(minutes / 60) }),
    isStale: diff > STALE_THRESHOLD_MS,
  };
};

const toTruckNumber = (collector: CollectorLocation | null, t: (key: string) => string) => {
  if (!collector) return t("Unassigned");
  if (collector.truck_number && collector.truck_number.trim().length > 0) {
    return collector.truck_number.trim();
  }
  const compactId = collector.collector_id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `WT-${compactId || "000000"}`;
};

const normalizePhone = (value?: string | null) => {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

function Chip({
  label,
  active,
  onPress,
  activeColor,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor: string;
  colors: { border: string; background: string; textSecondary: string };
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: active ? activeColor : colors.border,
          backgroundColor: active ? `${activeColor}20` : colors.background,
        },
        pressed && { opacity: 0.9 },
      ]}
      onPress={onPress}
    >
      <AppText style={styles.chipText} color={active ? activeColor : colors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function ResidentMapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const isFocused = useIsFocused();
  const { user, pickups, reports } = useApp();
  const toast = useToast();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const router = useRouter();
  const [topSectionHeight, setTopSectionHeight] = useState(0);

  const [collectorLocations, setCollectorLocations] = useState<CollectorLocation[]>([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState<string | null>(null);
  const [animatedCollector, setAnimatedCollector] = useState<LeafletPolylinePoint | null>(null);
  const [userLocation, setUserLocation] = useState<LeafletUserLocation | null>(null);
  const [searchText, setSearchText] = useState("");
  const [pickupPin, setPickupPin] = useState<LeafletPolylinePoint | null>(null);
  const [pickupPinAddress, setPickupPinAddress] = useState<string | null>(null);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [showCollectors, setShowCollectors] = useState(true);
  const showPickups = true;
  const showReports = true;
  const multiStopEnabled = false;
  const [routeSummary, setRouteSummary] = useState<{
    points: LeafletPolylinePoint[];
    distanceKm: number;
    durationMin: number;
    source: "graphhopper" | "osrm" | "fallback";
  } | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [, setIsReverseGeocoding] = useState(false);
  const [etaBaseline, setEtaBaseline] = useState<EtaBaseline | null>(null);
  const [etaCountdown, setEtaCountdown] = useState<string | null>(null);
  const [showMapKeys, setShowMapKeys] = useState(false);
  const [mapCommand, setMapCommand] = useState<LeafletMapCommand | null>(null);

  const animationRef = useRef<number | null>(null);
  const animatedRef = useRef<LeafletPolylinePoint | null>(null);
  const activeCollectorRef = useRef<string | null>(null);
  const etaRouteKeyRef = useRef<string | null>(null);
  const etaOriginKeyRef = useRef<string | null>(null);
  const userWatchRef = useRef<Location.LocationSubscription | null>(null);
  const mapCommandSeqRef = useRef(0);

  const pickupOptions = useMemo(
    () =>
      pickups.filter(
        (item) =>
          typeof item.latitude === "number" &&
          typeof item.longitude === "number" &&
          !isPickupClosed(item.status)
      ),
    [pickups]
  );

  const assignedPickups = useMemo(
    () =>
      pickups.filter(
        (pickup) =>
          !isPickupClosed(pickup.status) &&
          (Boolean(pickup.assignedCollectorId || pickup.assignedCollectorPhone) ||
            ["assigned", "in_progress"].includes(pickup.status))
      ),
    [pickups]
  );
  const hasAssignedCollector = assignedPickups.length > 0;
  const showCollectorsActive = hasAssignedCollector && showCollectors;
  const sideActionsTop =
    topSectionHeight > 0 ? topSectionHeight + 10 : insets.top + webTopInset + 164;

  const assignedPickupIds = useMemo(
    () => new Set(assignedPickups.map((pickup) => pickup.id)),
    [assignedPickups]
  );
  const assignedCollectorIds = useMemo(
    () =>
      new Set(
        assignedPickups
          .map((pickup) => pickup.assignedCollectorId)
          .filter((value): value is string => Boolean(value))
      ),
    [assignedPickups]
  );

  const trackedCollectors = useMemo(() => {
    if (!hasAssignedCollector) return [];
    return collectorLocations.filter(
      (collector) =>
        (collector.pickup_request_id && assignedPickupIds.has(collector.pickup_request_id)) ||
        assignedCollectorIds.has(collector.collector_id)
    );
  }, [assignedCollectorIds, assignedPickupIds, collectorLocations, hasAssignedCollector]);

  useEffect(() => {
    setSelectedPickupId((current) => {
      if (current && pickupOptions.some((item) => item.id === current)) return current;
      return pickupOptions[0]?.id ?? null;
    });
  }, [pickupOptions]);

  useEffect(() => {
    setSelectedCollectorId((current) => {
      if (trackedCollectors.length === 0) return null;
      if (current && trackedCollectors.some((item) => item.collector_id === current)) return current;
      return trackedCollectors[0]?.collector_id ?? null;
    });
  }, [trackedCollectors]);

  useEffect(() => {
    setShowCollectors(hasAssignedCollector);
  }, [hasAssignedCollector]);

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

  const selectedCollector = useMemo(
    () =>
      trackedCollectors.find((collector) => collector.collector_id === selectedCollectorId) ??
      trackedCollectors[0] ??
      null,
    [selectedCollectorId, trackedCollectors]
  );

  const selectedPickup = useMemo(
    () => pickupOptions.find((pickup) => pickup.id === selectedPickupId) ?? null,
    [pickupOptions, selectedPickupId]
  );

  const assignedPickup = useMemo(
    () =>
      selectedCollector?.pickup_request_id
        ? pickupOptions.find((pickup) => pickup.id === selectedCollector.pickup_request_id) ?? null
        : null,
    [pickupOptions, selectedCollector?.pickup_request_id]
  );

  const collectorPhone = useMemo(
    () =>
      normalizePhone(selectedCollector?.phone) ||
      normalizePhone(assignedPickup?.assignedCollectorPhone) ||
      normalizePhone(selectedPickup?.assignedCollectorPhone),
    [assignedPickup?.assignedCollectorPhone, selectedCollector?.phone, selectedPickup?.assignedCollectorPhone]
  );

  const collectorName = useMemo(
    () =>
      selectedCollector?.name ||
      assignedPickup?.assignedCollectorName ||
      selectedPickup?.assignedCollectorName ||
      t("Collector"),
    [assignedPickup?.assignedCollectorName, selectedCollector?.name, selectedPickup?.assignedCollectorName, t]
  );

  const animateCollector = useCallback((collectorId: string, target: LeafletPolylinePoint) => {
    const fresh = activeCollectorRef.current !== collectorId || !animatedRef.current;
    activeCollectorRef.current = collectorId;

    if (fresh) {
      animatedRef.current = target;
      setAnimatedCollector(target);
      return;
    }

    const origin = animatedRef.current;
    if (!origin) return;
    if (animationRef.current != null) cancelAnimationFrame(animationRef.current);

    const start = Date.now();
    const duration = 1300;
    const frame = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const next = {
        lat: origin.lat + (target.lat - origin.lat) * eased,
        lng: origin.lng + (target.lng - origin.lng) * eased,
      };
      animatedRef.current = next;
      setAnimatedCollector(next);
      if (t < 1) animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
    },
    []
  );

  useEffect(() => {
    if (!selectedCollector) {
      setAnimatedCollector(null);
      animatedRef.current = null;
      activeCollectorRef.current = null;
      return;
    }
    animateCollector(selectedCollector.collector_id, {
      lat: selectedCollector.latitude,
      lng: selectedCollector.longitude,
    });
  }, [animateCollector, selectedCollector, selectedCollector?.collector_id, selectedCollector?.latitude, selectedCollector?.longitude]);

  const fetchCollectors = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setCollectorLocations(await locationApi.listCollectorLocations());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to load collector locations"));
    } finally {
      setIsRefreshing(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (!user || !isFocused || !showCollectorsActive) return;
    void fetchCollectors();
    const intervalId = setInterval(() => void fetchCollectors(), 15000);
    return () => clearInterval(intervalId);
  }, [fetchCollectors, isFocused, showCollectorsActive, user, user?.id]);

  useEffect(() => {
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const known = await Location.getLastKnownPositionAsync();
        const position = known ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        userWatchRef.current?.remove();
        userWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 7000,
            distanceInterval: 8,
          },
          (next) => {
            setUserLocation({
              lat: next.coords.latitude,
              lng: next.coords.longitude,
              accuracy: next.coords.accuracy,
            });
          }
        );
      } catch {
        // Ignore bootstrap errors.
      }
    })();
    return () => {
      userWatchRef.current?.remove();
      userWatchRef.current = null;
    };
  }, []);

  const handleLocateMe = async () => {
    try {
      setIsLocating(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        toast.error(t("Location permission denied"));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      userWatchRef.current?.remove();
      userWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 7000,
          distanceInterval: 8,
        },
        (next) => {
          setUserLocation({
            lat: next.coords.latitude,
            lng: next.coords.longitude,
            accuracy: next.coords.accuracy,
          });
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to fetch location"));
    } finally {
      setIsLocating(false);
    }
  };

  const handleSearchAddress = async () => {
    const query = searchText.trim();
    if (!query) return;
    try {
      setIsSearching(true);
      const result = await geocodeAddress(query);
      if (!result) {
        toast.error(t("No address found"));
        return;
      }
      setPickupPin(result.coordinate);
      setPickupPinAddress(result.formattedAddress);
      setSearchText(result.formattedAddress);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Address lookup failed"));
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapPress = useCallback(
    (point: LeafletPolylinePoint) => {
      setPickupPin(point);
      setPickupPinAddress(null);
      setIsReverseGeocoding(true);
      void reverseGeocode(point)
        .then((value) => setPickupPinAddress(value || t("Selected location")))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : t("Reverse geocoding failed"));
          setPickupPinAddress(t("Selected location"));
        })
        .finally(() => setIsReverseGeocoding(false));
    },
    [toast, t]
  );

  const destination = useMemo<DestinationTarget | null>(() => {
    if (pickupPin) {
      return {
        point: pickupPin,
        title: t("Pinned pickup"),
        subtitle: pickupPinAddress || t("Map-selected location"),
      };
    }
    if (assignedPickup && typeof assignedPickup.latitude === "number" && typeof assignedPickup.longitude === "number") {
      return {
        point: { lat: assignedPickup.latitude, lng: assignedPickup.longitude },
        title: t("Assigned pickup"),
        subtitle: assignedPickup.address,
        pickupId: assignedPickup.id,
      };
    }
    if (selectedPickup && typeof selectedPickup.latitude === "number" && typeof selectedPickup.longitude === "number") {
      return {
        point: { lat: selectedPickup.latitude, lng: selectedPickup.longitude },
        title: t("Selected pickup"),
        subtitle: selectedPickup.address,
        pickupId: selectedPickup.id,
      };
    }
    return null;
  }, [assignedPickup, pickupPin, pickupPinAddress, selectedPickup, t]);

  useEffect(() => {
    if (!hasAssignedCollector) {
      setRouteSummary(null);
      setEtaBaseline(null);
      etaRouteKeyRef.current = null;
      etaOriginKeyRef.current = null;
      setRouteNotice(t("No collector assigned yet."));
      return;
    }
    if (!showCollectorsActive) {
      setRouteSummary(null);
      setEtaBaseline(null);
      etaRouteKeyRef.current = null;
      etaOriginKeyRef.current = null;
      setRouteNotice(t("Collector tracking paused."));
      return;
    }
    if (!selectedCollector) {
      setRouteSummary(null);
      setEtaBaseline(null);
      etaRouteKeyRef.current = null;
      etaOriginKeyRef.current = null;
      setRouteNotice(t("Collector location is not available yet."));
      return;
    }
    if (!destination) {
      setRouteSummary(null);
      setEtaBaseline(null);
      etaRouteKeyRef.current = null;
      etaOriginKeyRef.current = null;
      setRouteNotice(t("Select or pin a pickup location."));
      return;
    }

    const etaRouteKey = [
      selectedCollector.collector_id,
      destination.pickupId ?? `${destination.point.lat.toFixed(5)},${destination.point.lng.toFixed(5)}`,
      multiStopEnabled ? "multi" : "single",
    ].join("|");
    const shouldResetEta = etaRouteKeyRef.current !== etaRouteKey;
    etaRouteKeyRef.current = etaRouteKey;

    const origin = { lat: selectedCollector.latitude, lng: selectedCollector.longitude };
    const nextOriginKey = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}`;
    const hasOriginMoved = etaOriginKeyRef.current !== nextOriginKey;
    etaOriginKeyRef.current = nextOriginKey;
    const shouldUpdateEta = shouldResetEta || hasOriginMoved;
    const target = destination.point;
    const fallback = buildFallbackRoute(origin, target, 28);
    const extraStops = multiStopEnabled
      ? pickupOptions
          .filter((item) => item.id !== destination.pickupId)
          .slice(0, 3)
          .map((item) => ({ lat: item.latitude as number, lng: item.longitude as number }))
      : [];
    const waypoints = buildMultiStopWaypoints(origin, target, extraStops, 5);

    let cancelled = false;
    setIsRouteLoading(true);
    setRouteNotice(null);

    void (async () => {
      try {
        const route = await getRoadRoute(waypoints, {
          vehicle: "car",
          locale: language === "fr" ? "fr" : "en",
        });
        if (cancelled) return;
        setRouteSummary(route);
        setEtaBaseline((previous) =>
          !shouldUpdateEta && previous
            ? previous
            : buildEtaBaseline({
                incomingSeconds: Math.round(route.durationMin * 60),
                previous,
                reset: shouldResetEta,
              }),
        );
        setRouteNotice(
          waypoints.length > 2
            ? t("Multi-stop route includes {stops} additional stop(s).", {
                stops: waypoints.length - 2,
              })
            : null
        );
      } catch (err) {
        if (cancelled) return;
        setRouteSummary(fallback);
        setEtaBaseline((previous) =>
          !shouldUpdateEta && previous
            ? previous
            : buildEtaBaseline({
                incomingSeconds: Math.round(fallback.durationMin * 60),
                previous,
                reset: shouldResetEta,
              }),
        );
        setRouteNotice(
          t("{message}. Showing direct estimate.", {
            message: err instanceof Error ? err.message : t("Road route unavailable"),
          })
        );
      } finally {
        if (!cancelled) setIsRouteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destination, hasAssignedCollector, language, multiStopEnabled, pickupOptions, selectedCollector, showCollectorsActive, t]);

  useEffect(() => {
    if (!etaBaseline) {
      setEtaCountdown(null);
      return;
    }

    const tick = () => {
      const remainingSeconds = getRemainingEtaSeconds(etaBaseline);
      setEtaCountdown(formatEtaCountdown(remainingSeconds));
    };

    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [etaBaseline]);

  const markers = useMemo<LeafletMarker[]>(() => {
    const next: LeafletMarker[] = [];

    if (showPickups) {
      pickupOptions.forEach((pickup) => {
        const waste = WASTE_TYPES.find((item) => item.type === pickup.wasteType);
        const active = pickup.id === destination?.pickupId;
        const wasteLabel = waste?.label ? t(waste.label) : t("Waste");
        next.push({
          id: `pickup-${pickup.id}`,
          label: waste ? t("{waste} pickup", { waste: wasteLabel }) : t("Pickup"),
          subtitle: pickup.address,
          details: [
            t("Status: {status}", { status: t(toTitleCase(pickup.status)) }),
            t("Schedule: {date}", {
              date: `${pickup.scheduledDate} ${pickup.scheduledTime || ""}`.trim(),
            }),
            pickup.assignedCollectorName
              ? t("Assigned collector: {name}", { name: pickup.assignedCollectorName })
              : "",
          ].filter((line) => line.length > 0),
          kind: "pickup",
          lat: pickup.latitude as number,
          lng: pickup.longitude as number,
          color: waste?.color ?? Colors.primary,
          labelOnTop: active,
          isHighlighted: active,
        });
      });
    }

    if (showReports) {
      reports.forEach((report) => {
        if (typeof report.latitude !== "number" || typeof report.longitude !== "number") return;
        if (isReportClosed(report.status)) return;
        next.push({
          id: `report-${report.id}`,
          label: t(toTitleCase(report.type)),
          subtitle: report.location,
          details: [
            t("Status: {status}", { status: t(toTitleCase(report.status)) }),
            t("Reported: {date}", {
              date: new Date(report.createdAt).toLocaleDateString(),
            }),
          ],
          kind: "report",
          lat: report.latitude,
          lng: report.longitude,
          color: Colors.warning,
        });
      });
    }

    if (pickupPin) {
      next.push({
        id: "pickup-pin",
        label: t("Pinned pickup"),
        subtitle: pickupPinAddress ?? t("Selected location"),
        details: [
          t("Coordinates: {coords}", {
            coords: `${pickupPin.lat.toFixed(5)}, ${pickupPin.lng.toFixed(5)}`,
          }),
        ],
        kind: "pin",
        lat: pickupPin.lat,
        lng: pickupPin.lng,
        color: Colors.secondary,
        labelOnTop: true,
        isHighlighted: true,
      });
    }

    if (showCollectorsActive) {
      trackedCollectors.forEach((collector) => {
        const update = getUpdateInfo(collector.updated_at, t);
        const active = collector.collector_id === selectedCollector?.collector_id;
        const location =
          active && animatedCollector
            ? animatedCollector
            : { lat: collector.latitude, lng: collector.longitude };
        next.push({
          id: `collector-${collector.collector_id}`,
          label: collector.name || t("Collector"),
          subtitle: update.label,
          details: [
            update.isStale ? t("Signal: stale") : t("Signal: live"),
            collector.phone ? t("Call: {phone}", { phone: collector.phone }) : t("Call: unavailable"),
            t("Truck: {truck}", { truck: toTruckNumber(collector, t) }),
            collector.pickup_request_id
              ? t("Assigned pickup: {id}", { id: collector.pickup_request_id })
              : t("No active assignment"),
          ],
          kind: "collector",
          lat: location.lat,
          lng: location.lng,
          color: update.isStale ? "#94a3b8" : "#2563eb",
          labelOnTop: active,
          isHighlighted: active,
        });
      });
    }

    return next;
  }, [
    animatedCollector,
    destination?.pickupId,
    pickupOptions,
    pickupPin,
    pickupPinAddress,
    reports,
    selectedCollector?.collector_id,
    showCollectorsActive,
    showPickups,
    showReports,
    trackedCollectors,
    t,
  ]);

  const polylines = useMemo<LeafletPolyline[]>(
    () =>
      routeSummary && showCollectorsActive
        ? [
            {
              id: "collector-route",
              points: routeSummary.points,
              color: "#0b60ff",
              weight: 7,
              dashed: routeSummary.source === "fallback",
            },
          ]
        : [],
    [routeSummary, showCollectorsActive]
  );

  const focusPoints = useMemo(() => {
    if (routeSummary?.points?.length) {
      if (userLocation) {
        return [...routeSummary.points, { lat: userLocation.lat, lng: userLocation.lng }];
      }
      return routeSummary.points;
    }
    if (destination && selectedCollector) {
      const points = [
        { lat: selectedCollector.latitude, lng: selectedCollector.longitude },
        destination.point,
      ];
      if (userLocation) {
        points.push({ lat: userLocation.lat, lng: userLocation.lng });
      }
      return points;
    }
    if (destination) {
      if (userLocation) {
        return [destination.point, { lat: userLocation.lat, lng: userLocation.lng }];
      }
      return [destination.point];
    }
    if (userLocation) return [{ lat: userLocation.lat, lng: userLocation.lng }];
    return [DOUALA_CENTER];
  }, [destination, routeSummary?.points, selectedCollector, userLocation]);

  const mapUserLocation = userLocation
    ? {
        ...userLocation,
        label: t("Me"),
        color: Colors.error,
      }
    : null;

  const handleMarkerPress = useCallback(
    (marker: { id: string; kind?: string; label?: string }) => {
      if (marker.id.startsWith("collector-")) {
        const collectorId = marker.id.slice("collector-".length);
        if (collectorId) {
          setSelectedCollectorId(collectorId);
        }
        return;
      }

      if (marker.id.startsWith("pickup-")) {
        const pickupId = marker.id.slice("pickup-".length);
        if (pickupId) {
          setSelectedPickupId(pickupId);
          setPickupPin(null);
          setPickupPinAddress(null);
        }
      }
    },
    []
  );

  const handleCallCollector = useCallback(async () => {
    if (!collectorPhone) {
      toast.error(t("Collector phone is not available yet"));
      return;
    }

    const phone = collectorPhone.replace(/\s+/g, "");
    const normalized = phone.replace(/[^\d+]/g, "");
    const callTargets = Platform.select<string[]>({
      ios: [`telprompt:${normalized}`, `tel:${normalized}`],
      android: [`tel:${normalized}`],
      default: [`tel:${normalized}`],
    }) ?? [`tel:${normalized}`];

    try {
      for (const target of callTargets) {
        const canOpen = await Linking.canOpenURL(target);
        if (!canOpen) continue;
        await Linking.openURL(target);
        return;
      }
      toast.error(t("Call option is not available on this device"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Unable to start phone call"));
    }
  }, [collectorPhone, toast, t]);

  const handleChatCollector = useCallback(async () => {
    if (!collectorPhone) {
      toast.error(t("Collector phone is not available yet"));
      return;
    }

    const plainDigits = collectorPhone.replace(/[^\d]/g, "");
    if (!plainDigits) {
      toast.error(t("Collector phone is not available yet"));
      return;
    }

    const pickupAddress =
      selectedPickup?.address ||
      assignedPickup?.address ||
      pickupPinAddress ||
      t("my pickup location");
    const scheduledDate = selectedPickup?.scheduledDate || assignedPickup?.scheduledDate || "";
    const scheduledTime = selectedPickup?.scheduledTime || assignedPickup?.scheduledTime || "";
    const message = encodeURIComponent(
      resolveWhatsappTemplate(whatsappTemplate, {
        collector_name: collectorName,
        pickup_address: pickupAddress,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
      })
    );
    const appUrl = `whatsapp://send?phone=${plainDigits}&text=${message}`;
    const webUrl = `https://wa.me/${plainDigits}?text=${message}`;

    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : webUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Unable to open WhatsApp"));
    }
  }, [
    collectorPhone,
    collectorName,
    selectedPickup,
    assignedPickup,
    pickupPinAddress,
    whatsappTemplate,
    toast,
    t,
  ]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  const runMapCommand = useCallback((action: LeafletMapCommand["action"]) => {
    mapCommandSeqRef.current += 1;
    setMapCommand({ id: mapCommandSeqRef.current, action });
  }, []);

  return (
    <View style={styles.container}>
      <LeafletMap
        markers={markers}
        userLocation={mapUserLocation}
        polylines={polylines}
        focusPoints={focusPoints}
        onMapPress={handleMapPress}
        onMarkerPress={handleMarkerPress}
        initialCenter={DOUALA_CENTER}
        initialZoom={DOUALA_DEFAULT_ZOOM}
        containerStyle={StyleSheet.absoluteFill}
        enableClustering
        forceShowMarkerLabels
        mapCommand={mapCommand}
      />

      <View
        style={[styles.topWrap, { paddingTop: insets.top + webTopInset + 8 }]}
        onLayout={(event) => setTopSectionHeight(event.nativeEvent.layout.height)}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.topHeaderRow}>
            <Pressable
              style={({ pressed }) => [
                styles.topIconAction,
                { backgroundColor: colors.background, borderColor: colors.border },
                pressed && { opacity: 0.9 },
              ]}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel={t("Back to previous screen")}
          >
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </Pressable>
            <View style={styles.titleWrap}>
              <AppText style={styles.title} color={colors.text}>{t("Logistics Map")}</AppText>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.topIconAction,
                { backgroundColor: colors.background, borderColor: colors.border },
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => setShowMapKeys(true)}
              accessibilityRole="button"
              accessibilityLabel={t("Open map keys")}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
            </Pressable>
          </View>
          <FloatingInput
            label={t("Search pickup address")}
            value={searchText}
            onChange={setSearchText}
            type="search"
            icon="search-outline"
            returnKeyType="search"
            onSubmitEditing={() => void handleSearchAddress()}
            rightAccessory={(
              <Pressable style={styles.iconBtn} onPress={() => void handleSearchAddress()}>
                {isSearching
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                }
              </Pressable>
            )}
          />
        </View>

        {showCollectorsActive && trackedCollectors.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {trackedCollectors.map((collector) => (
              <Chip
                key={collector.collector_id}
                label={collector.name || t("Collector")}
                active={selectedCollector?.collector_id === collector.collector_id}
                onPress={() => setSelectedCollectorId(collector.collector_id)}
                activeColor="#2563eb"
                colors={colors}
              />
            ))}
          </ScrollView>
        ) : null}

        {showCollectorsActive && routeSummary ? (
          <View style={[styles.topEtaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="time-outline" size={16} color="#0b60ff" />
            <View style={styles.topEtaTextWrap}>
              <AppText style={styles.topEtaLabel} color={colors.textSecondary}>{t("ETA to destination")}</AppText>
              <AppText style={styles.topEtaValue} color={colors.text}>
                {etaCountdown ?? formatDuration(routeSummary.durationMin)}
              </AppText>
              <AppText style={styles.topEtaMeta} color={colors.textSecondary}>
                {formatDistance(routeSummary.distanceKm)}
              </AppText>
            </View>
            {isRouteLoading ? <ActivityIndicator size="small" color="#0b60ff" /> : null}
          </View>
        ) : null}

        {showCollectorsActive && routeNotice ? (
          <View style={[styles.routeNoticeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText style={styles.routeNoticeText} color={colors.textSecondary}>{routeNotice}</AppText>
          </View>
        ) : null}
      </View>

      <View style={[styles.sideWrap, { top: sideActionsTop }]}>
        <Pressable
          style={[styles.iconAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => runMapCommand("zoom-in")}
          accessibilityRole="button"
          accessibilityLabel={t("Zoom in")}
        >
          <Ionicons name="add" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          style={[styles.iconAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => runMapCommand("zoom-out")}
          accessibilityRole="button"
          accessibilityLabel={t("Zoom out")}
        >
          <Ionicons name="remove" size={20} color={colors.textSecondary} />
        </Pressable>
        {showCollectorsActive ? (
          <Pressable
            style={[styles.iconAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => void fetchCollectors()}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.iconAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => void handleLocateMe()}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="locate-outline" size={20} color={Colors.primary} />
          )}
        </Pressable>
        {hasAssignedCollector ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconAction,
              { backgroundColor: "#FFFFFF", borderColor: colors.border },
              pressed && { opacity: 0.9 },
              !collectorPhone && { opacity: 0.4 },
            ]}
            onPress={() => void handleCallCollector()}
            disabled={!collectorPhone}
            accessibilityRole="button"
            accessibilityLabel={t("Call collector")}
          >
            <Ionicons name="call" size={20} color={Colors.primary} />
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.iconAction,
            { backgroundColor: "#FFFFFF", borderColor: colors.border },
            pressed && { opacity: 0.9 },
            !collectorPhone && { opacity: 0.4 },
          ]}
          onPress={() => void handleChatCollector()}
          disabled={!collectorPhone}
          accessibilityRole="button"
          accessibilityLabel={t("Chat with collector on WhatsApp")}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#22c55e" />
        </Pressable>
      </View>

      <Modal
        visible={showMapKeys}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMapKeys(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMapKeys(false)} />
          <View
            style={[
              styles.mapKeysCard,
              {
                marginTop: insets.top + webTopInset + 64,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.mapKeysHeader}>
              <AppText style={styles.mapKeysTitle} color={colors.text}>{t("Map Keys")}</AppText>
              <Pressable onPress={() => setShowMapKeys(false)} accessibilityLabel={t("Close map keys")}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.mapKeysList}>
              {hasAssignedCollector ? (
                <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                  <View style={[styles.keyDot, { backgroundColor: "#2563eb" }]} />
                  <AppText style={styles.mapKeyText} color={colors.text}>{t("Collector live")}</AppText>
                </View>
              ) : null}
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.keyDot, { backgroundColor: Colors.primary }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Pickup point")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.keyDot, { backgroundColor: Colors.warning }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Report site")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.keyDot, { backgroundColor: Colors.secondary }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Pinned point")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.keyDot, { backgroundColor: Colors.success }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Road route")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.keyDot, { backgroundColor: Colors.error }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Me")}</AppText>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topWrap: { position: "absolute", left: spacing.md, right: spacing.md, gap: spacing.sm },
  topHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-start" },
  titleWrap: { flex: 1, minWidth: 0 },
  bottomSheet: { position: "absolute", left: spacing.md, right: spacing.md, bottom: 0 },
  sideWrap: { position: "absolute", right: spacing.md, gap: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  sheetCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: fontSizes.button, fontFamily: fonts.bold },
  subtitle: { fontSize: fontSizes.xs, fontFamily: fonts.regular },
  iconBtn: { width: 28, height: 28, borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
  iconAction: {
    width: 46,
    height: 46,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topIconAction: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topEtaCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 2,
  },
  topEtaTextWrap: { flex: 1 },
  topEtaLabel: { fontSize: fontSizes.xs - 1, fontFamily: fonts.semibold, textTransform: "uppercase" },
  topEtaValue: { fontSize: fontSizes.body, fontFamily: fonts.bold },
  topEtaMeta: { fontSize: fontSizes.xs - 1, fontFamily: fonts.medium, marginTop: 1 },
  routeNoticeCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
  },
  routeNoticeText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.medium },
  metrics: { flexDirection: "row", gap: 18 },
  metricLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: "uppercase" },
  metric: { fontSize: fontSizes.body, fontFamily: fonts.bold },
  note: { fontSize: fontSizes.xs, fontFamily: fonts.medium },
  emptyStateCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyStateTextWrap: { flex: 1 },
  emptyStateTitle: { fontSize: fontSizes.sm, fontFamily: fonts.bold },
  emptyStateText: { fontSize: fontSizes.xs, fontFamily: fonts.regular, lineHeight: spacing.lg },
  emptyStateButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyStateButtonText: { color: "#fff", fontSize: fontSizes.xs - 1, fontFamily: fonts.bold },
  row: { gap: spacing.sm },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  modalBackdrop: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "flex-end",
  },
  mapKeysCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  mapKeysHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapKeysTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
  },
  mapKeysList: { gap: spacing.sm },
  mapKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
  },
  keyDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  mapKeyText: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.semibold,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: { fontSize: fontSizes.xs - 1, fontFamily: fonts.semibold },
});