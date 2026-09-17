const PLUS_CODE_PART_PATTERN = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i;
const PLUS_CODE_PREFIX_PATTERN = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}\s*/i;
const COORDINATE_PAIR_PATTERN = /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;
const COORDINATE_PART_PATTERN = /^-?\d{1,3}(?:\.\d+)?$/;
const NUMERIC_ONLY_PATTERN = /^\d+$/;
const UNKNOWN_PART_PATTERN = /^(unknown|current location|location unavailable)$/i;

const uniqueOrdered = (items: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

export const stripLocationCode = (value?: string | null): string => {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return "";

  const cleaned = [...parts];
  if (PLUS_CODE_PART_PATTERN.test(cleaned[0])) {
    cleaned.shift();
  } else {
    cleaned[0] = cleaned[0].replace(PLUS_CODE_PREFIX_PATTERN, "").trim();
  }

  return cleaned.filter((part) => part.length > 0).join(", ");
};

const normalizeLocationParts = (value?: string | null): string[] => {
  const stripped = stripLocationCode(value);
  if (!stripped || COORDINATE_PAIR_PATTERN.test(stripped)) return [];

  const parts = stripped
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part.length > 0)
    .filter((part) => !COORDINATE_PART_PATTERN.test(part))
    .filter((part) => !NUMERIC_ONLY_PATTERN.test(part))
    .filter((part) => !UNKNOWN_PART_PATTERN.test(part));

  return uniqueOrdered(parts);
};

export const toPhoneStyleLocation = (value?: string | null): string => {
  const normalized = normalizeLocationParts(value);
  if (normalized.length === 0) return "";
  return normalized.slice(-4).join(", ");
};

export const isReasonablePhoneStyleLocation = (value?: string | null): boolean => {
  const normalized = toPhoneStyleLocation(value);
  if (!normalized) return false;
  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length >= 2;
};

export const summarizeLocationArea = (value?: string | null): string => {
  const normalized = normalizeLocationParts(value);
  if (normalized.length === 0) return "";

  if (normalized.length >= 2) {
    const lastTwo = normalized.slice(-2);
    if (lastTwo[0].toLowerCase() === lastTwo[1].toLowerCase()) {
      return lastTwo[0];
    }
    return `${lastTwo[0]}, ${lastTwo[1]}`;
  }

  return normalized[0];
};
