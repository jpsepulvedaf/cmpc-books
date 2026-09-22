import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiException } from '../errors/api.exception';

interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

const DEFAULT_CODE = 'INTERNAL_ERROR';
const DEFAULT_MESSAGE = 'Unexpected server error';

/**
 * Global exception filter. Normalizes every error into the transversal
 * `{ ok: false, error: { code, message, details? } }` shape:
 *  - `ApiException` keeps its explicit code (INVALID_CREDENTIALS, ...).
 *  - Validation failures (class-validator runs inside BadRequestException)
 *    surface the field list as `details` with code VALIDATION_FAILED.
 *  - Any other HttpException is mapped by status; unknown errors → 500.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = DEFAULT_CODE;
    let message = DEFAULT_MESSAGE;
    let details: unknown[] | undefined;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const raw = body as { message?: unknown; error?: unknown };
        if (Array.isArray(raw.message)) {
          // class-validator aggregated errors
          code = 'VALIDATION_FAILED';
          message = 'Validation failed';
          details = raw.message;
        } else if (typeof raw.message === 'string') {
          message = raw.message;
        }
      }
      if (code === DEFAULT_CODE) {
        code = STATUS_CODES[status] ?? DEFAULT_CODE;
      }
    }

    const payload: ErrorBody = {
      ok: false,
      error: { code, message, ...(details ? { details } : {}) },
    };
    response.status(status).json(payload);
  }
}