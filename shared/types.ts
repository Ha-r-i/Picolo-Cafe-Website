export const statuses = [
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'rejected',
  'no_show',
] as const;
export type ReservationStatus = (typeof statuses)[number];
export type Role = 'customer' | 'staff' | 'admin';
export const transitions: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled', 'rejected'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
  no_show: [],
};
export interface Reservation {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  starts_at: string;
  ends_at: string;
  guests: number;
  notes: string;
  status: ReservationStatus;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
}
export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price_paise: number;
  dietary: 'vegetarian' | 'vegan' | 'non_vegetarian';
  image_path: string | null;
  published: boolean;
  featured: boolean;
  sample_data: boolean;
  version: number;
}
export interface CafeSettings {
  timezone: string;
  capacity: number;
  duration_minutes: number;
  slot_minutes: number;
  lead_minutes: number;
  cancellation_minutes: number;
  max_party_size: number;
  horizon_days: number;
  opening_hours: Record<string, { open: string; close: string } | null>;
}
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface AuditEvent {
  id: number;
  actor_id: string | null;
  actor_kind: string;
  from_status: ReservationStatus | null;
  to_status: ReservationStatus;
  version: number;
  created_at: string;
}
export interface NotificationEvent {
  id: string;
  reservation_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}
