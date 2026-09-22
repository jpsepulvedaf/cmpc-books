import { HttpException } from '@nestjs/common';

/**
 * Domain error carrying a stable machine-readable `code` in addition to the
 * HTTP status. `HttpExceptionFilter` surfaces `code` verbatim in the
 * `{ ok: false, error: { code, message, details? } }` envelope so the frontend
 * can branch on it (e.g. INVALID_CREDENTIALS, EMAIL_EXISTS).
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown[],
  ) {
    super(message, status);
  }
}