import { createHash, createHmac } from 'node:crypto';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { CafeSettings } from '../../shared/types.js';

// These helpers have no HTTP or database dependencies.
export const bookingSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/),
    starts_at: z.iso.datetime({ offset: true }).transform((start) => new Date(start).toISOString()),
    guests: z.number().int().min(1).max(50),
    notes: z.string().trim().max(1000).default(''),
    // A hidden field must stay empty; it helps reject automated submissions.
    website: z.string().max(0).optional(),
  })
  .strict();

export function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function guestToken(secret: string, key: string, hash: string): string {
  // Same key and details produce the same credential when a request is retried.
  return createHmac('sha256', secret).update(`${key}:${hash}`).digest('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function validSlots(
  settings: CafeSettings,
  date: string,
  now: DateTime = DateTime.now(),
): string[] {
  const visitDay = DateTime.fromISO(date, { zone: settings.timezone });
  const today = now.setZone(settings.timezone).startOf('day');
  const lastBookingDay = today.plus({ days: settings.horizon_days });

  if (!visitDay.isValid || visitDay.toISODate() !== date) {
    return [];
  }
  if (visitDay.startOf('day') < today || visitDay > lastBookingDay) {
    return [];
  }

  // Luxon uses 1-7 for Monday-Sunday; our settings use 0-6 for Sunday-Saturday.
  const weekday = String(visitDay.weekday % 7);
  const openingHours = settings.opening_hours[weekday];
  if (!openingHours) {
    return [];
  }

  const openingTime = DateTime.fromISO(`${date}T${openingHours.open}`, { zone: settings.timezone });
  const closingTime = DateTime.fromISO(`${date}T${openingHours.close}`, {
    zone: settings.timezone,
  });
  const earliestStart = now.plus({ minutes: settings.lead_minutes });
  const slots: string[] = [];
  let slot = openingTime;

  while (slot.plus({ minutes: settings.duration_minutes }) <= closingTime) {
    const utcStart = slot.toUTC().toISO();
    if (slot >= earliestStart && utcStart !== null) {
      slots.push(utcStart);
    }
    slot = slot.plus({ minutes: settings.slot_minutes });
  }

  return slots;
}
