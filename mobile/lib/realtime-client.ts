import { getApiBaseUrl } from '@/lib/api-client';
import * as storage from '@/lib/storage';

export type RealtimeEvent = {
  id?: number;
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

type RealtimeHandlers = {
  onEvent?: (event: RealtimeEvent) => void;
  onOpen?: () => void;
  onError?: () => void;
};

type EventSourceConstructor = new (url: string) => EventSourceLike;

type EventSourceLike = {
  close: () => void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

const resolveStreamUrl = (token: string) => {
  const trimmed = getApiBaseUrl().replace(/\/+$/, '');
  const root = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  return `${root}/api/realtime/stream?token=${encodeURIComponent(token)}`;
};

const getEventSourceCtor = (): EventSourceConstructor | null => {
  const value = (globalThis as { EventSource?: EventSourceConstructor }).EventSource;
  if (typeof value !== 'function') return null;
  return value;
};

let source: EventSourceLike | null = null;
let currentToken: string | null = null;
let connectPromise: Promise<void> | null = null;
let nextSubscriberId = 0;
const subscribers = new Map<number, RealtimeHandlers>();

const broadcastOpen = () => {
  for (const subscriber of subscribers.values()) {
    subscriber.onOpen?.();
  }
};

const broadcastEvent = (event: RealtimeEvent) => {
  for (const subscriber of subscribers.values()) {
    subscriber.onEvent?.(event);
  }
};

const broadcastError = () => {
  for (const subscriber of subscribers.values()) {
    subscriber.onError?.();
  }
};

const closeSource = () => {
  source?.close();
  source = null;
  currentToken = null;
};

const ensureSourceConnection = async (EventSourceCtor: EventSourceConstructor): Promise<void> => {
  if (connectPromise) {
    await connectPromise;
    return;
  }

  connectPromise = (async () => {
    const token = await storage.getAuthToken();
    if (!token || subscribers.size === 0) {
      closeSource();
      return;
    }

    if (source && currentToken === token) {
      return;
    }

    if (source && currentToken !== token) {
      closeSource();
    }

    currentToken = token;
    source = new EventSourceCtor(resolveStreamUrl(token));
    source.onopen = () => {
      broadcastOpen();
    };
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RealtimeEvent;
        broadcastEvent(parsed);
      } catch {
        // Ignore malformed payloads.
      }
    };
    source.onerror = () => {
      broadcastError();
    };
  })().finally(() => {
    connectPromise = null;
  });

  await connectPromise;
};

export const connectRealtimeStream = async (
  handlers: RealtimeHandlers
): Promise<(() => void) | null> => {
  const EventSourceCtor = getEventSourceCtor();
  if (!EventSourceCtor) {
    return null;
  }

  const subscriberId = ++nextSubscriberId;
  subscribers.set(subscriberId, handlers);
  await ensureSourceConnection(EventSourceCtor);
  if (!source) {
    subscribers.delete(subscriberId);
    return null;
  }

  return () => {
    subscribers.delete(subscriberId);
    if (subscribers.size === 0) {
      closeSource();
    }
  };
};
