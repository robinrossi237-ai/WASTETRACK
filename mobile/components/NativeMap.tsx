import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from "@maplibre/maplibre-react-native";

export type LeafletMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color?: string;
  subtitle?: string;
  details?: string[];
  kind?: "pickup" | "collector" | "report" | "pin" | string;
  labelOnTop?: boolean;
  labelColor?: string;
  isHighlighted?: boolean;
};

export type LeafletUserLocation = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  label?: string;
  color?: string;
};

export type LeafletPolylinePoint = {
  lat: number;
  lng: number;
};

export type LeafletPolyline = {
  id: string;
  points: LeafletPolylinePoint[];
  color?: string;
  weight?: number;
  dashed?: boolean;
};

export type LeafletMapCommand = {
  id: number;
  action: "zoom-in" | "zoom-out" | "fit";
};

type NativeMapProps = {
  markers: LeafletMarker[];
  userLocation?: LeafletUserLocation | null;
  polylines?: LeafletPolyline[];
  focusPoints?: LeafletPolylinePoint[];
  height?: number;
  onMapPress?: (point: LeafletPolylinePoint) => void;
  onMarkerPress?: (marker: { id: string; kind?: string; label?: string }) => void;
  initialCenter?: LeafletPolylinePoint;
  initialZoom?: number;
  enableClustering?: boolean;
  autoFitToData?: boolean;
  forceShowMarkerLabels?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  mapCommand?: LeafletMapCommand | null;
};

const DEFAULT_CENTER = { lat: 4.0511, lng: 9.7679 };
const DEFAULT_ZOOM = 13;

/**
 * Keyless raster style (CARTO Voyager + OSM). No API key or account needed.
 * Passed as a JSON string so no style-spec type import is required.
 */
const MAP_STYLE_JSON = JSON.stringify({
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
});

const toLngLat = (point: LeafletPolylinePoint): [number, number] => [point.lng, point.lat];

const coarseSignature = (points: LeafletPolylinePoint[]): string =>
  JSON.stringify(points.map((point) => [Number(point.lat.toFixed(3)), Number(point.lng.toFixed(3))]));

export default function NativeMap(props: NativeMapProps) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LeafletMap = require("@/components/LeafletMap").default as typeof NativeMapView;
    return <LeafletMap {...props} />;
  }
  return <NativeMapView {...props} />;
}

function NativeMapView({
  markers,
  userLocation,
  polylines = [],
  focusPoints = [],
  height,
  onMapPress,
  onMarkerPress,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  enableClustering: _enableClustering,
  autoFitToData = true,
  forceShowMarkerLabels = false,
  containerStyle,
  mapCommand,
}: NativeMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const zoomRef = useRef<number>(initialZoom);
  const lastFitSignatureRef = useRef<string>("");
  const [isMapReady, setIsMapReady] = useState(false);

  void _enableClustering;

  const routeSources = useMemo(
    () =>
      polylines
        .map((line) => {
          const coordinates = line.points
            .filter((point) => point && typeof point.lat === "number" && typeof point.lng === "number")
            .map((point) => [point.lng, point.lat]);
          if (coordinates.length < 2) return null;
          return { line, coordinates };
        })
        .filter((entry): entry is { line: LeafletPolyline; coordinates: number[][] } => entry !== null),
    [polylines]
  );

  const applyFit = (points: LeafletPolylinePoint[], signature: string) => {
    const camera = cameraRef.current;
    if (!camera || points.length === 0) return;
    lastFitSignatureRef.current = signature;

    if (points.length === 1) {
      const target = points[0];
      camera.easeTo({
        center: toLngLat(target),
        zoom: Math.max(zoomRef.current, 14),
        duration: 700,
      });
      return;
    }

    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    if (maxLat - minLat < 0.005 && maxLng - minLng < 0.005) {
      camera.easeTo({
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        zoom: 15,
        duration: 700,
      });
      return;
    }

    camera.fitBounds([minLng, minLat, maxLng, maxLat], {
      padding: { top: 58, right: 34, bottom: 58, left: 34 },
      duration: 750,
    });
  };

  useEffect(() => {
    if (!isMapReady || !autoFitToData) return;
    const points = focusPoints.filter(
      (point) => point && typeof point.lat === "number" && typeof point.lng === "number"
    );
    if (points.length === 0) return;
    const signature = coarseSignature(points);
    if (signature === lastFitSignatureRef.current) return;
    applyFit(points, signature);
  }, [isMapReady, autoFitToData, focusPoints]);

  useEffect(() => {
    if (!isMapReady || !mapCommand) return;
    const camera = cameraRef.current;
    if (!camera) return;
    if (mapCommand.action === "zoom-in") {
      camera.zoomTo(Math.min(zoomRef.current + 1, 20), { duration: 300 });
      return;
    }
    if (mapCommand.action === "zoom-out") {
      camera.zoomTo(Math.max(zoomRef.current - 1, 1), { duration: 300 });
      return;
    }
    if (mapCommand.action === "fit") {
      lastFitSignatureRef.current = "";
      const points = focusPoints.filter(
        (point) => point && typeof point.lat === "number" && typeof point.lng === "number"
      );
      if (points.length > 0) {
        applyFit(points, coarseSignature(points));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapReady, mapCommand]);

  return (
    <View style={[height ? { height } : styles.flexFill, containerStyle]}>
      <MapLibreMap
        style={styles.flexFill}
        mapStyle={MAP_STYLE_JSON}
        onPress={(event) => {
          const raw = event.nativeEvent.lngLat as unknown;
          let lat: number | null = null;
          let lng: number | null = null;
          if (Array.isArray(raw) && raw.length >= 2) {
            lng = Number(raw[0]);
            lat = Number(raw[1]);
          } else if (raw && typeof raw === "object") {
            const record = raw as Record<string, unknown>;
            if (typeof record.latitude === "number" && typeof record.longitude === "number") {
              lat = record.latitude;
              lng = record.longitude;
            } else if (typeof record.lat === "number" && typeof record.lng === "number") {
              lat = record.lat;
              lng = record.lng;
            }
          }
          if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
            onMapPress?.({ lat, lng });
          }
        }}
        onRegionDidChange={(event) => {
          const zoom = event.nativeEvent.zoom;
          if (typeof zoom === "number" && Number.isFinite(zoom)) {
            zoomRef.current = zoom;
          }
        }}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: toLngLat(initialCenter), zoom: initialZoom }}
        />

        {routeSources.map(({ line, coordinates }) => {
          const weight = typeof line.weight === "number" ? line.weight : 7;
          const mainColor = line.color || "#16a34a";
          return (
            <GeoJSONSource
              key={line.id}
              id={`route-${line.id}`}
              data={{
                type: "FeatureCollection",
                features: [
                  { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
                ],
              }}
            >
              <Layer
                id={`route-${line.id}-casing`}
                type="line"
                style={{ lineColor: "#ffffff", lineWidth: weight + 3, lineOpacity: 0.86, lineCap: "round", lineJoin: "round" }}
              />
              <Layer
                id={`route-${line.id}-main`}
                type="line"
                style={{
                  lineColor: mainColor,
                  lineWidth: weight,
                  lineOpacity: 0.95,
                  lineCap: "round",
                  lineJoin: "round",
                  ...(line.dashed ? { lineDasharray: [8, 6] } : {}),
                }}
              />
            </GeoJSONSource>
          );
        })}

        {userLocation && typeof userLocation.lat === "number" && typeof userLocation.lng === "number" ? (
          <Marker
            id="user-location"
            lngLat={toLngLat(userLocation)}
            anchor="center"
          >
            <View style={styles.userWrap}>
              <View style={[styles.userRing, { borderColor: `${userLocation.color || "#ef4444"}55` }]} />
              <View style={[styles.userCore, { backgroundColor: userLocation.color || "#ef4444" }]} />
            </View>
          </Marker>
        ) : null}

        {markers.map((item) => {
          if (typeof item.lat !== "number" || typeof item.lng !== "number") return null;
          const color = item.color || "#16a34a";
          const size = item.isHighlighted ? 27 : 21;
          const showLabel = !!forceShowMarkerLabels || !!item.labelOnTop || !!item.isHighlighted;
          return (
            <Marker
              key={item.id}
              id={item.id}
              lngLat={[item.lng, item.lat]}
              anchor="bottom"
              onPress={() => onMarkerPress?.({ id: String(item.id), kind: item.kind, label: item.label })}
            >
              <View style={styles.markerColumn}>
                {showLabel && item.label ? (
                  <View style={styles.markerLabel}>
                    <View style={styles.markerLabelPill}>
                      <Text style={[styles.markerLabelText, { color: item.labelColor || "#0f172a" }]}>
                        {item.label}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.markerDot,
                    { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapLibreMap>
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  userWrap: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  userRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 14,
  },
  userCore: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.8, borderColor: "#ffffff" },
  markerColumn: { alignItems: "center" },
  markerLabel: { marginBottom: 2 },
  markerLabelPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
  },
  markerLabelText: { fontSize: 13, fontWeight: "700", lineHeight: 14 },
  markerDot: { borderWidth: 2.6, borderColor: "#ffffff" },
});
