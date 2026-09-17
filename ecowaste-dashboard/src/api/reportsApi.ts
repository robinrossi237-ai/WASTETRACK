import { api } from './axios';
import type { UserRole } from './authApi';
import { normalizeMediaUrl } from '@/lib/mediaUrl';

export type ReportStatus = 'reported' | 'verified' | 'assigned' | 'cleaned' | 'approved' | 'rejected' | 'cancelled';

export type ReportDispatchOffer = {
  offer_id: string;
  collector_id: string;
  collector_name?: string | null;
  collector_email?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  distance_km?: number | null;
  offered_at: string;
  responded_at?: string | null;
};

export type WasteReport = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  photo_url?: string | null;
  location_text?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: ReportStatus;
  verified_by_admin_id?: string | null;
  assigned_collector_id?: string | null;
  assigned_collector_name?: string | null;
  assigned_collector_email?: string | null;
  assigned_at?: string | null;
  auto_offer_collectors?: ReportDispatchOffer[];
  created_at: string;
};

export type CollectorUser = {
  id: string;
  name: string;
  email: string;
  role: Extract<UserRole, 'collector'>;
  is_active: boolean;
};

const normalizeReportMedia = (report: WasteReport): WasteReport => ({
  ...report,
  photo_url: normalizeMediaUrl(report.photo_url)
});

export const reportsApi = {
  listReports: async (params: { status?: ReportStatus } = {}) => {
    const res = await api.get<{ success: true; reports: WasteReport[] }>('/admin/reports', { params });
    return res.data.reports.map(normalizeReportMedia);
  },
  updateStatus: async (reportId: string, status: ReportStatus) => {
    const res = await api.patch<{ success: true }>(`/admin/reports/${reportId}`, { status });
    return res.data;
  },
  listCollectors: async () => {
    const res = await api.get<{ success: true; collectors: CollectorUser[] }>('/admin/collectors');
    return res.data.collectors;
  },
  assignCollector: async (reportId: string, collectorId: string) => {
    const res = await api.post<{ success: true }>(`/admin/reports/${reportId}/assign`, {
      collector_id: collectorId
    });
    return res.data;
  },
  signalNearestCollectors: async (reportId: string, maxCollectors = 3) => {
    const res = await api.post<{
      success: true;
      dispatched: boolean;
      offers_created: number;
      reason: string;
    }>(`/admin/reports/${reportId}/signal-nearest`, {
      max_collectors: maxCollectors
    });
    return res.data;
  }
};
