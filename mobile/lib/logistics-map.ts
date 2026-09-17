export type MapCoordinate = {
  lat: number;
  lng: number;
};

export type GeocodeResult = {
  coordinate: MapCoordinate;
  formattedAddress: string;
};

export type LogisticsRouteSource = "graphhopper" | "osrm" | "fallback";

export type LogisticsRouteSummary = {
  points: MapCoordinate[];
  distanceKm: number;
  durationMin: number;
  source: LogisticsRouteSource;
};

type GeocodeFeature = {
  geometry?: {
    coordinates?: number[];
  };
  properties?: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    street?: string;
    district?: string;
  };
};

type PhotonReversePayload = {
  features?: GeocodeFeature[];
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
};

type NominatimResponse = {
  results?: NominatimResult[];
  display_name?: string;
  lat?: string;
  lon?: string;
};

type GraphHopperPath = {
  distance?: number;
  time?: number;
  points?: string;
};

type GraphHopperErrorPayload = {
  message?: string;
  hints?: { message?: string }[];
};

type GraphHopperRoutePayload = {
  paths?: GraphHopperPath[];
  message?: string;
  hints?: { message?: string }[];
};

type GraphHopperRouteOptions = {
  vehicle?: "car" | "bike" | "foot";
  locale?: string;
};

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: number[][];
  };
};

type OsrmRoutePayload = {
  code?: string;
  message?: string;
  routes?: OsrmRoute[];
};

const GRAPHHOPPER_API_KEY = process.env.EXPO_PUBLIC_GRAPHHOPPER_KEY?.trim() ?? "";

export const DOUALA_CENTER: MapCoordinate = { lat: 4.0511, lng: 9.7679 };
export const DOUALA_DEFAULT_ZOOM = 13;

const NOMINATIM_HEADERS: Record<string, string> = {
  "User-Agent": "WasteTrackApp/1.0 (contact: tambatdekini@gmail.com)",
  Accept: "application/json",
};

const ensureApiKey = (value: string, label: string) => {
  if (!value) {
    throw new Error(`${label} API key is missing`);
  }
};

const parseCoordinate = (value: string | undefined): number | null => {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPhotonUrl = (
  query: string,
  opts: { reverse?: boolean; lat?: number; lng?: number }
): string => {
  const params = new URLSearchParams();
  params.set("lang", "en");
  if (opts.reverse) {
    params.set("lon", String(opts.lng));
    params.set("lat", String(opts.lat));
    return `https://photon.komoot.io/reverse?${params.toString()}`;
  }
  params.set("q", query);
  params.set("limit", "1");
  params.set("lat", String(DOUALA_CENTER.lat));
  params.set("lon", String(DOUALA_CENTER.lng));
  return `https://photon.komoot.io/api/?${params.toString()}`;
};

const buildGeocodeLabel = (feature: GeocodeFeature | undefined, fallback: string): string => {
  const p = feature?.properties;
  if (!p) return fallback;
  const parts = [
    p.name,
    p.street,
    p.district || p.city,
    p.county,
    p.state,
    p.country,
  ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  return unique.length > 0 ? unique.join(", ") : fallback;
};

const photonGeocode = async (
  query: string,
  reverse?: { lat: number; lng: number }
): Promise<{ coordinate: MapCoordinate | null; label: string } | null> => {
  try {
    const url = reverse
      ? buildPhotonUrl(query, { reverse: true, lat: reverse.lat, lng: reverse.lng })
      : buildPhotonUrl(query, {});
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as PhotonReversePayload;
    const feature = payload.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!reverse && (!Array.isArray(coords) || coords.length < 2)) {
      return null;
    }
    let coordinate: MapCoordinate | null = null;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coordinate = { lat, lng };
      }
    }
    return {
      coordinate,
      label: buildGeocodeLabel(feature, query.trim()),
    };
  } catch {
    return null;
  }
};

const nominatimGeocode = async (
  query: string,
  reverse?: { lat: number; lng: number }
): Promise<{ coordinate: MapCoordinate | null; label: string } | null> => {
  try {
    const url = reverse
      ? `https://nominatim.openstreetmap.org/reverse?lat=${reverse.lat}&lon=${reverse.lng}&format=jsonv2`
      : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=cm&viewbox=9.6,4.15,9.9,3.9&bounded=1`;
    const response = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!response.ok) {
      return null;
    }
    if (reverse) {
      const payload = (await response.json()) as NominatimResponse;
      return {
        coordinate: null,
        label: payload.display_name || query.trim(),
      };
    }
    const payload = (await response.json()) as NominatimResponse;
    const first = payload.results?.[0];
    const lat = parseCoordinate(first?.lat);
    const lon = parseCoordinate(first?.lon);
    if (lat === null || lon === null) {
      return null;
    }
    return {
      coordinate: { lat, lng: lon },
      label: first?.display_name || first?.name || query.trim(),
    };
  } catch {
    return null;
  }
};

export const haversineDistanceKm = (from: MapCoordinate, to: MapCoordinate): number => {
  const earthRadiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const buildFallbackRoute = (
  from: MapCoordinate,
  to: MapCoordinate,
  averageSpeedKmPerHour = 30
): LogisticsRouteSummary => {
  const distanceKm = haversineDistanceKm(from, to);
  const durationMin = distanceKm <= 0.03 ? 0 : (distanceKm / averageSpeedKmPerHour) * 60;
  return {
    points: [from, to],
    distanceKm,
    durationMin,
    source: "fallback",
  };
};

export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

export const formatDuration = (durationMin: number): string => {
  if (durationMin < 1) return "<1 min";
  const roundedMinutes = Math.round(durationMin);
  if (roundedMinutes < 60) return `${roundedMinutes} min`;
  const hours = Math.floor(roundedMinutes / 60);
  const mins = roundedMinutes % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
};

export const decodeGraphHopperPolyline = (encoded: string): MapCoordinate[] => {
  if (!encoded) return [];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: MapCoordinate[] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const latDelta = result & 1 ? ~(result >> 1) : result >> 1;
    lat += latDelta;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const lngDelta = result & 1 ? ~(result >> 1) : result >> 1;
    lng += lngDelta;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
};

export const geocodeAddress = async (query: string): Promise<GeocodeResult | null> => {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const photonResult = await photonGeocode(trimmed);
  if (photonResult?.coordinate) {
    return {
      coordinate: photonResult.coordinate,
      formattedAddress: photonResult.label || trimmed,
    };
  }

  const nominatimResult = await nominatimGeocode(trimmed);
  if (nominatimResult?.coordinate) {
    return {
      coordinate: nominatimResult.coordinate,
      formattedAddress: nominatimResult.label || trimmed,
    };
  }

  return null;
};

export const reverseGeocode = async (coordinate: MapCoordinate): Promise<string | null> => {
  const photonResult = await photonGeocode("", {
    lat: coordinate.lat,
    lng: coordinate.lng,
  });
  if (photonResult?.label) {
    return photonResult.label;
  }

  const nominatimResult = await nominatimGeocode("", {
    lat: coordinate.lat,
    lng: coordinate.lng,
  });
  return nominatimResult?.label || null;
};

const getGraphHopperErrorMessage = (payload: GraphHopperErrorPayload): string => {
  if (payload.message) return payload.message;
  const hint = payload.hints?.find((entry) => typeof entry.message === "string")?.message;
  if (hint) return hint;
  return "Routing service is unavailable";
};

export const getGraphHopperRoute = async (
  waypoints: MapCoordinate[],
  options: GraphHopperRouteOptions = {}
): Promise<LogisticsRouteSummary> => {
  if (waypoints.length < 2) {
    throw new Error("At least two waypoints are required to calculate a route");
  }
  ensureApiKey(GRAPHHOPPER_API_KEY, "GraphHopper");

  const params = new URLSearchParams();
  waypoints.forEach((point) => {
    params.append("point", `${point.lat},${point.lng}`);
  });
  params.set("vehicle", options.vehicle ?? "car");
  params.set("locale", options.locale ?? "en");
  params.set("instructions", "false");
  params.set("calc_points", "true");
  params.set("points_encoded", "true");
  params.set("key", GRAPHHOPPER_API_KEY);

  const response = await fetch(`https://graphhopper.com/api/1/route?${params.toString()}`);
  if (!response.ok) {
    let message = "Routing service is unavailable";
    try {
      const errorPayload = (await response.json()) as GraphHopperErrorPayload;
      message = getGraphHopperErrorMessage(errorPayload);
    } catch {
      // Ignore JSON parsing errors and use fallback message.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as GraphHopperRoutePayload;
  if (!Array.isArray(payload.paths) || payload.paths.length === 0) {
    throw new Error(getGraphHopperErrorMessage(payload));
  }

  const path = payload.paths.reduce((best, candidate) => {
    const bestDistance = typeof best.distance === "number" ? best.distance : Number.POSITIVE_INFINITY;
    const candidateDistance =
      typeof candidate.distance === "number" ? candidate.distance : Number.POSITIVE_INFINITY;
    return candidateDistance < bestDistance ? candidate : best;
  });

  const encodedPoints = typeof path.points === "string" ? path.points : "";
  const routePoints = decodeGraphHopperPolyline(encodedPoints);
  if (routePoints.length < 2) {
    throw new Error("Routing service returned an invalid route");
  }

  const distanceMeters = typeof path.distance === "number" ? path.distance : 0;
  const durationMs = typeof path.time === "number" ? path.time : 0;

  return {
    points: routePoints,
    distanceKm: distanceMeters / 1000,
    durationMin: durationMs / 60000,
    source: "graphhopper",
  };
};

const getOsrmProfile = (vehicle: GraphHopperRouteOptions["vehicle"]): "driving" | "cycling" | "walking" => {
  if (vehicle === "bike") return "cycling";
  if (vehicle === "foot") return "walking";
  return "driving";
};

const parseOsrmRoutePoints = (route: OsrmRoute): MapCoordinate[] => {
  const coordinates = route.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .filter(
      (point): point is number[] =>
        Array.isArray(point)
        && point.length >= 2
        && typeof point[0] === "number"
        && typeof point[1] === "number"
    )
    .map((point) => ({ lat: point[1], lng: point[0] }));
};

export const getOsrmRoute = async (
  waypoints: MapCoordinate[],
  options: GraphHopperRouteOptions = {}
): Promise<LogisticsRouteSummary> => {
  if (waypoints.length < 2) {
    throw new Error("At least two waypoints are required to calculate a route");
  }

  const profile = getOsrmProfile(options.vehicle);
  const encodedCoordinates = waypoints.map((point) => `${point.lng},${point.lat}`).join(";");
  const params = new URLSearchParams({
    alternatives: "false",
    overview: "full",
    geometries: "geojson",
    steps: "false",
  });
  const url = `https://router.project-osrm.org/route/v1/${profile}/${encodedCoordinates}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("OSRM routing service is unavailable");
  }

  const payload = (await response.json()) as OsrmRoutePayload;
  if (payload.code !== "Ok" || !Array.isArray(payload.routes) || payload.routes.length === 0) {
    throw new Error(payload.message || "OSRM returned an invalid route");
  }

  const bestRoute = payload.routes.reduce((best, candidate) => {
    const bestDistance = typeof best.distance === "number" ? best.distance : Number.POSITIVE_INFINITY;
    const candidateDistance =
      typeof candidate.distance === "number" ? candidate.distance : Number.POSITIVE_INFINITY;
    return candidateDistance < bestDistance ? candidate : best;
  });

  const routePoints = parseOsrmRoutePoints(bestRoute);
  if (routePoints.length < 2) {
    throw new Error("OSRM returned an invalid route geometry");
  }

  const distanceMeters = typeof bestRoute.distance === "number" ? bestRoute.distance : 0;
  const durationSeconds = typeof bestRoute.duration === "number" ? bestRoute.duration : 0;

  return {
    points: routePoints,
    distanceKm: distanceMeters / 1000,
    durationMin: durationSeconds / 60,
    source: "osrm",
  };
};

export const getRoadRoute = async (
  waypoints: MapCoordinate[],
  options: GraphHopperRouteOptions = {}
): Promise<LogisticsRouteSummary> => {
  try {
    return await getOsrmRoute(waypoints, options);
  } catch (osrmError) {
    if (GRAPHHOPPER_API_KEY) {
      try {
        return await getGraphHopperRoute(waypoints, options);
      } catch (graphHopperError) {
        const firstMessage =
          osrmError instanceof Error ? osrmError.message : "OSRM route unavailable";
        const secondMessage =
          graphHopperError instanceof Error ? graphHopperError.message : "GraphHopper route unavailable";
        throw new Error(`${firstMessage}; ${secondMessage}`);
      }
    }
    throw osrmError instanceof Error ? osrmError : new Error("OSRM route unavailable");
  }
};

export const orderStopsByNearestNeighbor = (
  origin: MapCoordinate,
  stops: MapCoordinate[]
): MapCoordinate[] => {
  const pending = [...stops];
  const ordered: MapCoordinate[] = [];
  let current = origin;

  while (pending.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    pending.forEach((candidate, index) => {
      const distance = haversineDistanceKm(current, candidate);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [nextStop] = pending.splice(nearestIndex, 1);
    ordered.push(nextStop);
    current = nextStop;
  }

  return ordered;
};

export const buildMultiStopWaypoints = (
  origin: MapCoordinate,
  destination: MapCoordinate,
  extraStops: MapCoordinate[],
  maxStops = 5
): MapCoordinate[] => {
  if (extraStops.length === 0) {
    return [origin, destination];
  }

  const filtered = extraStops.filter(
    (item) => item.lat !== destination.lat || item.lng !== destination.lng
  );
  const ordered = orderStopsByNearestNeighbor(origin, filtered);
  const limitedStops = ordered.slice(0, Math.max(0, maxStops - 2));
  return [origin, ...limitedStops, destination];
};
