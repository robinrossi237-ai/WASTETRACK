import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useLanguage } from "@/lib/language-context";

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

type LeafletMapProps = {
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

type BridgeMessage =
  | { type: "map-ready" }
  | { type: "map-press"; lat: number; lng: number }
  | { type: "marker-press"; id: string; kind?: string; label?: string };

const buildMapHtml = (input: {
  initialCenter: LeafletPolylinePoint;
  initialZoom: number;
  enableClustering: boolean;
  labels: {
    location: string;
    collector: string;
    pickup: string;
    report: string;
    pinned: string;
  };
}) => {
  const payload = JSON.stringify(input).replace(/</g, "\u003c");
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
        <style>
          html,
          body,
          #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #e2e8f0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .leaflet-container {
            background: #dce6ef;
          }
          .leaflet-control-attribution {
            font-size: 9px;
            background: rgba(255, 255, 255, 0.9);
          }
          .leaflet-popup-content-wrapper {
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.3);
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
          }
          .leaflet-popup-content {
            margin: 10px 12px;
          }
          .wt-point-icon {
            background: transparent;
            border: none;
          }
          .wt-point-wrap {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .wt-point-core {
            display: block;
            border-radius: 999px;
            border: 2.6px solid #ffffff;
            box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
          }
          .wt-gps-wrap {
            position: relative;
            width: 72px;
            height: 72px;
            display: block;
          }
          .wt-gps-ring {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            transform: translate(-50%, -50%) scale(0.2);
            opacity: 0;
            animation: wtGpsPulse 1.8s ease-out infinite;
          }
          .wt-gps-ring-delay {
            animation-delay: 0.9s;
          }
          .wt-gps-core {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            border: 2.8px solid #ffffff;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.28);
            transform: translate(-50%, -50%);
          }
          @keyframes wtGpsPulse {
            0% {
              transform: translate(-50%, -50%) scale(0.2);
              opacity: 0.5;
            }
            65% {
              opacity: 0.22;
            }
            100% {
              transform: translate(-50%, -50%) scale(3.1);
              opacity: 0;
            }
          }
          .wt-marker-label {
            pointer-events: none;
            background: transparent;
            border: none;
          }
          .wt-marker-label span {
            color: #0f172a;
            font-size: 13px;
            font-weight: 700;
            line-height: 1;
            padding: 3px 7px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid rgba(148, 163, 184, 0.45);
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
            white-space: nowrap;
            text-shadow: none;
          }
          .wt-cluster {
            background: transparent;
            border: none;
          }
          .wt-cluster-icon {
            width: 100%;
            height: 100%;
            border-radius: 999px;
            background: #1d4ed8;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            border: 2.2px solid #ffffff;
            box-shadow: 0 2px 10px rgba(29, 78, 216, 0.35);
          }
          .wt-user-label {
            pointer-events: none;
            background: transparent;
            border: none;
          }
          .wt-user-label span {
            color: #ef4444;
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(148, 163, 184, 0.55);
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
        <script>
          const config = ${payload};
          const labels = config.labels || {
            location: "Location",
            collector: "Collector",
            pickup: "Pickup",
            report: "Report",
            pinned: "Pinned"
          };

          const map = L.map("map", {
            zoomControl: true,
            attributionControl: true,
            preferCanvas: true,
          }).setView([config.initialCenter.lat, config.initialCenter.lng], config.initialZoom);

          L.tileLayer("https://tile.openfreeMap.org/styles/liberty/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "(c) OpenStreetMap contributors &copy; OpenFreeMap"
          }).addTo(map);

          let markerLayer = null;
          let markerLabelLayer = L.layerGroup().addTo(map);
          let routeLayer = L.layerGroup().addTo(map);
          let userLayer = L.layerGroup().addTo(map);
          let userPulseMarker = null;
          let userLabelMarker = null;
          let currentPayload = null;
          let lastFitSignature = "";

          const post = (payload) => {
            const serialized = JSON.stringify(payload);
            if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
              window.ReactNativeWebView.postMessage(serialized);
              return;
            }
            if (window.parent && window.parent !== window && typeof window.parent.postMessage === "function") {
              window.parent.postMessage(serialized, "*");
            }
          };

          const escapeHtml = (value) =>
            String(value ?? "").replace(/[&<>"']/g, (ch) => ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            }[ch]));

          const toRgba = (color, alpha) => {
            if (!color || typeof color !== "string") return "rgba(239,68,68," + alpha + ")";
            const value = color.trim();
            if (value.startsWith("rgba(") || value.startsWith("rgb(")) return value;
            if (!value.startsWith("#")) return "rgba(239,68,68," + alpha + ")";
            const hex = value.slice(1);
            if (hex.length === 3) {
              const r = parseInt(hex[0] + hex[0], 16);
              const g = parseInt(hex[1] + hex[1], 16);
              const b = parseInt(hex[2] + hex[2], 16);
              return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
            }
            if (hex.length === 6) {
              const r = parseInt(hex.slice(0, 2), 16);
              const g = parseInt(hex.slice(2, 4), 16);
              const b = parseInt(hex.slice(4, 6), 16);
              return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
            }
            return "rgba(239,68,68," + alpha + ")";
          };

          const kindMap = {
            collector: { label: labels.collector, color: "#2563eb" },
            pickup: { label: labels.pickup, color: "#16a34a" },
            report: { label: labels.report, color: "#f59e0b" },
            pin: { label: labels.pinned, color: "#7c3aed" },
          };

          const ensureMarkerLayer = () => {
            if (markerLayer) return;
            if (config.enableClustering) {
              markerLayer = L.markerClusterGroup({
                maxClusterRadius: 55,
                showCoverageOnHover: false,
                iconCreateFunction: (cluster) => {
                  const count = cluster.getChildCount();
                  const size = count < 10 ? 38 : count < 30 ? 44 : 50;
                  return L.divIcon({
                    html: '<div class="wt-cluster-icon">' + count + '</div>',
                    className: "wt-cluster",
                    iconSize: [size, size],
                  });
                },
              });
            } else {
              markerLayer = L.layerGroup();
            }
            markerLayer.addTo(map);
          };

          const clearUserLayers = () => {
            userLayer.clearLayers();
            userPulseMarker = null;
            userLabelMarker = null;
          };

          const setUserLocation = (userLocation) => {
            clearUserLayers();
            if (!userLocation || typeof userLocation.lat !== "number" || typeof userLocation.lng !== "number") {
              return;
            }

            const center = [userLocation.lat, userLocation.lng];
            const color = userLocation.color || "#ef4444";
            const ringStrong = toRgba(color, 0.32);
            const ringSoft = toRgba(color, 0.2);
            userPulseMarker = L.marker(center, {
              interactive: false,
              icon: L.divIcon({
                className: "wt-point-icon",
                html:
                  '<span class="wt-gps-wrap">' +
                    '<span class="wt-gps-ring" style="background:' + ringStrong + ';"></span>' +
                    '<span class="wt-gps-ring wt-gps-ring-delay" style="background:' + ringSoft + ';"></span>' +
                    '<span class="wt-gps-core" style="background:' + color + ';"></span>' +
                  '</span>',
                iconSize: [72, 72],
                iconAnchor: [36, 36],
              }),
            }).addTo(userLayer);

            if (userLocation.label) {
              userLabelMarker = L.marker([userLocation.lat + 0.00055, userLocation.lng], {
                interactive: false,
                icon: L.divIcon({
                  className: "wt-user-label",
                  html: "<span>" + escapeHtml(userLocation.label) + "</span>",
                  iconSize: [80, 24],
                  iconAnchor: [40, 12],
                }),
              }).addTo(userLayer);
            }
          };

          const drawMarkers = (markers, forceShowMarkerLabels) => {
            ensureMarkerLayer();
            markerLayer.clearLayers();
            markerLabelLayer.clearLayers();

            (Array.isArray(markers) ? markers : []).forEach((item) => {
              if (!item || typeof item.lat !== "number" || typeof item.lng !== "number") return;

              const color = item.color || "#16a34a";
              const size = item.isHighlighted ? 27 : 21;
              const marker = L.marker([item.lat, item.lng], {
                icon: L.divIcon({
                  className: "wt-point-icon",
                  html: '<span class="wt-point-wrap"><span class="wt-point-core" style="background:' +
                    color + ';width:' + size + 'px;height:' + size + 'px;"></span></span>',
                  iconSize: [size, size],
                  iconAnchor: [size / 2, size / 2],
                }),
              });

              const details = Array.isArray(item.details) ? item.details.slice(0, 6) : [];
              const subtitle = item.subtitle
                ? "<div style='margin-top:4px;color:#475569;font-size:12px;'>" + escapeHtml(item.subtitle) + "</div>"
                : "";
              const detailsHtml = details
                .filter((line) => typeof line === "string" && line.trim().length > 0)
                .map((line) => "<div style='margin-top:3px;color:#334155;font-size:11px;line-height:1.25;'>&bull; " + escapeHtml(line) + "</div>")
                .join("");
              const kindMeta = kindMap[item.kind || ""] || null;
              const kindHtml = kindMeta
                ? "<div style='display:inline-block;margin-bottom:5px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;color:#fff;background:" + kindMeta.color + ";'>" + kindMeta.label + "</div>"
                : "";

              marker.bindPopup(
                kindHtml +
                "<div style='font-weight:700;color:#0f172a;'>" + escapeHtml(item.label || labels.location) + "</div>" +
                subtitle +
                detailsHtml,
                { offset: [0, -10], autoPanPadding: [24, 24] }
              );

              marker.on("click", (event) => {
                if (event) {
                  L.DomEvent.stopPropagation(event);
                }
                post({
                  type: "marker-press",
                  id: String(item.id || ""),
                  kind: item.kind ? String(item.kind) : "",
                  label: item.label ? String(item.label) : "",
                });
              });
              marker.on("mouseover", () => {
                map.getContainer().style.cursor = "pointer";
              });
              marker.on("mouseout", () => {
                map.getContainer().style.cursor = "";
              });

              markerLayer.addLayer(marker);

              const showLabel = !!forceShowMarkerLabels || !!item.labelOnTop || !!item.isHighlighted;
              if (showLabel && item.label) {
                markerLabelLayer.addLayer(
                  L.marker([item.lat + 0.00042, item.lng], {
                    interactive: false,
                    icon: L.divIcon({
                      className: "wt-marker-label",
                      html: '<span style="color:' + escapeHtml(item.labelColor || color) + ';">' + escapeHtml(item.label) + "</span>",
                      iconSize: [120, 24],
                      iconAnchor: [60, 12],
                    }),
                  })
                );
              }
            });
          };

          const drawRoutes = (polylines) => {
            routeLayer.clearLayers();
            (Array.isArray(polylines) ? polylines : []).forEach((line) => {
              if (!line || !Array.isArray(line.points) || line.points.length < 2) return;
              const latlngs = line.points
                .filter((point) => point && typeof point.lat === "number" && typeof point.lng === "number")
                .map((point) => [point.lat, point.lng]);
              if (latlngs.length < 2) return;
              const baseWeight = typeof line.weight === "number" ? line.weight : 7;
              const mainColor = line.color || "#16a34a";
              routeLayer.addLayer(
                L.polyline(latlngs, {
                  color: "#ffffff",
                  weight: baseWeight + 3,
                  opacity: 0.86,
                  lineCap: "round",
                  lineJoin: "round",
                })
              );
              routeLayer.addLayer(
                L.polyline(latlngs, {
                  color: mainColor,
                  weight: baseWeight,
                  opacity: 0.95,
                  dashArray: line.dashed ? "8 6" : undefined,
                  lineCap: "round",
                  lineJoin: "round",
                })
              );
            });
          };

          const getAutoFitPoints = (payload) => {
            const focusPoints = Array.isArray(payload.focusPoints) ? payload.focusPoints : [];
            const explicit = focusPoints
              .filter((point) => point && typeof point.lat === "number" && typeof point.lng === "number")
              .map((point) => [point.lat, point.lng]);
            if (explicit.length > 0) return explicit;

            const points = [];
            const markers = Array.isArray(payload.markers) ? payload.markers : [];
            const polylines = Array.isArray(payload.polylines) ? payload.polylines : [];
            const userLocation = payload.userLocation;

            markers.forEach((marker) => {
              if (typeof marker.lat === "number" && typeof marker.lng === "number") {
                points.push([marker.lat, marker.lng]);
              }
            });
            polylines.forEach((line) => {
              if (!line || !Array.isArray(line.points)) return;
              line.points.forEach((point) => {
                if (point && typeof point.lat === "number" && typeof point.lng === "number") {
                  points.push([point.lat, point.lng]);
                }
              });
            });
            if (userLocation && typeof userLocation.lat === "number" && typeof userLocation.lng === "number") {
              points.push([userLocation.lat, userLocation.lng]);
            }

            return points;
          };

          const applyAutoFit = (payload) => {
            if (payload.autoFitToData === false) return;
            const points = getAutoFitPoints(payload);
            if (points.length === 0) return;

            const signature = JSON.stringify(points);
            if (signature === lastFitSignature) return;
            lastFitSignature = signature;

            if (points.length === 1) {
              const currentZoom = map.getZoom();
              map.flyTo(points[0], Math.max(currentZoom, 14), {
                animate: true,
                duration: 0.7,
              });
              return;
            }

            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, {
              padding: [58, 34],
              maxZoom: 17,
              animate: true,
              duration: 0.75,
            });
          };

          const applyPayload = (payload) => {
            drawMarkers(payload.markers, !!payload.forceShowMarkerLabels);
            setUserLocation(payload.userLocation || null);
            drawRoutes(payload.polylines);
            applyAutoFit(payload);
          };

          window.__updateFromNative = (payload) => {
            currentPayload = payload || {};
            applyPayload(currentPayload);
          };

          window.__runCommandFromNative = (command) => {
            if (!command || !command.action) return;
            if (command.action === "zoom-in") {
              map.zoomIn();
              return;
            }
            if (command.action === "zoom-out") {
              map.zoomOut();
              return;
            }
            if (command.action === "fit" && currentPayload) {
              applyAutoFit(currentPayload);
            }
          };

          window.addEventListener("message", (event) => {
            let incoming = event && event.data;
            if (!incoming) return;
            if (typeof incoming === "string") {
              try {
                incoming = JSON.parse(incoming);
              } catch {
                return;
              }
            }
            if (!incoming || typeof incoming !== "object") return;
            if (incoming.type === "wt-update") {
              window.__updateFromNative(incoming.payload || {});
              return;
            }
            if (incoming.type === "wt-command") {
              window.__runCommandFromNative(incoming.command || null);
            }
          });

          map.on("click", (event) => {
            post({
              type: "map-press",
              lat: event.latlng.lat,
              lng: event.latlng.lng,
            });
          });

          map.whenReady(() => {
            if (currentPayload) {
              applyPayload(currentPayload);
            }
            post({ type: "map-ready" });
          });

        </script>
      </body>
    </html>
  `;
};

const parseBridgeMessage = (raw: unknown): BridgeMessage | null => {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const type = typeof data.type === "string" ? data.type : "";

  if (type === "map-ready") {
    return { type: "map-ready" };
  }

  if (type === "map-press") {
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    return { type: "map-press", lat: data.lat, lng: data.lng };
  }

  if (type === "marker-press") {
    const id = typeof data.id === "string" ? data.id : String(data.id ?? "");
    return {
      type: "marker-press",
      id,
      kind: typeof data.kind === "string" ? data.kind : undefined,
      label: typeof data.label === "string" ? data.label : undefined,
    };
  }

  return null;
};

export default function LeafletMap({
  markers,
  userLocation,
  polylines = [],
  focusPoints = [],
  height,
  onMapPress,
  onMarkerPress,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  enableClustering = true,
  autoFitToData = true,
  forceShowMarkerLabels = false,
  containerStyle,
  mapCommand,
}: LeafletMapProps) {
  const { t } = useLanguage();
  const isWeb = Platform.OS === "web";
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const IFrame = "iframe" as any;

  const labels = useMemo(
    () => ({
      location: t("Location"),
      collector: t("Collector"),
      pickup: t("Pickup"),
      report: t("Report"),
      pinned: t("Pinned"),
    }),
    [t]
  );

  const html = useMemo(
    () =>
      buildMapHtml({
        initialCenter,
        initialZoom,
        enableClustering,
        labels,
      }),
    [enableClustering, initialCenter, initialZoom, labels]
  );

  const payload = useMemo(
    () => ({
      markers,
      userLocation,
      polylines,
      focusPoints,
      autoFitToData,
      forceShowMarkerLabels,
    }),
    [autoFitToData, focusPoints, forceShowMarkerLabels, markers, polylines, userLocation]
  );

  useEffect(() => {
    setIsMapReady(false);
  }, [html]);

  useEffect(() => {
    if (!isWeb) return;
    const root = globalThis as {
      addEventListener?: (type: string, listener: (event: unknown) => void) => void;
      removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
    };
    if (typeof root.addEventListener !== "function") return;

    const listener = (event: unknown) => {
      const incoming = event as { source?: unknown; data?: unknown };
      const frameWindow = iframeRef.current?.contentWindow;
      if (frameWindow && incoming.source && incoming.source !== frameWindow) {
        return;
      }
      const data = parseBridgeMessage(incoming.data);
      if (!data) return;
      if (data.type === "map-ready") {
        setIsMapReady(true);
        return;
      }
      if (data.type === "map-press" && onMapPress) {
        onMapPress({ lat: data.lat, lng: data.lng });
        return;
      }
      if (data.type === "marker-press" && onMarkerPress) {
        onMarkerPress({ id: data.id, kind: data.kind, label: data.label });
      }
    };

    root.addEventListener("message", listener);
    return () => {
      if (typeof root.removeEventListener === "function") {
        root.removeEventListener("message", listener);
      }
    };
  }, [isWeb, onMapPress, onMarkerPress]);

  useEffect(() => {
    if (!isMapReady) return;
    if (isWeb) {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || typeof frameWindow.postMessage !== "function") return;
      frameWindow.postMessage({ type: "wt-update", payload }, "*");
      return;
    }
    if (!webRef.current) return;
    const encodedPayload = encodeURIComponent(JSON.stringify(payload));
    webRef.current.injectJavaScript(
      `window.__updateFromNative(JSON.parse(decodeURIComponent('${encodedPayload}'))); true;`
    );
  }, [isMapReady, isWeb, payload]);

  useEffect(() => {
    if (!isMapReady || !mapCommand) return;
    if (isWeb) {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || typeof frameWindow.postMessage !== "function") return;
      frameWindow.postMessage({ type: "wt-command", command: mapCommand }, "*");
      return;
    }
    if (!webRef.current) return;
    const encodedCommand = encodeURIComponent(JSON.stringify(mapCommand));
    webRef.current.injectJavaScript(
      `window.__runCommandFromNative(JSON.parse(decodeURIComponent('${encodedCommand}'))); true;`
    );
  }, [isMapReady, isWeb, mapCommand]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = parseBridgeMessage(event.nativeEvent.data);
    if (!data) return;
    if (data.type === "map-ready") {
      setIsMapReady(true);
      return;
    }
    if (data.type === "map-press" && onMapPress) {
      onMapPress({ lat: data.lat, lng: data.lng });
      return;
    }
    if (data.type === "marker-press" && onMarkerPress) {
      onMarkerPress({ id: data.id, kind: data.kind, label: data.label });
    }
  };

  if (isWeb) {
    return (
      <View style={[height ? { height } : styles.flexFill, containerStyle]}>
        <IFrame
          ref={(node: unknown) => {
            iframeRef.current = node;
          }}
          srcDoc={html}
          title={t("Logistics Map")}
          allow="geolocation"
          sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          style={{
            border: "0",
            width: "100%",
            height: "100%",
            display: "block",
            backgroundColor: "#dce6ef",
          }}
        />
      </View>
    );
  }

  return (
    <View style={[height ? { height } : styles.flexFill, containerStyle]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        onMessage={handleMessage}
        style={styles.flexFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
});
