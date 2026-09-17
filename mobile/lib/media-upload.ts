import { apiRequest } from "@/lib/api-client";

const DATA_URI_PATTERN = /^data:(?<mime>[-\w.+/]+);base64,(?<base64>[A-Za-z0-9+/=\s]+)$/i;
const LOCAL_URI_PATTERN = /^(blob:|file:|content:|asset-library:|ph:)/i;
const DEFAULT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

type UploadMediaOptions = {
  category?: string;
  maxBytes?: number;
};

const estimateBase64Bytes = (base64Payload: string): number => {
  const normalized = base64Payload.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

const formatBytes = (value: number): string => {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const blobToDataUri = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
        return;
      }
      reject(new Error("Unsupported media format. Please select the image again."));
    };
    reader.onerror = () => reject(new Error("Could not read selected image. Please choose another photo."));
    reader.readAsDataURL(blob);
  });

const convertLocalUriToDataUri = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blobToDataUri(blob);
};

export const uploadMediaUri = async (
  uri: string,
  options: UploadMediaOptions = {}
): Promise<string> => {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error("Media URI is empty");
  }

  if (isHttpUrl(trimmed)) {
    return trimmed;
  }

  let normalizedUri = trimmed;
  let match = normalizedUri.match(DATA_URI_PATTERN);

  if (!match && LOCAL_URI_PATTERN.test(normalizedUri)) {
    try {
      normalizedUri = await convertLocalUriToDataUri(normalizedUri);
      match = normalizedUri.match(DATA_URI_PATTERN);
    } catch {
      throw new Error("Could not read selected image. Please choose another photo.");
    }
  }

  const mime = match?.groups?.mime?.toLowerCase();
  const base64 = match?.groups?.base64;
  if (!mime || !base64) {
    throw new Error("Unsupported media format. Please select the image again.");
  }

  const normalizedBase64 = base64.replace(/\s+/g, "");
  const bytes = estimateBase64Bytes(normalizedBase64);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  if (bytes > maxBytes) {
    throw new Error(
      `Image is too large (${formatBytes(bytes)}). Maximum allowed size is ${formatBytes(maxBytes)}.`
    );
  }

  const dataUri = `data:${mime};base64,${normalizedBase64}`;
  const data = await apiRequest<{ success: true; upload: { url: string } }>("POST", "/uploads", {
    data_uri: dataUri,
    category: options.category,
  });

  if (!data.upload?.url) {
    throw new Error("Upload failed. Please try again.");
  }

  return data.upload.url;
};

export const uploadOptionalMediaUri = async (
  uri: string | null | undefined,
  options: UploadMediaOptions = {}
): Promise<string | null | undefined> => {
  if (uri === null || uri === undefined) return uri;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  return uploadMediaUri(trimmed, options);
};
