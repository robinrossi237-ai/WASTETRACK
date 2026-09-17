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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";

import Colors from "@/constants/colors";
import { fonts, fontSizes, radius, shadows, spacing } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { useLanguage } from "@/lib/language-context";
import { useApp } from "@/lib/context";
import LeafletMap, {
  LeafletMapCommand,
  LeafletMarker,
  LeafletPolyline,
  LeafletPolylinePoint,
  LeafletUserLocation,
} from "@/components/LeafletMap";
import { collectorApi, CollectorAssignment, CollectorWasteReport } from "@/lib/collector-api";
import { locationApi } from "@/lib/location-api";
import {
  buildFallbackRoute,
  buildMultiStopWaypoints,
  formatDistance,
  formatDuration,
  getRoadRoute,
} from "@/lib/logistics-map";
import {
  buildEtaBaseline,
  formatEtaCountdown,
  getRemainingEtaSeconds,
  type EtaBaseline,
} from "@/lib/eta";
import { WASTE_TYPES } from "@/lib/types";

type RouteTaskKind = "pickup" | "report";

type CollectorRouteTask = {
  key: string;
  id: string;
  kind: RouteTaskKind;
  title: string;
  areaText: string;
  status: string;
  lat: number;
  lng: number;
  color: string;
};

type RouteSummary = {
  points: LeafletPolylinePoint[];
  distanceKm: number;
  durationMin: number;
  source: "graphhopper" | "osrm" | "fallback";
};

const toTaskKey = (kind: RouteTaskKind, id: string) => `${kind}:${id}`;
const ROUTE_LINE_COLOR = "#0b60ff";
const FINISHED_TASK_STATUSES = new Set(["completed", "cancelled", "cleaned", "approved", "rejected"]);
const isFinishedTaskStatus = (status?: string | null) =>
  FINISHED_TASK_STATUSES.has(String(status ?? "").toLowerCase());

export default function CollectorMapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useApp();
  const toast = useToast();
  const router = useRouter();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const params = useLocalSearchParams<{ id?: string | string[]; kind?: string | string[] }>();
  const [topSectionHeight, setTopSectionHeight] = useState(0);
  const sideActionsTop =
    topSectionHeight > 0 ? topSectionHeight + 10 : insets.top + webTopInset + 164;

  const [assignments, setAssignments] = useState<CollectorAssignment[]>([]);
  const [reports, setReports] = useState<CollectorWasteReport[]>([]);
  const [userLocation, setUserLocation] = useState<LeafletUserLocation | null>(null);
  const [displayUserLocation, setDisplayUserLocation] = useState<LeafletUserLocation | null>(null);
  const [tracking, setTracking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPickups, setShowPickups] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [multiStopEnabled, setMultiStopEnabled] = useState(false);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [etaBaseline, setEtaBaseline] = useState<EtaBaseline | null>(null);
  const [etaCountdown, setEtaCountdown] = useState<string | null>(null);
  const [showMapKeys, setShowMapKeys] = useState(false);
  const [mapCommand, setMapCommand] = useState<LeafletMapCommand | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentAt = useRef<number>(0);
  const locationAnimRef = useRef<number | null>(null);
  const animatedPointRef = useRef<LeafletPolylinePoint | null>(null);
  const etaRouteKeyRef = useRef<string | null>(null);
  const etaOriginKeyRef = useRef<string | null>(null);
  const mapCommandSeqRef = useRef(0);
  const quickRouteLocationBootstrapRef = useRef<string | null>(null);

  const formatStatus = useCallback(
    (value?: string | null) => {
      if (!value) return "";
      return t(value.replace(/_/g, " "));
    },
    [t]
  );

  const formatWasteType = useCallback(
    (value?: string | null) => {
      if (!value) return t("Pickup");
      const predefined = WASTE_TYPES.find((item) => item.type === value);
      if (predefined?.label) return t(predefined.label);
      const normalized = value.replace(/_/g, " ");
      const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
      return t(title);
    },
    [t]
  );

  const formatReportType = useCallback(
    (value?: string | null) => {
      if (!value) return t("Waste Report");
      if (value === "illegal_dumping") return t("Illegal Dumping");
      if (value === "overflowing_bin") return t("Overflowing Bin");
      if (value === "other") return t("Other Issue");
      const normalized = value.replace(/_/g, " ");
      const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
      return t(title);
    },
    [t]
  );

  const formatPickupTitle = useCallback(
    (wasteType?: string | null) => {
      if (!wasteType) return t("Pickup request");
      return t("{type} pickup", { type: formatWasteType(wasteType) });
    },
    [formatWasteType, t]
  );

  const formatReportTitle = useCallback(
    (reportType?: string | null) => {
      if (!reportType) return t("Illegal dump report");
      return t("{type} report", { type: formatReportType(reportType) });
    },
    [formatReportType, t]
  );

  const selectedParamId = Array.isArray(params.id) ? params.id[0] : params.id;
  const selectedParamKindRaw = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const selectedParamKind: RouteTaskKind = selectedParamKindRaw === "report" ? "report" : "pickup";
  const requestedTaskKey = selectedParamId ? toTaskKey(selectedParamKind, selectedParamId) : null;

  const animateCollectorPosition = useCallback((target: LeafletUserLocation) => {
    const nextTarget = { lat: target.lat, lng: target.lng };
    const startPoint = animatedPointRef.current;

    if (!startPoint) {
      animatedPointRef.current = nextTarget;
      setDisplayUserLocation(target);
      return;
    }

    if (locationAnimRef.current != null) {
      cancelAnimationFrame(locationAnimRef.current);
      locationAnimRef.current = null;
    }

    const startedAt = Date.now();
    const durationMs = 900;

    const frame = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const point = {
        lat: startPoint.lat + (nextTarget.lat - startPoint.lat) * eased,
        lng: startPoint.lng + (nextTarget.lng - startPoint.lng) * eased,
      };
      animatedPointRef.current = point;
      setDisplayUserLocation({
        lat: point.lat,
        lng: point.lng,
        accuracy: target.accuracy,
      });

      if (progress < 1) {
        locationAnimRef.current = requestAnimationFrame(frame);
      } else {
        locationAnimRef.current = null;
      }
    };

    locationAnimRef.current = requestAnimationFrame(frame);
  }, []);

  const loadAssignments = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [nextAssignments, nextReports] = await Promise.all([
        collectorApi.listAssigned(),
        collectorApi.listAssignedReports(),
      ]);
      setAssignments(nextAssignments);
      setReports(nextReports);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to load assignments");
      toast.error(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
      if (locationAnimRef.current != null) {
        cancelAnimationFrame(locationAnimRef.current);
        locationAnimRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!userLocation) {
      animatedPointRef.current = null;
      setDisplayUserLocation(null);
      return;
    }
    animateCollectorPosition(userLocation);
  }, [animateCollectorPosition, userLocation]);

  const sendLocation = useCallback(async (coords: Location.LocationObjectCoords) => {
    const now = Date.now();
    if (now - lastSentAt.current < 4000) return;
    lastSentAt.current = now;
    try {
      await locationApi.trackLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Failed to share location");
      toast.error(message);
    }
  }, [t, toast]);

  const startTracking = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!silent) {
          toast.error(t("Location permission denied"));
        }
        return;
      }

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const initialLocation = {
        lat: initial.coords.latitude,
        lng: initial.coords.longitude,
        accuracy: initial.coords.accuracy,
      };
      setUserLocation(initialLocation);
      await sendLocation(initial.coords);

      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 7000,
          distanceInterval: 5,
        },
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          void sendLocation(pos.coords);
        }
      );

      setTracking(true);
    } catch (err) {
      if (!silent) {
        const message = err instanceof Error ? err.message : t("Failed to start tracking");
        toast.error(message);
      }
    }
  };

  const stopTracking = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setTracking(false);
  };

  useEffect(() => {
    if (user?.collectorAutoLocationTracking === false) {
      return;
    }
    void startTracking({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.collectorAutoLocationTracking]);

  useEffect(() => {
    if (!requestedTaskKey) {
      return;
    }
    if (tracking || watchRef.current) {
      return;
    }
    void startTracking({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTaskKey, tracking]);

  const routeTasks = useMemo<CollectorRouteTask[]>(() => {
    const pickupTasks: CollectorRouteTask[] = assignments
      .filter(
        (assignment) =>
          typeof assignment.latitude === "number" &&
          typeof assignment.longitude === "number" &&
          !isFinishedTaskStatus(assignment.status)
      )
      .map((assignment) => ({
        key: toTaskKey("pickup", assignment.id),
        id: assignment.id,
        kind: "pickup",
        title: formatPickupTitle(assignment.waste_type),
        areaText: assignment.address ?? t("No address provided"),
        status: assignment.status,
        lat: assignment.latitude as number,
        lng: assignment.longitude as number,
        color: Colors.primary,
      }));

    const reportTasks: CollectorRouteTask[] = reports
      .filter(
        (report) =>
          typeof report.latitude === "number" &&
          typeof report.longitude === "number" &&
          !isFinishedTaskStatus(report.status)
      )
      .map((report) => ({
        key: toTaskKey("report", report.id),
        id: report.id,
        kind: "report",
        title: formatReportTitle(report.report_type),
        areaText: report.location_text ?? t("No location description"),
        status: report.status,
        lat: report.latitude as number,
        lng: report.longitude as number,
        color: Colors.secondary,
      }));

    return [...pickupTasks, ...reportTasks];
  }, [assignments, formatPickupTitle, formatReportTitle, reports, t]);

  useEffect(() => {
    if (routeTasks.length === 0) {
      setSelectedTaskKey(null);
      return;
    }

    setSelectedTaskKey((previous) => {
      if (requestedTaskKey && routeTasks.some((task) => task.key === requestedTaskKey)) {
        return requestedTaskKey;
      }
      if (previous && routeTasks.some((task) => task.key === previous)) {
        return previous;
      }
      return routeTasks[0].key;
    });
  }, [requestedTaskKey, routeTasks]);

  useEffect(() => {
    if (!requestedTaskKey) {
      quickRouteLocationBootstrapRef.current = null;
      return;
    }

    if (userLocation) {
      quickRouteLocationBootstrapRef.current = requestedTaskKey;
      return;
    }

    if (quickRouteLocationBootstrapRef.current === requestedTaskKey) {
      return;
    }
    quickRouteLocationBootstrapRef.current = requestedTaskKey;

    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          toast.info(t("Enable location permission to trace the route."));
          return;
        }

        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;

        setUserLocation({
          lat: current.coords.latitude,
          lng: current.coords.longitude,
          accuracy: current.coords.accuracy,
        });
        await sendLocation(current.coords);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : t("Failed to determine your location for routing.");
        toast.error(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedTaskKey, sendLocation, t, toast, userLocation]);

  const selectedTask = useMemo(
    () => routeTasks.find((task) => task.key === selectedTaskKey) ?? null,
    [routeTasks, selectedTaskKey]
  );

  const handleMarkerPress = useCallback((marker: { id: string; kind?: string; label?: string }) => {
    if (marker.id.startsWith("pickup-")) {
      const taskId = marker.id.slice("pickup-".length);
      if (taskId) {
        setSelectedTaskKey(toTaskKey("pickup", taskId));
      }
      return;
    }
    if (marker.id.startsWith("report-")) {
      const taskId = marker.id.slice("report-".length);
      if (taskId) {
        setSelectedTaskKey(toTaskKey("report", taskId));
      }
    }
  }, []);

  useEffect(() => {
    const destination = selectedTask;
    if (!destination) {
      setRouteSummary(null);
      setIsRouteLoading(false);
      setRouteNotice(null);
      setEtaBaseline(null);
      etaRouteKeyRef.current = null;
      etaOriginKeyRef.current = null;
      return;
    }

    if (!userLocation) {
      setRouteSummary(null);
      setIsRouteLoading(false);
      setRouteNotice(t("Share your live location to trace the road and ETA."));
      setEtaBaseline(null);
      etaRouteKeyRef.current = null;
      etaOriginKeyRef.current = null;
      return;
    }

    const etaRouteKey = [
      destination.key,
      multiStopEnabled ? "multi" : "single",
    ].join("|");
    const shouldResetEta = etaRouteKeyRef.current !== etaRouteKey;
    etaRouteKeyRef.current = etaRouteKey;

    const origin = { lat: userLocation.lat, lng: userLocation.lng };
    const nextOriginKey = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}`;
    const hasOriginMoved = etaOriginKeyRef.current !== nextOriginKey;
    etaOriginKeyRef.current = nextOriginKey;
    const shouldUpdateEta = shouldResetEta || hasOriginMoved;
    const target = { lat: destination.lat, lng: destination.lng };
    const fallback = buildFallbackRoute(origin, target);
    const extraStops = multiStopEnabled
      ? routeTasks
          .filter((task) => task.key !== destination.key)
          .slice(0, 3)
          .map((task) => ({ lat: task.lat, lng: task.lng }))
      : [];
    const waypoints = buildMultiStopWaypoints(origin, target, extraStops, 5);

    if (fallback.distanceKm <= 0.03) {
      setRouteSummary({
        points: [origin, target],
        distanceKm: 0,
        durationMin: 0,
        source: "fallback",
      });
      setEtaBaseline({
        baseSeconds: 0,
        startedAt: Date.now(),
      });
      setIsRouteLoading(false);
      setRouteNotice(t("You are already at the destination."));
      return;
    }

    let cancelled = false;
    setIsRouteLoading(true);
    setRouteNotice(null);

    void (async () => {
      try {
        const shortestRoute = await getRoadRoute(waypoints, {
          vehicle: "car",
          locale: language === "fr" ? "fr" : "en",
        });
        if (cancelled) return;
        setRouteSummary(shortestRoute);
        setEtaBaseline((previous) =>
          !shouldUpdateEta && previous
            ? previous
            : buildEtaBaseline({
                incomingSeconds: Math.round(shortestRoute.durationMin * 60),
                previous,
                reset: shouldResetEta,
              }),
        );
        if (waypoints.length > 2) {
          const extraCount = waypoints.length - 2;
          setRouteNotice(
            extraCount === 1
              ? t("Multi-stop route includes {count} additional stop.", { count: extraCount })
              : t("Multi-stop route includes {count} additional stops.", { count: extraCount })
          );
        }
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
        const message = err instanceof Error ? err.message : t("Road route unavailable");
        setRouteNotice(t("{message}. Showing direct-line estimate.", { message }));
      } finally {
        if (!cancelled) {
          setIsRouteLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [language, multiStopEnabled, routeTasks, selectedTask, t, userLocation]);

  useEffect(() => {
    if (!etaBaseline) {
      setEtaCountdown(null);
      return;
    }

    const tick = () => {
      setEtaCountdown(formatEtaCountdown(getRemainingEtaSeconds(etaBaseline)));
    };

    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [etaBaseline]);

  const polylines = useMemo<LeafletPolyline[]>(() => {
    if (!selectedTask || !userLocation || !routeSummary) return [];
    return [
      {
        id: `route-${selectedTask.key}`,
        points: routeSummary.points,
        color: ROUTE_LINE_COLOR,
        weight: 7,
        dashed: routeSummary.source === "fallback",
      },
    ];
  }, [selectedTask, routeSummary, userLocation]);

  const markers = useMemo<LeafletMarker[]>(() => {
    const pickupMarkers: LeafletMarker[] = showPickups
      ? assignments
        .filter(
          (a) =>
            typeof a.latitude === "number" &&
            typeof a.longitude === "number" &&
            !isFinishedTaskStatus(a.status)
        )
        .map((a) => ({
          id: `pickup-${a.id}`,
          label: formatPickupTitle(a.waste_type),
          subtitle: a.address ?? undefined,
          details: [
            t("Status: {status}", { status: formatStatus(a.status) }),
            a.scheduled_date
              ? t("Scheduled: {date}", {
                date: new Date(a.scheduled_date).toLocaleDateString(locale),
              })
              : "",
            a.resident_name ? t("Resident: {name}", { name: a.resident_name }) : "",
          ].filter((line) => line.length > 0),
          kind: "pickup",
          lat: a.latitude as number,
          lng: a.longitude as number,
          color: Colors.primary,
          labelOnTop: selectedTaskKey === toTaskKey("pickup", a.id),
          isHighlighted: selectedTaskKey === toTaskKey("pickup", a.id),
        }))
      : [];

    const reportMarkers: LeafletMarker[] = showReports
      ? reports
        .filter(
          (r) =>
            typeof r.latitude === "number" &&
            typeof r.longitude === "number" &&
            !isFinishedTaskStatus(r.status)
        )
        .map((r) => ({
          id: `report-${r.id}`,
          label: formatReportTitle(r.report_type),
          subtitle: r.location_text ?? undefined,
          details: [
            t("Status: {status}", { status: formatStatus(r.status) }),
            r.resident_name ? t("Resident: {name}", { name: r.resident_name }) : "",
            t("Updated: {date}", { date: new Date(r.updated_at).toLocaleDateString(locale) }),
          ].filter((line) => line.length > 0),
          kind: "report",
          lat: r.latitude as number,
          lng: r.longitude as number,
          color: Colors.secondary,
          labelOnTop: selectedTaskKey === toTaskKey("report", r.id),
          isHighlighted: selectedTaskKey === toTaskKey("report", r.id),
        }))
      : [];

    if (!showPickups && selectedTask?.kind === "pickup") {
      const selectedPickup = assignments.find((item) => item.id === selectedTask.id);
      if (selectedPickup && typeof selectedPickup.latitude === "number" && typeof selectedPickup.longitude === "number") {
        pickupMarkers.push({
          id: `pickup-${selectedPickup.id}`,
          label: formatPickupTitle(selectedPickup.waste_type),
          subtitle: selectedPickup.address ?? undefined,
          details: [
            t("Status: {status}", { status: formatStatus(selectedPickup.status) }),
            selectedPickup.scheduled_date
              ? t("Scheduled: {date}", {
                date: new Date(selectedPickup.scheduled_date).toLocaleDateString(locale),
              })
              : "",
            selectedPickup.resident_name ? t("Resident: {name}", { name: selectedPickup.resident_name }) : "",
          ].filter((line) => line.length > 0),
          kind: "pickup",
          lat: selectedPickup.latitude,
          lng: selectedPickup.longitude,
          color: Colors.primary,
          labelOnTop: true,
          isHighlighted: true,
        });
      }
    }

    if (!showReports && selectedTask?.kind === "report") {
      const selectedReport = reports.find((item) => item.id === selectedTask.id);
      if (selectedReport && typeof selectedReport.latitude === "number" && typeof selectedReport.longitude === "number") {
        reportMarkers.push({
          id: `report-${selectedReport.id}`,
          label: formatReportTitle(selectedReport.report_type),
          subtitle: selectedReport.location_text ?? undefined,
          details: [
            t("Status: {status}", { status: formatStatus(selectedReport.status) }),
            selectedReport.resident_name ? t("Resident: {name}", { name: selectedReport.resident_name }) : "",
            t("Updated: {date}", { date: new Date(selectedReport.updated_at).toLocaleDateString(locale) }),
          ].filter((line) => line.length > 0),
          kind: "report",
          lat: selectedReport.latitude,
          lng: selectedReport.longitude,
          color: Colors.secondary,
          labelOnTop: true,
          isHighlighted: true,
        });
      }
    }

    return [...pickupMarkers, ...reportMarkers];
  }, [
    assignments,
    formatPickupTitle,
    formatReportTitle,
    formatStatus,
    locale,
    reports,
    selectedTask,
    selectedTaskKey,
    showPickups,
    showReports,
    t,
  ]);

  const effectiveUserLocation = displayUserLocation ?? userLocation;
  const mapUserLocation: LeafletUserLocation | null = effectiveUserLocation
    ? {
      lat: effectiveUserLocation.lat,
      lng: effectiveUserLocation.lng,
      accuracy: effectiveUserLocation.accuracy,
      label: t("Me"),
      color: Colors.error,
    }
    : null;

  const focusPoints = useMemo<LeafletPolylinePoint[]>(() => {
    if (routeSummary && routeSummary.points.length >= 2) {
      return routeSummary.points;
    }
    if (selectedTask && userLocation) {
      return [
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: selectedTask.lat, lng: selectedTask.lng },
      ];
    }
    if (selectedTask) {
      return [{ lat: selectedTask.lat, lng: selectedTask.lng }];
    }
    if (userLocation) {
      return [{ lat: userLocation.lat, lng: userLocation.lng }];
    }
    return [];
  }, [routeSummary, selectedTask, userLocation]);

  const openExternalRoute = async () => {
    if (!selectedTask) return;
    const destination = `${selectedTask.lat},${selectedTask.lng}`;
    const candidates = Platform.select<string[]>({
      ios: [`maps://?daddr=${destination}`, `maps://?q=${destination}`],
      android: [`google.navigation:q=${destination}`, `geo:0,0?q=${destination}`],
      default: [`https://www.google.com/maps/dir/?api=1&destination=${destination}`],
    }) ?? [];

    for (const url of candidates) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) continue;
        await Linking.openURL(url);
        return;
      } catch {
        // Try next candidate.
      }
    }

    toast.error(t("Unable to open map directions"));
  };

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(collector)/assigned");
  };

  const runMapCommand = useCallback((action: LeafletMapCommand["action"]) => {
    mapCommandSeqRef.current += 1;
    setMapCommand({ id: mapCommandSeqRef.current, action });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LeafletMap
        markers={markers}
        userLocation={mapUserLocation}
        polylines={polylines}
        focusPoints={focusPoints}
        containerStyle={StyleSheet.absoluteFill}
        enableClustering
        onMarkerPress={handleMarkerPress}
        forceShowMarkerLabels
        mapCommand={mapCommand}
      />

      <View
        style={[styles.topWrap, { paddingTop: insets.top + webTopInset + spacing.sm }]}
        onLayout={(event) => setTopSectionHeight(event.nativeEvent.layout.height)}
      >
        <View style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.topHeaderRow}>
            <Pressable
              style={({ pressed }) => [
                styles.iconAction,
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
              <AppText style={styles.title} color={colors.text}>{t("Collector Map")}</AppText>
              <AppText style={styles.subtitle} color={colors.textSecondary}>
                {t("Track assigned pickups, reports, and route ETA.")}
              </AppText>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.iconAction,
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
          </View>

        </View>

        <View style={[styles.selectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText style={styles.sectionLabel} color={colors.text}>{t("Selected destination")}</AppText>
          {routeTasks.length === 0 ? (
            <AppText style={styles.routeInfoText} color={colors.textSecondary}>
              {t("No assigned pickup/report with map coordinates.")}
            </AppText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.destinationRow}
            >
              {routeTasks.map((task) => {
                const isActive = task.key === selectedTaskKey;
                const taskColor = task.kind === "pickup" ? Colors.primary : Colors.secondary;
                return (
                  <Pressable
                    key={task.key}
                    style={({ pressed }) => [
                      styles.destinationChip,
                      {
                        borderColor: isActive ? taskColor : colors.border,
                        backgroundColor: isActive ? taskColor + "18" : colors.background,
                      },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => setSelectedTaskKey(task.key)}
                  >
                    <Ionicons
                      name={task.kind === "pickup" ? "trash-outline" : "warning-outline"}
                      size={15}
                      color={isActive ? taskColor : colors.textSecondary}
                    />
                    <View style={styles.destinationTextWrap}>
                      <AppText style={styles.destinationTitle} color={isActive ? taskColor : colors.text}>
                        {task.title}
                      </AppText>
                      <AppText style={styles.destinationMeta} color={colors.textSecondary}>
                        {formatStatus(task.status)}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {routeNotice ? (
            <View style={[styles.routeNoticeCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
              <AppText style={styles.routeNoticeText} color={colors.textSecondary}>{routeNotice}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.sideWrap, { top: sideActionsTop }]}>
        <Pressable
          style={({ pressed }) => [
            styles.sideIconAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => runMapCommand("zoom-in")}
          accessibilityRole="button"
          accessibilityLabel={t("Zoom in")}
        >
          <Ionicons name="add" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.sideIconAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => runMapCommand("zoom-out")}
          accessibilityRole="button"
          accessibilityLabel={t("Zoom out")}
        >
          <Ionicons name="remove" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.sideIconAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => void loadAssignments()}
          accessibilityRole="button"
          accessibilityLabel={t("Refresh assignments")}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={Colors.primary} />
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.sideIconAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
            !selectedTask && { opacity: 0.55 },
          ]}
          onPress={() => void openExternalRoute()}
          disabled={!selectedTask}
          accessibilityRole="button"
          accessibilityLabel={t("Open Navigation")}
        >
          <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
        </Pressable>

        {tracking ? (
          <Pressable
            style={({ pressed }) => [
              styles.sideIconAction,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={stopTracking}
            accessibilityRole="button"
            accessibilityLabel={t("Stop Sharing")}
          >
            <Ionicons name="pause-circle-outline" size={20} color={Colors.error} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.sideIconAction,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => void startTracking()}
            accessibilityRole="button"
            accessibilityLabel={t("Share Live Location")}
          >
            <Ionicons name="locate-outline" size={20} color={Colors.primaryDark} />
          </Pressable>
        )}
      </View>

      {selectedTask ? (
        <View
          style={[
            styles.bottomInfoCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={styles.bottomInfoHeader}>
            <View
              style={[
                styles.bottomTypeBadge,
                {
                  borderColor: selectedTask.color,
                  backgroundColor: `${selectedTask.color}18`,
                },
              ]}
            >
              <Ionicons
                name={selectedTask.kind === "pickup" ? "trash-outline" : "warning-outline"}
                size={13}
                color={selectedTask.color}
              />
              <AppText style={styles.bottomTypeText} color={selectedTask.color}>
                {selectedTask.kind === "pickup" ? t("Pickup") : t("Report")}
              </AppText>
            </View>
            {isRouteLoading ? <ActivityIndicator size="small" color={ROUTE_LINE_COLOR} /> : null}
          </View>
          <AppText style={styles.bottomTitle} color={colors.text} numberOfLines={1}>
            {selectedTask.title}
          </AppText>
          <View style={styles.bottomMetaRow}>
            <Ionicons name="time-outline" size={14} color={ROUTE_LINE_COLOR} />
            <AppText style={styles.bottomMetaText} color={colors.text}>
              {routeSummary ? etaCountdown ?? formatDuration(routeSummary.durationMin) : t("ETA pending")}
            </AppText>
            {routeSummary ? (
              <AppText style={styles.bottomMetaSubText} color={colors.textSecondary}>
                {formatDistance(routeSummary.distanceKm)}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}

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
            <View style={styles.filterSection}>
              <AppText style={styles.filterTitle} color={colors.textSecondary}>{t("Display filters")}</AppText>
              <View style={styles.filterGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      borderColor: showPickups ? Colors.primary : colors.border,
                      backgroundColor: showPickups ? Colors.primary + "15" : colors.background,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => setShowPickups((prev) => !prev)}
                >
                  <Ionicons name="trash-outline" size={14} color={showPickups ? Colors.primary : colors.textSecondary} />
                  <AppText style={styles.filterChipText} color={showPickups ? Colors.primary : colors.textSecondary}>
                    {t("Pickups")}
                  </AppText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      borderColor: showReports ? Colors.secondary : colors.border,
                      backgroundColor: showReports ? Colors.secondary + "15" : colors.background,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => setShowReports((prev) => !prev)}
                >
                  <Ionicons name="warning-outline" size={14} color={showReports ? Colors.secondary : colors.textSecondary} />
                  <AppText style={styles.filterChipText} color={showReports ? Colors.secondary : colors.textSecondary}>
                    {t("Reports")}
                  </AppText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      borderColor: multiStopEnabled ? Colors.primaryDark : colors.border,
                      backgroundColor: multiStopEnabled ? Colors.primaryDark + "15" : colors.background,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => setMultiStopEnabled((prev) => !prev)}
                >
                  <Ionicons name="git-network-outline" size={14} color={multiStopEnabled ? Colors.primaryDark : colors.textSecondary} />
                  <AppText style={styles.filterChipText} color={multiStopEnabled ? Colors.primaryDark : colors.textSecondary}>
                    {multiStopEnabled ? t("Multi-stop on") : t("Multi-stop")}
                  </AppText>
                </Pressable>
              </View>
            </View>
            <View style={styles.mapKeysList}>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Pickup location")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.legendDot, { backgroundColor: Colors.secondary }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Report location")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Me")}</AppText>
              </View>
              <View style={[styles.mapKeyRow, { borderColor: colors.border }]}>
                <View style={[styles.legendDot, { backgroundColor: ROUTE_LINE_COLOR }]} />
                <AppText style={styles.mapKeyText} color={colors.text}>{t("Road route")}</AppText>
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
  sideWrap: { position: "absolute", right: spacing.md, gap: spacing.md },
  sideIconAction: {
    width: 46,
    height: 46,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: 10,
    ...shadows.card,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "flex-start",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.button, fontFamily: fonts.bold },
  subtitle: { fontSize: fontSizes.xs, fontFamily: fonts.regular, marginTop: spacing.xs - 2 },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: 10,
  },
  destinationRow: { gap: 10 },
  destinationChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    minWidth: 170,
    maxWidth: 220,
  },
  destinationTextWrap: { flex: 1 },
  destinationTitle: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, textTransform: "capitalize" },
  destinationMeta: { fontSize: 11, fontFamily: fonts.medium, textTransform: "capitalize" },
  sectionLabel: { fontSize: fontSizes.md, fontFamily: fonts.semibold },
  routeInfoText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
  },
  routeNoticeCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  routeNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  bottomInfoCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 7,
    ...shadows.card,
  },
  bottomInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bottomTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  bottomTypeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    textTransform: "uppercase",
  },
  bottomTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semibold,
    textTransform: "capitalize",
  },
  bottomMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  bottomMetaText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
  },
  bottomMetaSubText: {
    fontSize: 11,
    fontFamily: fonts.medium,
  },
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
    ...shadows.raised,
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
  filterSection: { gap: spacing.sm, marginTop: spacing.xs - 2 },
  filterTitle: { fontSize: 11, fontFamily: fonts.semibold, textTransform: "uppercase" },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 11, fontFamily: fonts.semibold },
  mapKeysList: { gap: spacing.sm },
  mapKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  legendDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  mapKeyText: { fontSize: 11, fontFamily: fonts.semibold },
});