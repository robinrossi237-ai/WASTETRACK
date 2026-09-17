import { API_BASE_URL } from './axios';

export type RealtimeStreamEvent = {
  id?: number;
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

type RealtimeStreamHandlers = {
  token: string;
  onOpen?: () => void;
  onEvent?: (event: RealtimeStreamEvent) => void;
  onError?: () => void;
};

const resolveStreamUrl = (token: string) => {
  const trimmed = API_BASE_URL.replace(/\/+$/, '');
  const root = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  return `${root}/api/realtime/stream?token=${encodeURIComponent(token)}`;
};

const canUseEventSource = () => typeof window !== 'undefined' && typeof window.EventSource !== 'undefined';

export const connectRealtimeStream = (handlers: RealtimeStreamHandlers): (() => void) | null => {
  if (!canUseEventSource() || !handlers.token) {
    return null;
  }

  const stream = new window.EventSource(resolveStreamUrl(handlers.token));

  stream.onopen = () => {
    handlers.onOpen?.();
  };

  stream.onmessage = (message) => {
    try {
      const parsed = JSON.parse(message.data) as RealtimeStreamEvent;
      handlers.onEvent?.(parsed);
    } catch {
      // Ignore malformed SSE payloads.
    }
  };

  stream.onerror = () => {
    handlers.onError?.();
  };

  return () => {
    stream.close();
  };
};
