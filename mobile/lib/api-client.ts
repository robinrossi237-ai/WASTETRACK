import { fetch } from "expo/fetch";
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as storage from "@/lib/storage";

const DEFAULT_API_PORT = 5000;

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onSessionExpiredHandler: (() => void) | null = null;
let sessionExpiredNotified = false;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpiredHandler = handler;
  if (handler) {
    sessionExpiredNotified = false;
  }
}

export function resetSessionExpiredState(): void {
  sessionExpiredNotified = false;
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function hasUrlScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function ensureApiPath(baseUrl: string): string {
  const trimmed = trimTrailingSlashes(baseUrl);
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = trimTrailingSlashes(value.trim());
  if (!trimmed) return trimmed;
  if (hasUrlScheme(trimmed)) return trimmed;

  const hostPart = trimmed.split("/")[0] ?? "";
  const hostname = hostPart.split(":")[0] ?? "";
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "10.0.2.2";
  const isLanIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const scheme = isLocalHost || isLanIp ? "http" : "https";
  return `${scheme}://${trimmed}`;
}

function extractHost(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, "");
  const hostPort = withoutScheme.split("/")[0]?.split("?")[0]?.trim();
  if (!hostPort) return null;
  const host = hostPort.split(":")[0]?.trim();
  return host || null;
}

function normalizeDevHost(host: string): string {
  if (Platform.OS !== "android") return host;
  if (host === "localhost" || host === "127.0.0.1") {
    return "10.0.2.2";
  }
  return host;
}

function remapLoopbackInUrl(url: string): string {
  if (Platform.OS !== "android") return url;
  const parsed = new URL(url);
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    parsed.hostname = "10.0.2.2";
  }
  return parsed.toString();
}

function getDevelopmentFallbackApiUrl(): string {
  if (Platform.OS === "android") {
    return `http://10.0.2.2:${DEFAULT_API_PORT}/api`;
  }
  if (Platform.OS === "ios") {
    return `http://127.0.0.1:${DEFAULT_API_PORT}/api`;
  }
  return `http://localhost:${DEFAULT_API_PORT}/api`;
}

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl?.trim()) {
    return ensureApiPath(remapLoopbackInUrl(normalizeBaseUrl(envUrl)));
  }
  const legacyDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (legacyDomain?.trim()) {
    return ensureApiPath(remapLoopbackInUrl(normalizeBaseUrl(legacyDomain)));
  }

  if (Platform.OS === "web") {
    return `http://localhost:${DEFAULT_API_PORT}/api`;
  }

  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any)?.expoConfig?.debuggerHost,
    (Constants as any)?.expoConfig?.extra?.expoClient?.hostUri,
    (Constants as any)?.expoConfig?.extra?.expoGo?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
    (Constants as any)?.manifest?.hostUri,
    (Constants as any)?.manifest?.extra?.expoClient?.hostUri,
    (Constants as any)?.manifest?.extra?.expoGo?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoGo?.hostUri,
  ];

  for (const candidate of hostCandidates) {
    const host = extractHost(typeof candidate === "string" ? candidate : null);
    if (host) {
      return `http://${normalizeDevHost(host)}:${DEFAULT_API_PORT}/api`;
    }
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return getDevelopmentFallbackApiUrl();
  }

  throw new Error(
    "Unable to resolve API base URL. Set EXPO_PUBLIC_API_BASE_URL to your backend endpoint."
  );
}

async function getErrorInfo(
  res: Response,
): Promise<{ message: string; code?: string; details?: unknown }> {
  try {
    const text = await res.text();
    if (!text) return { message: res.statusText || "Request failed" };

    const trimmed = text.trim();
    if (/^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed) || /<body/i.test(trimmed)) {
      return {
        message:
          "Server returned an unexpected HTML response. Check the API URL and make sure the backend is running.",
      };
    }

    try {
      const json = JSON.parse(text) as {
        message?: string;
        code?: string;
        details?: unknown;
      };
      return {
        message: json?.message || res.statusText || "Request failed",
        code: typeof json?.code === "string" ? json.code : undefined,
        details: json?.details,
      };
    } catch {
      return { message: text || res.statusText || "Request failed" };
    }
  } catch {
    return { message: res.statusText || "Request failed" };
  }
}

const getConnectivityFailureMessage = (): string => {
  if (
    Platform.OS === "web"
    && typeof globalThis !== "undefined"
    && typeof (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine === "boolean"
    && !(globalThis as { navigator?: { onLine?: boolean } }).navigator!.onLine
  ) {
    return "No internet connection. Please check your network and try again.";
  }
  return "Unable to reach server. Please check your connection and try again.";
};

export async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${ensureLeadingSlash(path)}`;
  const token = await storage.getAuthToken();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(getConnectivityFailureMessage());
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      if (onSessionExpiredHandler) {
        if (!sessionExpiredNotified) {
          sessionExpiredNotified = true;
          onSessionExpiredHandler();
        }
      } else {
        await storage.clearAuthToken();
      }
    }
    const info = await getErrorInfo(res);
    throw new ApiError(info.message, res.status, info.code, info.details);
  }

  return (await res.json()) as T;
}
