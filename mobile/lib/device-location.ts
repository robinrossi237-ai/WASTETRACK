import { Platform } from "react-native";
import * as Location from "expo-location";
import { isReasonablePhoneStyleLocation, toPhoneStyleLocation } from "@/lib/location-label";

export type CapturedDeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  label: string;
};

type CaptureDeviceLocationOptions = {
  requestPermission?: boolean;
  includeLabel?: boolean;
  allowCoordinateFallback?: boolean;
  retries?: number;
  timeoutMs?: number;
  accuracy?: Location.Accuracy;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("location_timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

type RawCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type BigDataCloudLocalityInfoEntry = {
  name?: string;
  description?: string;
  order?: number;
};

type BigDataCloudReversePayload = {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  plusCode?: string;
  localityInfo?: {
    informative?: BigDataCloudLocalityInfoEntry[];
    administrative?: BigDataCloudLocalityInfoEntry[];
  };
};

type NativeReverseGeocodePlace = {
  name?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
  street?: string | null;
  streetNumber?: string | null;
};

const normalizeText = (value?: string | null): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const normalizeCompare = (value?: string | null): string => normalizeText(value).toLowerCase();

const dedupeLabelParts = (parts: (string | null | undefined)[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const part of parts) {
    const normalized = normalizeText(part);
    if (!normalized) continue;
    const key = normalizeCompare(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
};

const isLikelyStreetNumber = (value: string): boolean =>
  /^\d+[a-z]?$/i.test(value.replace(/\s+/g, ""));

const buildNativeReverseGeocodeLabel = (place?: NativeReverseGeocodePlace): string => {
  if (!place) return "";

  const streetNumber = normalizeText(place.streetNumber);
  const street = normalizeText(place.street);
  const streetLabel =
    street.length > 0 ? (streetNumber.length > 0 ? `${streetNumber} ${street}` : street) : "";

  const name = normalizeText(place.name);
  const cleanedName = isLikelyStreetNumber(name) ? "" : name;

  const parts = dedupeLabelParts([
    streetLabel,
    cleanedName,
    place.district,
    place.city || place.subregion,
    place.region,
    place.country,
  ]);

  return parts.join(", ");
};

const getWebLanguageCode = (): string => {
  const rawLanguage =
    (globalThis as { navigator?: { language?: string } }).navigator?.language ?? "en";
  const normalized = normalizeText(rawLanguage).toLowerCase();
  if (!normalized) return "en";
  return normalized.split("-")[0] || "en";
};

const pickWebInformativeArea = (
  entries: BigDataCloudLocalityInfoEntry[] | undefined,
  city?: string,
  locality?: string
): string => {
  if (!Array.isArray(entries) || entries.length === 0) return "";

  const sorted = entries
    .filter((entry) => normalizeText(entry?.name).length > 0)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

  const cityKey = normalizeCompare(city);
  const localityKey = normalizeCompare(locality);

  for (const entry of sorted) {
    const name = normalizeText(entry.name);
    if (!name) continue;
    const key = normalizeCompare(name);
    if (!key || key === cityKey || key === localityKey) continue;
    return name;
  }

  return "";
};

// Validate if location is reasonably in Cameroon area
// Cameroon's approximate bounding box: lat 1-14, lng 8.5-16.5
const isReasonableLocation = (latitude: number, longitude: number): boolean => {
  // Reject locations that are clearly outside Cameroon
  // Cameroon bounds with some buffer: lat ~1-14.5, lng ~8-17
  const isInCameroonBounds = latitude > 0.5 && latitude < 14.5 && longitude > 7.5 && longitude < 17;
  
  // Reject USA locations (particularly California: lat 32-43, lng -124 to -114)
  const isInUSA = latitude > 25 && latitude < 50 && longitude < -60 && longitude > -130;
  
  // Reject Europe
  const isInEurope = latitude > 35 && latitude < 71 && longitude > -20 && longitude < 45;
  
  return isInCameroonBounds && !isInUSA && !isInEurope;
};

const getWebCurrentPosition = async (timeoutMs: number): Promise<RawCoords | null> => {
  const webNavigator = (globalThis as { navigator?: { geolocation?: any } }).navigator;
  if (!webNavigator?.geolocation) {
    return null;
  }

  return await new Promise<RawCoords | null>((resolve) => {
    webNavigator.geolocation.getCurrentPosition(
      (position: any) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Validate location is reasonable (in Cameroon area)
        if (!isReasonableLocation(lat, lng)) {
          resolve(null);
          return;
        }
        
        resolve({
          latitude: lat,
          longitude: lng,
          accuracy: typeof position.coords.accuracy === "number" ? position.coords.accuracy : null,
        });
      },
      (_error: unknown) => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
};

type PhotonReverseFeature = {
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

const buildPhotonReverseLabel = (
  p: PhotonReverseFeature["properties"]
): string => {
  if (!p) return "";
  const parts = dedupeLabelParts([
    p.street,
    p.name,
    p.district || p.city,
    p.county,
    p.state,
    p.country,
  ]);
  return parts.join(", ");
};

const reverseGeocodePhotonWeb = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const url =
      `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`;
    const response = await withTimeout(fetch(url), 5_000);
    if (!response.ok) return "";
    const payload = (await response.json()) as { features?: PhotonReverseFeature[] };
    const feature = payload.features?.[0];
    const label = buildPhotonReverseLabel(feature?.properties);
    return label;
  } catch {
    // Best effort only.
  }
  return "";
};

type NominatimReversePayload = {
  display_name?: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    hamlet?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

const buildNominatimReverseLabel = (address: NominatimReversePayload["address"]): string => {
  if (!address) return "";
  const parts = dedupeLabelParts([
    address.road,
    address.neighbourhood || address.quarter || address.suburb,
    address.city || address.town || address.village || address.municipality,
    address.county || address.state,
    address.country,
  ]);
  return parts.join(", ");
};

const reverseGeocodeNominatimWeb = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2`;
    const response = await withTimeout(
      fetch(url, {
        headers: {
          "User-Agent": "WasteTrackApp/1.0 (contact: tambatdekini@gmail.com)",
          Accept: "application/json",
        },
      }),
      5_000
    );
    if (!response.ok) return "";
    const payload = (await response.json()) as NominatimReversePayload;
    if (payload.address?.road) {
      return buildNominatimReverseLabel(payload.address);
    }
    if (payload.display_name) {
      return payload.display_name;
    }
  } catch {
    // Best effort only.
  }
  return "";
};

const reverseGeocodeWeb = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const language = getWebLanguageCode();
    const response = await withTimeout(
      fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=${encodeURIComponent(language)}`
      ),
      5_000
    );
    if (!response.ok) return "";
    const payload = (await response.json()) as BigDataCloudReversePayload;
    const informativeArea = pickWebInformativeArea(payload.localityInfo?.informative, payload.city, payload.locality);

    const parts = dedupeLabelParts([
      payload.locality,
      informativeArea,
      payload.city,
      payload.principalSubdivision,
      payload.countryName,
    ]);

    if (parts.length > 0) {
      return parts.join(", ");
    }
  } catch {
    // Best effort only.
  }
  return "";
};

const buildLocationLabel = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const nativeLabel = buildNativeReverseGeocodeLabel(places[0] as NativeReverseGeocodePlace | undefined);
    if (nativeLabel.length > 0) {
      return nativeLabel;
    }
  } catch {
    // Best effort only.
  }

  if (Platform.OS === "web") {
    const photonLabel = await reverseGeocodePhotonWeb(latitude, longitude);
    if (photonLabel.length > 0) {
      return photonLabel;
    }
    const streetLabel = await reverseGeocodeNominatimWeb(latitude, longitude);
    if (streetLabel.length > 0) {
      return streetLabel;
    }
    const webLabel = await reverseGeocodeWeb(latitude, longitude);
    if (webLabel.length > 0) {
      return webLabel;
    }
  }

  return "";
};

export const captureCurrentDeviceLocation = async (
  options: CaptureDeviceLocationOptions = {}
): Promise<CapturedDeviceLocation | null> => {
  const {
    requestPermission = true,
    includeLabel = true,
    allowCoordinateFallback = false,
    retries = 2,
    timeoutMs = 8_000,
    accuracy = Location.Accuracy.Highest,
  } = options;

  const attemptCount = Math.max(1, retries);

  if (Platform.OS === "web") {
    let coords: RawCoords | null = null;
    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      const next = await getWebCurrentPosition(timeoutMs);
      if (!next) continue;

      const currentAccuracy = typeof coords?.accuracy === "number" ? coords.accuracy : Number.POSITIVE_INFINITY;
      const nextAccuracy = typeof next.accuracy === "number" ? next.accuracy : Number.POSITIVE_INFINITY;
      if (!coords || nextAccuracy < currentAccuracy) {
        coords = next;
      }
      if (nextAccuracy <= 80) {
        break;
      }
    }
    if (!coords) return null;

    const rawLabel = includeLabel
      ? await buildLocationLabel(coords.latitude, coords.longitude)
      : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    const phoneLabel = includeLabel ? toPhoneStyleLocation(rawLabel) : rawLabel;
    const label = includeLabel
      ? (isReasonablePhoneStyleLocation(phoneLabel)
        ? phoneLabel
        : (allowCoordinateFallback ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : ""))
      : rawLabel;

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? undefined,
      label,
    };
  }

  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted" && requestPermission) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== "granted") {
      return null;
    }
  } catch {
    return null;
  }

  let coords:
    | { latitude: number; longitude: number; accuracy?: number | null }
    | null = null;
  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    try {
      const current = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy }),
        timeoutMs
      );
      const next = current.coords;
      const currentAccuracy = typeof coords?.accuracy === "number" ? coords.accuracy : Number.POSITIVE_INFINITY;
      const nextAccuracy = typeof next.accuracy === "number" ? next.accuracy : Number.POSITIVE_INFINITY;
      if (!coords || nextAccuracy < currentAccuracy) {
        coords = next;
      }
      if (nextAccuracy <= 80) {
        break;
      }
    } catch {
      // Retry below.
    }
  }

  if (!coords) {
    try {
      const fallback = await Location.getLastKnownPositionAsync({
        requiredAccuracy: 2000,
        maxAge: 10 * 60 * 1000,
      });
      if (fallback?.coords) {
        coords = fallback.coords;
      }
    } catch {
      // Ignore.
    }
  }

  if (!coords) return null;

  const rawLabel = includeLabel
    ? await buildLocationLabel(coords.latitude, coords.longitude)
    : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
  const phoneLabel = includeLabel ? toPhoneStyleLocation(rawLabel) : rawLabel;
  const label = includeLabel
    ? (isReasonablePhoneStyleLocation(phoneLabel)
      ? phoneLabel
      : (allowCoordinateFallback ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : ""))
    : rawLabel;

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? undefined,
    label,
  };
};
