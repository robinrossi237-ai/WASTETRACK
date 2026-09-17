import { EventEmitter } from 'events';

import type { UserRole } from '../models/user';

type RealtimeEventPayload = Record<string, unknown>;

export type RealtimeEvent = {
  id: number;
  type: string;
  timestamp: string;
  payload: RealtimeEventPayload;
  userIds?: string[];
  roles?: UserRole[];
};

type PublishRealtimeEventInput = {
  type: string;
  payload?: RealtimeEventPayload;
  userIds?: string[];
  roles?: UserRole[];
};

type RealtimeViewer = {
  id: string;
  role: UserRole;
};

const REALTIME_EVENT = 'realtime:event';
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let nextEventId = 1;

const normalizeIdList = (value?: string[]): string[] | undefined => {
  if (!value || value.length === 0) return undefined;
  const unique = Array.from(new Set(value.map((entry) => entry.trim()).filter(Boolean)));
  return unique.length > 0 ? unique : undefined;
};

const normalizeRoleList = (value?: UserRole[]): UserRole[] | undefined => {
  if (!value || value.length === 0) return undefined;
  const unique = Array.from(new Set(value));
  return unique.length > 0 ? unique : undefined;
};

export const publishRealtimeEvent = (input: PublishRealtimeEventInput): RealtimeEvent => {
  const event: RealtimeEvent = {
    id: nextEventId++,
    type: input.type,
    timestamp: new Date().toISOString(),
    payload: input.payload ?? {},
    userIds: normalizeIdList(input.userIds),
    roles: normalizeRoleList(input.roles),
  };

  emitter.emit(REALTIME_EVENT, event);
  return event;
};

export const subscribeRealtimeEvents = (listener: (event: RealtimeEvent) => void): (() => void) => {
  emitter.on(REALTIME_EVENT, listener);
  return () => {
    emitter.off(REALTIME_EVENT, listener);
  };
};

export const shouldDeliverRealtimeEvent = (
  event: RealtimeEvent,
  viewer: RealtimeViewer
): boolean => {
  const roleMatched = !event.roles || event.roles.includes(viewer.role);
  const userMatched = !event.userIds || event.userIds.includes(viewer.id);
  const hasRoleFilter = !!event.roles && event.roles.length > 0;
  const hasUserFilter = !!event.userIds && event.userIds.length > 0;

  if (!hasRoleFilter && !hasUserFilter) return true;
  if (!hasRoleFilter) return userMatched;
  if (!hasUserFilter) return roleMatched;

  // When both filters are present, deliver to either target group.
  return roleMatched || userMatched;
};
