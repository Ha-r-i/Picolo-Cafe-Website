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

interface PublicError {
  status: number;
  message: string;
}

// PostgreSQL functions raise these codes. Only these reviewed messages
// are sent to the browser; raw database errors can contain private data.
const databaseErrors: Record<string, PublicError> = {
  CAPACITY_EXCEEDED: { status: 409, message: 'That time is fully booked. Please choose another.' },
  IDEMPOTENCY_MISMATCH: {
    status: 409,
    message: 'This request key was already used for different booking details.',
  },
  OUTSIDE_BOOKING_RULES: {
    status: 422,
    message: 'Choose a valid time, party size and booking date.',
  },
  INVALID_TRANSITION: { status: 409, message: 'That reservation status change is not allowed.' },
  TOO_EARLY_FOR_STATUS: { status: 409, message: 'The reservation has not started yet.' },
  STALE_VERSION: { status: 409, message: 'This record has changed. Refresh before updating it.' },
  FORBIDDEN: {
    status: 403,
    message: 'This action is not allowed. Check the cancellation deadline or your permissions.',
  },
  UNAUTHORIZED: { status: 401, message: 'Please sign in again.' },
  NOT_FOUND: { status: 404, message: 'Reservation not found.' },
  LAST_ADMIN: { status: 409, message: 'The last administrator cannot be demoted.' },
  INVALID_INPUT: { status: 400, message: 'Invalid request.' },
  RATE_LIMITED: { status: 429, message: 'Too many booking requests. Please try again later.' },
};

function errorDetails(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  return error as Record<string, unknown>;
}

export function errorCode(error: unknown): string | undefined {
  const details = errorDetails(error);
  return typeof details.code === 'string' ? details.code : undefined;
}

export function safeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Check your input and try again.');
  }

  const details = errorDetails(error);
  const message = typeof details.message === 'string' ? details.message : '';
  const knownError = Object.hasOwn(databaseErrors, message) ? databaseErrors[message] : undefined;

  if (knownError) {
    return new AppError(knownError.status, message, knownError.message);
  }

  // PostgreSQL codes starting with 23 are constraint violations.
  const code = errorCode(error);
  if (code?.startsWith('23')) {
    return new AppError(400, 'INVALID_INPUT', 'The data violates a validation rule.');
  }

  const status = details.statusCode;
  if (status === 413) {
    return new AppError(413, 'UPLOAD_TOO_LARGE', 'Images must be smaller than 3 MB.');
  }

  if (typeof status === 'number' && status >= 400 && status < 500) {
    return new AppError(status, 'INVALID_REQUEST', 'Invalid request.');
  }

  return new AppError(
    503,
    'SERVICE_UNAVAILABLE',
    'The service is temporarily unavailable. Please retry.',
  );
}
