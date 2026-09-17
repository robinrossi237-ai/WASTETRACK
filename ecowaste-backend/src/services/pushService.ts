import { env } from '../config/env';
import {
  deactivatePushTokenByToken,
  listActivePushTokensForUsers,
  type PushPlatform,
} from './pushTokenService';

type PushData = Record<string, unknown>;

type SendPushInput = {
  userIds: string[];
  title?: string;
  body: string;
  data?: PushData;
  path?: string;
};

type PushSendResult = {
  attempted: number;
  sent: number;
  failed: number;
};

type ExpoPushMessage = {
  to: string;
  title?: string;
  body: string;
  sound: 'default';
  data?: PushData;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
};

type PushTarget = {
  token: string;
  platform: PushPlatform;
};

const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const MAX_PUSH_BATCH_SIZE = 100;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
};

const isValidExpoPushToken = (token: string): boolean => EXPO_PUSH_TOKEN_PATTERN.test(token);

const toPushTargets = (rows: { token: string; platform: PushPlatform }[]): PushTarget[] => {
  const byToken = new Map<string, PushPlatform>();
  for (const row of rows) {
    if (!isValidExpoPushToken(row.token)) continue;
    if (!byToken.has(row.token)) {
      byToken.set(row.token, row.platform);
    }
  }
  return Array.from(byToken.entries()).map(([token, platform]) => ({ token, platform }));
};

const parseExpoResponse = (text: string): ExpoPushResponse | null => {
  try {
    return JSON.parse(text) as ExpoPushResponse;
  } catch {
    return null;
  }
};

const buildPushData = (input: SendPushInput): PushData | undefined => {
  const next: PushData = {
    ...(input.data ?? {}),
  };
  if (input.path && typeof next.path !== 'string') {
    next.path = input.path;
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

export const sendPushNotificationToUsers = async (
  input: SendPushInput
): Promise<PushSendResult> => {
  const dedupedUserIds = Array.from(
    new Set(input.userIds.map((value) => value.trim()).filter(Boolean))
  );
  if (dedupedUserIds.length === 0 || !input.body.trim()) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const tokenRows = await listActivePushTokensForUsers(dedupedUserIds);
  const targets = toPushTargets(tokenRows);
  if (targets.length === 0) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const sharedData = buildPushData(input);
  const messages: ExpoPushMessage[] = targets.map((target) => ({
    to: target.token,
    title: input.title,
    body: input.body,
    sound: 'default',
    data: sharedData,
  }));

  const batches = chunkArray(messages, MAX_PUSH_BATCH_SIZE);
  const authToken = env.EXPO_PUSH_ACCESS_TOKEN?.trim();
  let sent = 0;
  let failed = 0;
  let attempted = 0;

  for (const batch of batches) {
    attempted += batch.length;

    let response: Response;
    try {
      response = await fetch(env.EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      failed += batch.length;
      console.error('Expo push request failed', err);
      continue;
    }

    const text = await response.text();
    if (!response.ok) {
      failed += batch.length;
      console.error('Expo push request returned non-OK response', {
        status: response.status,
        body: text,
      });
      continue;
    }

    const parsed = parseExpoResponse(text);
    const tickets = Array.isArray(parsed?.data) ? parsed.data : [];
    if (tickets.length === 0) {
      failed += batch.length;
      console.error('Expo push response missing ticket data', { body: text });
      continue;
    }

    const tokensToDeactivate: string[] = [];
    for (let index = 0; index < batch.length; index += 1) {
      const ticket = tickets[index];
      if (!ticket) {
        failed += 1;
        continue;
      }

      if (ticket.status === 'ok') {
        sent += 1;
        continue;
      }

      failed += 1;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        const token = batch[index]?.to;
        if (token) {
          tokensToDeactivate.push(token);
        }
      }
    }

    if (tokensToDeactivate.length > 0) {
      await Promise.allSettled(
        tokensToDeactivate.map((token) => deactivatePushTokenByToken(token))
      );
    }
  }

  return { attempted, sent, failed };
};
