import { api } from './axios';
import type { UserRole } from './authApi';

export type CollectorVerificationStatus = 'pending' | 'approved' | 'rejected';

export type SubscriptionPlan = string;

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  area?: string | null;
  role: UserRole;
  points: number;
  is_active: boolean;
  subscription_plan: SubscriptionPlan;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note?: string | null;
  collector_submitted_at?: string | null;
  collector_verified_at?: string | null;
  created_at: string;
  last_login_at: string | null;
};

export type CollectorApplication = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  area?: string | null;
  is_active: boolean;
  collector_verification_status: CollectorVerificationStatus;
  collector_verification_note?: string | null;
  collector_submitted_at?: string | null;
  collector_verified_at?: string | null;
  created_at: string;
};

export type AdminStats = {
  totalUsers: number;
  totalWasteReports: number;
  pendingPickupRequests: number;
  overduePickups: number;
  completedPickups: number;
  activeCollectors: number;
  avgHoursToAssign: number | null;
  avgHoursToStart: number | null;
  avgHoursToComplete: number | null;
  collectorCompleted: number;
  collectorAvgHoursPerJob: number | null;
  collectorCancellations: number;
};

export type CollectorRankingEntry = {
  rank: number;
  collector_id: string;
  collector_name: string;
  collector_email: string;
  collector_phone: string | null;
  collector_area: string | null;
  is_active: boolean;
  last_login_at: string | null;
  score: number;
  pickups_assigned: number;
  pickups_completed: number;
  pickup_completion_rate: number;
  avg_pickup_completion_hours: number | null;
  pickup_issues: number;
  pickup_issue_rate: number;
  pickups_cancelled: number;
  pickup_cancellation_rate: number;
  reports_cleaned: number;
  report_issues: number;
  report_issue_rate: number;
  total_actions: number;
};

export const userApi = {
  getAdminStats: async (): Promise<AdminStats> => {
    const res = await api.get<{ success: true; stats: AdminStats }>('/admin/stats');
    return res.data.stats;
  },
  listCollectorRanking: async (params: { include_inactive?: boolean } = {}) => {
    const res = await api.get<{ success: true; ranking: CollectorRankingEntry[] }>('/admin/collector-ranking', {
      params
    });
    return res.data.ranking;
  },
  listUsers: async (params: { q?: string; role?: UserRole; active?: boolean } = {}) => {
    const res = await api.get<{ success: true; users: User[] }>('/admin/users', { params });
    return res.data.users;
  },
  setActive: async (userId: string, isActive: boolean) => {
    const res = await api.patch<{ success: true }>(`/admin/users/${userId}`, { is_active: isActive });
    return res.data;
  },
  setPlan: async (userId: string, plan: SubscriptionPlan) => {
    const res = await api.patch<{ success: true }>(`/admin/users/${userId}/plan`, { plan });
    return res.data;
  },
  deleteUser: async (userId: string) => {
    const res = await api.delete<{
      success: true;
      result: {
        userId: string;
        role: UserRole;
        redispatchedPickups: number;
        redispatchedReports: number;
      };
    }>(`/admin/users/${userId}`);
    return res.data.result;
  },
  listCollectorApplications: async (params: { status?: CollectorVerificationStatus } = {}) => {
    const res = await api.get<{ success: true; applications: CollectorApplication[] }>(
      '/admin/collector-applications',
      { params }
    );
    return res.data.applications;
  },
  reviewCollectorApplication: async (
    collectorId: string,
    input: { status: Extract<CollectorVerificationStatus, 'approved' | 'rejected'>; rejection_reason?: string }
  ) => {
    const res = await api.patch<{ success: true }>(`/admin/collector-applications/${collectorId}`, input);
    return res.data;
  }
};
