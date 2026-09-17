export type UserRole = 'resident' | 'collector' | 'admin';
export type CollectorVerificationStatus = 'pending' | 'approved' | 'rejected';
export type SubscriptionPlan = 'free' | 'plus' | 'pro';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  neighborhood?: string;
  subscriptionPlan?: SubscriptionPlan;
  collectorVerificationStatus?: CollectorVerificationStatus;
  collectorVerificationNote?: string;
  collectorSubmittedAt?: string;
  collectorVerifiedAt?: string;
  points: number;
  badges: string[];
  collectorAutoLocationTracking?: boolean;
  collectorExitLocationCaptureEnabled?: boolean;
  createdAt: string;
}

export interface PickupQuota {
  plan: SubscriptionPlan;
  /** Monthly pickup allowance. `null` means unlimited. */
  limit: number | null;
  used: number;
  remaining: number;
  isUnlimited: boolean;
}

export interface CollectorApplicationSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  area?: string;
  status: CollectorVerificationStatus;
  submittedAt?: string;
}

export type RegisterResult =
  | { type: 'active'; user: User }
  | { type: 'collector_pending'; application: CollectorApplicationSubmission };

export type WasteType = 'household' | 'plastic' | 'organic' | 'electronic' | 'hazardous' | 'metal' | 'mixed';

export type PickupStatus =
  | 'pending'
  | 'approved'
  | 'assigned'
  | 'overdue'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface PickupRequest {
  id: string;
  userId: string;
  wasteType: WasteType;
  description: string;
  photoUri?: string;
  pickupCategory?: 'standard' | 'bulk' | 'hazardous';
  distanceKm?: number;
  scheduledAt?: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  latitude?: number;
  longitude?: number;
  assignedCollectorId?: string;
  assignedCollectorName?: string;
  assignedCollectorPhone?: string;
  residentConfirmationStatus?: 'pending' | 'approved' | 'rejected' | null;
  residentConfirmedAt?: string | null;
  residentRejectionNote?: string | null;
  completionSubmittedAt?: string | null;
  completionPhotoUri?: string | null;
  completionNote?: string | null;
  completedAt?: string | null;
  status: PickupStatus;
  createdAt: string;
}

export type ReportStatus = 'reported' | 'verified' | 'assigned' | 'cleaned' | 'approved' | 'rejected' | 'cancelled';

export type ReportPriority = 'normal' | 'high' | 'emergency';

export interface Report {
  id: string;
  userId: string;
  type: 'illegal_dumping' | 'overflowing_bin' | 'other';
  description: string;
  photoUri?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  priority?: ReportPriority;
  assignedCollectorId?: string;
  assignedCollectorName?: string;
  assignedCollectorPhone?: string;
  residentConfirmationStatus?: 'pending' | 'approved' | 'rejected' | null;
  residentConfirmedAt?: string | null;
  residentRejectionNote?: string | null;
  cleanedPhotoUri?: string | null;
  cleanedNote?: string | null;
  cleanedAt?: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface ScheduleItem {
  id: string;
  neighborhood: string;
  wasteType: WasteType;
  dayOfWeek: number;
  time: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  pointsRequired: number;
}

export const WASTE_TYPES: { type: WasteType; label: string; icon: string; color: string }[] = [
  { type: 'household', label: 'Household', icon: 'home', color: '#8B5CF6' },
  { type: 'plastic', label: 'Plastic', icon: 'water', color: '#3B82F6' },
  { type: 'organic', label: 'Organic', icon: 'leaf', color: '#22C55E' },
  { type: 'electronic', label: 'Electronic', icon: 'hardware-chip', color: '#F59E0B' },
  { type: 'hazardous', label: 'Hazardous', icon: 'warning', color: '#EF4444' },
  { type: 'metal', label: 'Metal / Steel', icon: 'construct', color: '#64748B' },
  { type: 'mixed', label: 'Mixed', icon: 'layers', color: '#0F766E' },
];

export const NEIGHBORHOODS = [
  'Downtown',
  'Riverside',
  'Greenwood',
  'Hillside',
  'Lakefront',
  'Eastside',
  'Westend',
  'Northgate',
];

export const BADGES: Badge[] = [
  { id: 'first_pickup', name: 'First Step', description: 'Made your first pickup request', icon: 'footsteps', pointsRequired: 0 },
  { id: 'eco_warrior', name: 'Eco Warrior', description: 'Earned 100 points', icon: 'shield-checkmark', pointsRequired: 100 },
  { id: 'reporter', name: 'Community Reporter', description: 'Reported 5 issues', icon: 'megaphone', pointsRequired: 0 },
  { id: 'recycler', name: 'Master Recycler', description: 'Completed 10 recyclable pickups', icon: 'refresh-circle', pointsRequired: 0 },
  { id: 'champion', name: 'Eco Champion', description: 'Earned 500 points', icon: 'trophy', pointsRequired: 500 },
];
