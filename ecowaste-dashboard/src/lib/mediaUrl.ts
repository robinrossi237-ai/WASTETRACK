import { API_BASE_URL } from '@/api/axios';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2']);
const LOCAL_MEDIA_PREFIXES = ['data:', 'blob:'];

const PRIVATE_IPV4_PATTERN =
  /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/');

const isRelativeUploadsPath = (value: string): boolean =>
  /^(?:\.\/)?uploads\//i.test(value) || /^\/uploads\//i.test(value);

const isLocalOrPrivateHost = (host: string): boolean =>
  LOOPBACK_HOSTS.has(host) || PRIVATE_IPV4_PATTERN.test(host);

const getApiOrigin = (): string | null => {
  try {
    const apiUrl = new URL(API_BASE_URL);
    return `${apiUrl.protocol}//${apiUrl.host}`;
  } catch {
    return null;
  }
};

export const normalizeMediaUrl = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = normalizeSlashes(value.trim());
  if (!trimmed) return null;
  if (LOCAL_MEDIA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return trimmed;

  const apiOrigin = getApiOrigin();

  if (apiOrigin && isRelativeUploadsPath(trimmed)) {
    const normalizedPath = trimmed.replace(/^\.\//, '').replace(/^\/+/, '');
    return `${apiOrigin}/${normalizedPath}`;
  }

  if (apiOrigin && trimmed.startsWith('/')) {
    return `${apiOrigin}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (apiOrigin && isLocalOrPrivateHost(host) && parsed.pathname.startsWith('/uploads/')) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
};
