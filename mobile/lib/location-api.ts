import { apiRequest } from "@/lib/api-client";

export type CollectorLocation = {
  collector_id: string;
  name: string;
  phone?: string | null;
  truck_number?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  updated_at: string;
  pickup_request_id?: string | null;
};

export const locationApi = {
  trackLocation: async (payload: { latitude: number; longitude: number; accuracy?: number | null }) => {
    const res = await apiRequest<{ success: true }>("POST", "/location/track", payload);
    return res;
  },
  listCollectorLocations: async (): Promise<CollectorLocation[]> => {
    const res = await apiRequest<{ success: true; collectors: CollectorLocation[] }>(
      "GET",
      "/location/collectors"
    );
    return res.collectors;
  },
};
