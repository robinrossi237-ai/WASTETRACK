export const REPORT_STATUSES = [
  'reported',
  'verified',
  'assigned',
  'cleaned',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PICKUP_STATUSES = [
  'pending',
  'approved',
  'assigned',
  'overdue',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const REWARD_REASONS = [
  'waste_report',
  'pickup_participation',
  'cleanup_verified',
  'bonus',
] as const;
export type RewardReason = (typeof REWARD_REASONS)[number];
