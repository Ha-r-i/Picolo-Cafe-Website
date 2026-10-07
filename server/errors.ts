import { z } from 'zod';
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const databaseErrors: Record<string, [number, string]> = {
  CAPACITY_EXCEEDED: [409, 'That time is fully booked. Please choose another.'],
  IDEMPOTENCY_MISMATCH: [409, 'This request key was already used for different booking details.'],
  OUTSIDE_BOOKING_RULES: [422, 'Choose a valid time, party size and booking date.'],
  INVALID_TRANSITION: [409, 'That reservation status change is not allowed.'],
  TOO_EARLY_FOR_STATUS: [409, 'The reservation has not started yet.'],
  STALE_VERSION: [409, 'This record has changed. Refresh before updating it.'],
  FORBIDDEN: [
    403,
    'This action is not allowed. Check the cancellation deadline or your permissions.',
  ],
  UNAUTHORIZED: [401, 'Please sign in again.'],
  NOT_FOUND: [404, 'Reservation not found.'],
  LAST_ADMIN: [409, 'The last administrator cannot be demoted.'],
  INVALID_INPUT: [400, 'Invalid request.'],
  RATE_LIMITED: [429, 'Too many booking requests. Please try again later.'],
};
export function safeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof z.ZodError)
    return new AppError(400, 'VALIDATION_ERROR', 'Check your input and try again.');
  const record = error as { code?: string; message?: string; statusCode?: number };
  if (record.message && databaseErrors[record.message]) {
    const [status, message] = databaseErrors[record.message];
    return new AppError(status, record.message, message);
  }
  if (record.code?.startsWith('23'))
    return new AppError(400, 'INVALID_INPUT', 'The data violates a validation rule.');
  if (record.statusCode === 413)
    return new AppError(413, 'UPLOAD_TOO_LARGE', 'Images must be smaller than 3 MB.');
  if (record.statusCode && record.statusCode >= 400 && record.statusCode < 500)
    return new AppError(record.statusCode, 'INVALID_REQUEST', 'Invalid request.');
  return new AppError(
    503,
    'SERVICE_UNAVAILABLE',
    'The service is temporarily unavailable. Please retry.',
  );
}
