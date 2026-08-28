export type AppErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'CONFIGURATION_INVALID'
  | 'NETWORK_UNAVAILABLE'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'AppError';
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError('UNKNOWN', { cause: error });
}
