import { api } from './axios';

export type Notification = {
  id: string;
  user_id: string;
  message: string;
  category?: 'pickup' | 'payment' | 'subscription' | 'rewards';
  is_read: boolean;
  created_at: string;
};

export const notificationsApi = {
  listMine: async () => {
    const res = await api.get<{ success: true; notifications: Notification[] }>('/notifications');
    return res.data.notifications;
  },
  markRead: async (notificationId: string) => {
    const res = await api.post<{ success: true }>(`/notifications/${notificationId}/read`);
    return res.data;
  },
  broadcast: async (input: { message: string; area?: string; role?: 'resident' | 'collector' | 'admin' }) => {
    const res = await api.post<{ success: true; sent: number }>(`/admin/notifications/broadcast`, input);
    return res.data;
  }
};
