import { ApiError, apiRequest } from "@/lib/api-client";
import { uploadOptionalMediaUri } from "@/lib/media-upload";
import { normalizeMediaUrl } from "@/lib/media-url";
import { isReasonablePhoneStyleLocation, toPhoneStyleLocation } from "@/lib/location-label";
import * as storage from "@/lib/storage";

const MAX_SYNC_ATTEMPTS = 5;

export type CollectorAssignment = {
  id: string;
  collector_id: string;
  pickup_request_id: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  completion_photo_url: string | null;
  completion_note: string | null;
  completion_submitted_at?: string | null;
  resident_confirmation_status?: "pending" | "approved" | "rejected" | null;
  resident_confirmed_at?: string | null;
  resident_rejection_note?: string | null;
  issue_reason: string | null;
  issue_note: string | null;
  status: string;
  waste_type: string | null;
  address: string | null;
  scheduled_date: string | null;
  latitude: number | null;
  longitude: number | null;
  resident_name: string | null;
  resident_phone: string | null;
  resident_email: string | null;
};

export type CollectorWasteReport = {
  id: string;
  user_id: string;
  photo_url: string | null;
  report_type: string | null;
  location_text: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  assigned_collector_id: string | null;
  assigned_at: string | null;
  cleaned_by_collector_id: string | null;
  cleaned_at: string | null;
  cleaned_photo_url: string | null;
  cleaned_note: string | null;
  resident_confirmation_status?: "pending" | "approved" | "rejected" | null;
  resident_confirmed_at?: string | null;
  resident_rejection_note?: string | null;
  collector_issue_by_id: string | null;
  collector_issue_at: string | null;
  collector_issue_reason: string | null;
  collector_issue_note: string | null;
  created_at: string;
  updated_at: string;
  resident_name: string | null;
  resident_phone: string | null;
  resident_email: string | null;
};

export type CollectorDispatchOffer = {
  id: string;
  entity_type: "pickup" | "report";
  entity_id: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  offered_at: string;
  expires_at: string;
  seconds_remaining: number;
  response_window_seconds: number;
  distance_km: number | null;
  score: number | null;
  resident_id: string;
  resident_name: string;
  resident_phone: string | null;
  resident_area: string | null;
  waste_type: string | null;
  report_type: string | null;
  address: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduled_date: string | null;
  report_created_at: string | null;
};

export type CollectorOfferResponse = {
  action: "accepted" | "rejected";
  entity_type: "pickup" | "report";
  entity_id: string;
  assignment_id: string | null;
};

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Collector action failed";

const isLikelyOfflineError = (err: unknown): boolean => {
  if (err instanceof ApiError) {
    return false;
  }
  if (!(err instanceof Error)) {
    return false;
  }
  const message = err.message.toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("network error") ||
    message.includes("timed out") ||
    message.includes("no internet connection") ||
    message.includes("unable to reach server")
  );
};

type PickupCompletionInput = {
  completionPhotoUrl?: string | null;
  completionNote?: string | null;
};

type ReportCleanupInput = {
  cleanedPhotoUrl?: string | null;
  cleanedNote?: string | null;
};

const normalizeOptionalText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLocationTextValue = (value: string | null | undefined): string | null => {
  const cleaned = toPhoneStyleLocation(value);
  if (cleaned.length > 0 && isReasonablePhoneStyleLocation(cleaned)) return cleaned;
  return null;
};

const normalizePickupCompletionInput = async (
  input: PickupCompletionInput = {}
): Promise<PickupCompletionInput> => ({
  completionPhotoUrl: await uploadOptionalMediaUri(input.completionPhotoUrl, {
    category: "collector-completion"
  }),
  completionNote: normalizeOptionalText(input.completionNote),
});

const normalizeReportCleanupInput = async (
  input: ReportCleanupInput = {}
): Promise<ReportCleanupInput> => ({
  cleanedPhotoUrl: await uploadOptionalMediaUri(input.cleanedPhotoUrl, {
    category: "collector-cleanup"
  }),
  cleanedNote: normalizeOptionalText(input.cleanedNote),
});

const executeQueuedAction = async (action: storage.CollectorQueuedAction): Promise<void> => {
  switch (action.type) {
    case "pickup_start":
      await apiRequest<{ success: true }>("POST", `/collector/pickups/${action.targetId}/start`);
      return;
    case "pickup_complete":
      {
        const payload = await normalizePickupCompletionInput(
          (action.payload ?? {}) as PickupCompletionInput
        );
        await apiRequest<{ success: true }>(
          "POST",
          `/collector/pickups/${action.targetId}/complete`,
          payload
        );
      }
      return;
    case "pickup_issue":
      await apiRequest<{ success: true }>(
        "POST",
        `/collector/pickups/${action.targetId}/issue`,
        action.payload ?? {}
      );
      return;
    case "report_clean":
      {
        const payload = await normalizeReportCleanupInput(
          (action.payload ?? {}) as ReportCleanupInput
        );
        await apiRequest<{ success: true }>(
          "POST",
          `/collector/reports/${action.targetId}/clean`,
          payload
        );
      }
      return;
    case "report_issue":
      await apiRequest<{ success: true }>(
        "POST",
        `/collector/reports/${action.targetId}/issue`,
        action.payload ?? {}
      );
      return;
  }
};

export const syncCollectorActionQueue = async (): Promise<number> => {
  const queue = await storage.getCollectorActionQueue();
  if (queue.length === 0) {
    return 0;
  }

  const nextQueue: storage.CollectorQueuedAction[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const action = queue[index];

    if (action.attempts >= MAX_SYNC_ATTEMPTS) {
      nextQueue.push(action);
      continue;
    }

    try {
      await executeQueuedAction(action);
    } catch (err) {
      const actionWithError: storage.CollectorQueuedAction = {
        ...action,
        attempts: action.attempts + 1,
        lastError: getErrorMessage(err),
      };
      nextQueue.push(actionWithError);

      if (isLikelyOfflineError(err)) {
        nextQueue.push(...queue.slice(index + 1));
        break;
      }
    }
  }

  await storage.replaceCollectorActionQueue(nextQueue);
  return nextQueue.length;
};

export const getCollectorQueuedActionCount = async (): Promise<number> => {
  const queue = await storage.getCollectorActionQueue();
  return queue.length;
};

const trySyncCollectorQueue = async () => {
  try {
    await syncCollectorActionQueue();
  } catch {
    // queue sync is best effort
  }
};

const queueCollectorAction = async (
  type: storage.CollectorQueuedActionType,
  targetId: string,
  payload: Record<string, unknown> | undefined,
  err: unknown
): Promise<never> => {
  if (!isLikelyOfflineError(err)) {
    throw err;
  }
  await storage.enqueueCollectorAction({ type, targetId, payload, lastError: getErrorMessage(err) });
  throw new Error("No network connection. Action queued and will sync automatically.");
};

const normalizeAssignmentMedia = (assignment: CollectorAssignment): CollectorAssignment => ({
  ...assignment,
  address: normalizeLocationTextValue(assignment.address),
  completion_photo_url: normalizeMediaUrl(assignment.completion_photo_url) ?? null,
});

const normalizeReportMedia = (report: CollectorWasteReport): CollectorWasteReport => ({
  ...report,
  location_text: normalizeLocationTextValue(report.location_text),
  photo_url: normalizeMediaUrl(report.photo_url) ?? null,
  cleaned_photo_url: normalizeMediaUrl(report.cleaned_photo_url) ?? null,
});

const normalizeOfferLocation = (offer: CollectorDispatchOffer): CollectorDispatchOffer => ({
  ...offer,
  resident_area: normalizeLocationTextValue(offer.resident_area),
  address: normalizeLocationTextValue(offer.address),
  location_text: normalizeLocationTextValue(offer.location_text),
});

export const collectorApi = {
  listPendingOffers: async (): Promise<CollectorDispatchOffer[]> => {
    const res = await apiRequest<{ success: true; offers: CollectorDispatchOffer[] }>(
      "GET",
      "/collector/offers/pending"
    );
    return res.offers.map(normalizeOfferLocation);
  },
  acceptOffer: async (offerId: string): Promise<CollectorOfferResponse> => {
    const res = await apiRequest<{ success: true; result?: CollectorOfferResponse }>(
      "POST",
      `/collector/offers/${offerId}/accept`
    );
    if (res.result) {
      return res.result;
    }
    throw new Error("Offer accepted but response payload is missing.");
  },
  rejectOffer: async (offerId: string, reason?: string): Promise<void> => {
    await apiRequest<{ success: true }>("POST", `/collector/offers/${offerId}/reject`, { reason });
  },
  listAssigned: async (): Promise<CollectorAssignment[]> => {
    await trySyncCollectorQueue();
    const res = await apiRequest<{ success: true; assignments: CollectorAssignment[] }>(
      "GET",
      "/collector/pickups/assigned"
    );
    return res.assignments.map(normalizeAssignmentMedia);
  },
  listHistory: async (): Promise<CollectorAssignment[]> => {
    await trySyncCollectorQueue();
    const res = await apiRequest<{ success: true; assignments: CollectorAssignment[] }>(
      "GET",
      "/collector/pickups/history"
    );
    return res.assignments.map(normalizeAssignmentMedia);
  },
  getAssignment: async (assignmentId: string): Promise<CollectorAssignment> => {
    await trySyncCollectorQueue();
    const res = await apiRequest<{ success: true; assignment: CollectorAssignment }>(
      "GET",
      `/collector/pickups/${assignmentId}`
    );
    return normalizeAssignmentMedia(res.assignment);
  },
  start: async (assignmentId: string): Promise<void> => {
    await trySyncCollectorQueue();
    try {
      await apiRequest<{ success: true }>("POST", `/collector/pickups/${assignmentId}/start`);
    } catch (err) {
      await queueCollectorAction("pickup_start", assignmentId, undefined, err);
    }
  },
  complete: async (
    assignmentId: string,
    input: { completionPhotoUrl?: string | null; completionNote?: string | null } = {}
  ): Promise<void> => {
    await trySyncCollectorQueue();
    const normalizedInput = await normalizePickupCompletionInput(input);
    try {
      await apiRequest<{ success: true }>("POST", `/collector/pickups/${assignmentId}/complete`, normalizedInput);
    } catch (err) {
      await queueCollectorAction("pickup_complete", assignmentId, input as Record<string, unknown>, err);
    }
  },
  issue: async (assignmentId: string, reason: string, note?: string): Promise<void> => {
    await trySyncCollectorQueue();
    const payload = { reason, note };
    try {
      await apiRequest<{ success: true }>("POST", `/collector/pickups/${assignmentId}/issue`, payload);
    } catch (err) {
      await queueCollectorAction("pickup_issue", assignmentId, payload as Record<string, unknown>, err);
    }
  },

  listAssignedReports: async (): Promise<CollectorWasteReport[]> => {
    await trySyncCollectorQueue();
    const res = await apiRequest<{ success: true; reports: CollectorWasteReport[] }>(
      "GET",
      "/collector/reports/assigned"
    );
    return res.reports.map(normalizeReportMedia);
  },
  listReportHistory: async (): Promise<CollectorWasteReport[]> => {
    await trySyncCollectorQueue();
    const res = await apiRequest<{ success: true; reports: CollectorWasteReport[] }>(
      "GET",
      "/collector/reports/history"
    );
    return res.reports.map(normalizeReportMedia);
  },
  getReport: async (reportId: string): Promise<CollectorWasteReport> => {
    await trySyncCollectorQueue();
    const res = await apiRequest<{ success: true; report: CollectorWasteReport }>(
      "GET",
      `/collector/reports/${reportId}`
    );
    return normalizeReportMedia(res.report);
  },
  cleanReport: async (
    reportId: string,
    input: { cleanedPhotoUrl?: string | null; cleanedNote?: string | null } = {}
  ): Promise<void> => {
    await trySyncCollectorQueue();
    const normalizedInput = await normalizeReportCleanupInput(input);
    try {
      await apiRequest<{ success: true }>("POST", `/collector/reports/${reportId}/clean`, normalizedInput);
    } catch (err) {
      await queueCollectorAction("report_clean", reportId, input as Record<string, unknown>, err);
    }
  },
  issueReport: async (reportId: string, reason: string, note?: string): Promise<void> => {
    await trySyncCollectorQueue();
    const payload = { reason, note };
    try {
      await apiRequest<{ success: true }>("POST", `/collector/reports/${reportId}/issue`, payload);
    } catch (err) {
      await queueCollectorAction("report_issue", reportId, payload as Record<string, unknown>, err);
    }
  },
};
