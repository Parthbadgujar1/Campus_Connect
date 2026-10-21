// One error type for the whole API. Every failure leaves the server as
//   { "error": { "code": "SOME_CODE", "message": "Readable text", "details": ..., "requestId": "..." } }
// so clients can branch on `code` and show `message` without guessing.

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_SUSPENDED'
  | 'FORBIDDEN'
  | 'CSRF_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ALREADY_EXISTS'
  | 'EVENT_FULL'
  | 'GONE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE'
  | 'WEAK_PASSWORD'
  | 'TOO_MANY_REQUESTS'
  | 'FEATURE_DISABLED'
  | 'MODULE_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'OVERLOADED'
  | 'INTERNAL';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { details?: unknown; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;

/** Factory helpers keep status codes and messages consistent across modules. */
export const Errors = {
  badRequest: (message = 'The request is not valid.', details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, { details }),
  validation: (details: unknown, message = 'Some fields need attention.') =>
    new AppError(400, 'VALIDATION_FAILED', message, { details }),
  unauthenticated: (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
  sessionExpired: () => new AppError(401, 'SESSION_EXPIRED', 'Your session has ended. Please sign in again.'),
  emailNotVerified: () =>
    new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address. We can send the link again.'),
  suspended: () =>
    new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Contact the campus office if this is a mistake.'),
  forbidden: (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message),
  csrf: () => new AppError(403, 'CSRF_FAILED', 'This request could not be verified. Refresh the page and try again.'),
  notFound: (what = 'This item') => new AppError(404, 'NOT_FOUND', `${what} was not found.`),
  conflict: (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, { details }),
  alreadyExists: (message: string) => new AppError(409, 'ALREADY_EXISTS', message),
  eventFull: () => new AppError(409, 'EVENT_FULL', 'This event is full. Mark yourself as interested to hear about openings.'),
  gone: (message = 'This link has expired or was already used.') => new AppError(410, 'GONE', message),
  tooLarge: (message = 'The file is too large.') => new AppError(413, 'PAYLOAD_TOO_LARGE', message),
  unsupportedMedia: (message = 'This file type is not allowed.') => new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message),
  unprocessable: (message: string, details?: unknown) => new AppError(422, 'UNPROCESSABLE', message, { details }),
  weakPassword: (reasons: string[]) =>
    new AppError(422, 'WEAK_PASSWORD', 'Choose a stronger password.', { details: { reasons } }),
  tooMany: (retryAfterSeconds = 60, message = 'Too many attempts. Please wait a moment and try again.') =>
    new AppError(429, 'TOO_MANY_REQUESTS', message, { retryAfterSeconds }),
  featureDisabled: (feature: string) =>
    new AppError(503, 'FEATURE_DISABLED', 'This feature is switched off right now. Please try again later.', {
      details: { feature },
      retryAfterSeconds: 300,
    }),
  moduleUnavailable: (module: string) =>
    new AppError(503, 'MODULE_UNAVAILABLE', 'This part of CampusConnect is temporarily unavailable. Everything else still works.', {
      details: { module },
      retryAfterSeconds: 30,
    }),
  unavailable: (service: string, retryAfterSeconds = 15) =>
    new AppError(503, 'SERVICE_UNAVAILABLE', 'A service we depend on is not responding. Please try again shortly.', {
      details: { service },
      retryAfterSeconds,
    }),
  internal: (cause?: unknown) =>
    new AppError(500, 'INTERNAL', 'Something went wrong on our side. The team has been notified.', { cause }),
};
