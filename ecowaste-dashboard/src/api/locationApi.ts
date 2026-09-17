import { api } from './axios';

export type CollectorLocation = {
  collector_id: string;
  name: string;
  phone?: string | null;
  collector_area?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  updated_at: string;
};

export const locationApi = {
  listCollectors: async (): Promise<CollectorLocation[]> => {
    const res = await api.get<{ success: true; collectors: CollectorLocation[] }>('/location/collectors');
    return res.data.collectors;
  }
};
