import { api } from './axios';

export type Feedback = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  rating: number;
  message: string | null;
  created_at: string;
};

export const feedbackApi = {
  listFeedback: async (): Promise<Feedback[]> => {
    const res = await api.get<{ success: true; feedback: Feedback[] }>('/admin/feedback');
    return res.data.feedback;
  }
};
