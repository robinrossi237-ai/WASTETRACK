import { api } from './axios';

export type EducationContent = {
  id: string;
  title: string;
  body: string;
  media_url?: string | null;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

export const contentApi = {
  list: async () => {
    const res = await api.get<{ success: true; content: EducationContent[] }>('/admin/content');
    return res.data.content;
  },
  create: async (input: { title: string; body: string; media_url?: string | null }) => {
    const res = await api.post<{ success: true; content: EducationContent }>('/admin/content', input);
    return res.data.content;
  },
  update: async (id: string, input: { title: string; body: string; media_url?: string | null }) => {
    const res = await api.patch<{ success: true; content: EducationContent }>(`/admin/content/${id}`, input);
    return res.data.content;
  },
  remove: async (id: string) => {
    const res = await api.delete<{ success: true }>(`/admin/content/${id}`);
    return res.data;
  }
};

