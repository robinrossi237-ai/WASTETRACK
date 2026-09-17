import { api } from './axios';
import { normalizeMediaUrl } from '@/lib/mediaUrl';

export type PickupStatus =
  | 'pending'
  | 'payment_uploaded'
  | 'approved'
  | 'assigned'
  | 'overdue'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PickupRequest = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_subscription_plan?: string | null;
  waste_type: string;
  scheduled_date: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pickup_category?: string | null;
  weight_kg?: number | null;
  price_amount?: number | null;
  price_currency?: string | null;
  payment_reason?: string | null;
  status: PickupStatus;
  created_at: string;
  assigned_collector_id?: string | null;
  assigned_collector_name?: string | null;
  assigned_collector_email?: string | null;
  assigned_at?: string | null;
  auto_offer_collector_id?: string | null;
  auto_offer_collector_name?: string | null;
  auto_offer_collector_email?: string | null;
  auto_offer_status?: 'pending' | 'accepted' | 'rejected' | 'expired' | null;
  auto_offer_distance_km?: number | null;
  auto_offer_offered_at?: string | null;
};

export type Assignment = {
  id: string;
  collector_id: string;
  collector_name: string;
  collector_email: string;
  pickup_request_id: string;
  pickup_waste_type: string;
  pickup_scheduled_date: string;
  resident_name: string;
  resident_email: string;
  assigned_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  completion_photo_url?: string | null;
  completion_note?: string | null;
  issue_reason?: string | null;
  issue_note?: string | null;
  status: PickupStatus;
};

const normalizeAssignmentMedia = (assignment: Assignment): Assignment => ({
  ...assignment,
  completion_photo_url: normalizeMediaUrl(assignment.completion_photo_url)
});

export const pickupApi = {
  listPickups: async (params: { status?: PickupStatus; from?: string; to?: string } = {}) => {
    const res = await api.get<{ success: true; pickups: PickupRequest[] }>('/admin/pickups', { params });
    return res.data.pickups;
  },
  updatePickupStatus: async (pickupId: string, status: PickupStatus) => {
    const res = await api.patch<{ success: true }>(`/admin/pickups/${pickupId}`, { status });
    return res.data;
  },
  listAssignments: async (params: { status?: PickupStatus } = {}) => {
    const res = await api.get<{ success: true; assignments: Assignment[] }>('/admin/assignments', {
      params
    });
    return res.data.assignments.map(normalizeAssignmentMedia);
  },
  assignCollector: async (pickupRequestId: string, collectorId: string) => {
    const res = await api.post<{ success: true }>(`/admin/assignments`, {
      pickup_request_id: pickupRequestId,
      collector_id: collectorId
    });
    return res.data;
  },
  collectorAssigned: async () => {
    const res = await api.get<{ success: true; assignments: Assignment[] }>('/collector/pickups/assigned');
    return res.data.assignments.map(normalizeAssignmentMedia);
  },
  collectorHistory: async () => {
    const res = await api.get<{ success: true; assignments: Assignment[] }>('/collector/pickups/history');
    return res.data.assignments.map(normalizeAssignmentMedia);
  },
  collectorStart: async (assignmentId: string) => {
    const res = await api.post<{ success: true }>(`/collector/pickups/${assignmentId}/start`);
    return res.data;
  },
  collectorComplete: async (assignmentId: string) => {
    const res = await api.post<{ success: true }>(`/collector/pickups/${assignmentId}/complete`);
    return res.data;
  },
  collectorIssue: async (assignmentId: string, reason: string, note?: string) => {
    const res = await api.post<{ success: true }>(`/collector/pickups/${assignmentId}/issue`, { reason, note });
    return res.data;
  }
};
