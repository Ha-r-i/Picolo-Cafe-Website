import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  bookingSchema,
  validSlots,
  fingerprint,
  guestToken,
} from '../../server/modules/reservations';
import { safeError } from '../../server/errors';
import { legacyStart, pricePaise } from '../../scripts/import-legacy';
import type { CafeSettings } from '../../shared/types';
const settings: CafeSettings = {
  timezone: 'Asia/Kolkata',
  capacity: 24,
  duration_minutes: 90,
  slot_minutes: 30,
  lead_minutes: 120,
  cancellation_minutes: 120,
  max_party_size: 10,
  horizon_days: 60,
  opening_hours: { '4': { open: '09:00', close: '22:00' } },
};
describe('booking boundary rules', () => {
  it('enforces closing time and cafe timezone rather than browser timezone', () => {
    const slots = validSlots(settings, '2026-10-08', DateTime.fromISO('2026-10-08T07:00:00+05:30'));
    expect(slots[0]).toBe('2026-10-08T03:30:00.000Z');
    expect(slots.at(-1)).toBe('2026-10-08T15:00:00.000Z');
    expect(slots.length).toBe(24);
  });
  it('rejects closed days, invalid calendar dates, past dates and dates beyond horizon', () => {
    const now = DateTime.fromISO('2026-10-08T00:00:00+05:30');
    expect(validSlots(settings, '2026-10-09', now)).toEqual([]);
    expect(validSlots(settings, '2026-02-30', now)).toEqual([]);
    expect(validSlots(settings, '2026-10-01', now)).toEqual([]);
    expect(validSlots(settings, '2027-10-08', now)).toEqual([]);
  });
  it('normalizes email and timestamps, rejects fractional party sizes and extra fields', () => {
    const data = {
      name: ' Test User ',
      email: 'USER@example.com',
      phone: '+91 98765 43210',
      starts_at: '2026-10-08T12:00:00+05:30',
      guests: 2,
    };
    const parsed = bookingSchema.parse(data);
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.starts_at).toBe('2026-10-08T06:30:00.000Z');
    expect(() => bookingSchema.parse({ ...data, guests: 1.5 })).toThrow();
    expect(() => bookingSchema.parse({ ...data, role: 'admin' })).toThrow();
    expect(() => bookingSchema.parse({ ...data, website: 'bot' })).toThrow();
  });
  it('reproduces the guest credential on safe replay and changes it for different details', () => {
    const hash = fingerprint({ guests: 2 });
    expect(guestToken('secret', 'key', hash)).toBe(guestToken('secret', 'key', hash));
    expect(guestToken('secret', 'key', hash)).not.toBe(
      guestToken('secret', 'key', fingerprint({ guests: 3 })),
    );
  });
  it('keeps infrastructure details out of errors', () => {
    const result = safeError(new Error('password=secret host=internal'));
    expect(result.message).not.toContain('secret');
    expect(result.status).toBe(503);
  });
  it('translates exported local timestamps and currency without guessing invalid values', () => {
    expect(legacyStart('2026-10-08', '12:30 PM', 'Asia/Kolkata')).toBe('2026-10-08T07:00:00.000Z');
    expect(pricePaise('₹1,234.50')).toBe(123450);
    expect(() => pricePaise('market price')).toThrow();
  });
});
