export const USER_ROLES = ['resident', 'collector', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const COLLECTOR_VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type CollectorVerificationStatus = (typeof COLLECTOR_VERIFICATION_STATUSES)[number];

export type AuthUser = {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string | null;
  area?: string | null;
  subscription_plan?: string | null;
  collector_verification_status?: CollectorVerificationStatus | null;
  collector_verification_note?: string | null;
  collector_submitted_at?: string | null;
  collector_verified_at?: string | null;
  collector_auto_location_tracking?: boolean | null;
  collector_exit_location_capture_enabled?: boolean | null;
};
