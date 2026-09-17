import { api } from './axios';

export type RewardReason = 'waste_report' | 'pickup_participation' | 'cleanup_verified' | 'bonus';

export type Reward = {
  id: string;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  points: number;
  reason: RewardReason;
  related_entity_id?: string | null;
  created_at: string;
};

export const rewardsApi = {
  listRewards: async (params: { user_id?: string; reason?: RewardReason } = {}) => {
    const res = await api.get<{ success: true; rewards: Reward[] }>('/admin/rewards', { params });
    return res.data.rewards;
  },
  grantBonus: async (input: { user_id: string; points: number; reason?: RewardReason }) => {
    const res = await api.post<{ success: true }>(`/admin/rewards`, {
      ...input,
      reason: input.reason ?? 'bonus'
    });
    return res.data;
  }
};
