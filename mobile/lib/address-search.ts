export type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

const dedupeParts = (parts: (string | undefined)[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const part of parts) {
    const normalized = part?.replace(/\s+/g, " ").trim() ?? "";
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
};

const buildLabel = (props: PhotonFeature["properties"]): string => {
  if (!props) return "";
  const street = [props.housenumber, props.street].filter(Boolean).join(" ");
  const parts = dedupeParts([street, props.name, props.district || props.city, props.county, props.state, props.country]);
  return parts.join(", ");
};

export const FORWARD_GEOCODE_API_BASE = "https://photon.komoot.io/api";

export const searchAddress = async (query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = `${FORWARD_GEOCODE_API_BASE}?q=${encodeURIComponent(trimmed)}&limit=6&lang=en`;

  const response = await fetch(url, { signal });
  if (!response.ok) return [];

  const payload = (await response.json()) as { features?: PhotonFeature[] };
  if (!Array.isArray(payload.features)) return [];

  const suggestions: AddressSuggestion[] = [];
  for (const feature of payload.features) {
    const coords = feature.geometry?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) continue;
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const label = buildLabel(feature.properties);
    if (!label) continue;
    suggestions.push({
      id: `${latitude.toFixed(6)},${longitude.toFixed(6)}:${label}`,
      label,
      latitude,
      longitude,
    });
  }

  return suggestions;
};
