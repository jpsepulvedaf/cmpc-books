import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ArgumentsHost, BadRequestException, ForbiddenException, HttpException, PayloadTooLargeException } from '@nestjs/common';
import { ApiException } from '../errors/api.exception';
import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Unit tests for the global HttpExceptionFilter → `{ ok:false, error: {...} }`
 * envelope contract. The filter is exercised through a stubbed ArgumentsHost
 * (no HTTP server involved).
 */
describe('HttpExceptionFilter (unit)', () => {
  let status: Mock<() => { json: (payload: unknown) => void }>;
  let json: Mock<(payload: unknown) => void>;
  const filter = new HttpExceptionFilter();

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn(() => ({ json }));
  });

  function run(exception: unknown): void {
    const response = { status, json };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    filter.catch(exception, host);
  }

  it('maps an ApiException to the envelope keeping its explicit code', () => {
    run(new ApiException(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
  });

  it('surfaces ApiException details when present', () => {
    run(new ApiException(400, 'INVALID_SORT_FIELD', 'Sort invalid', ['foo:up']));

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'INVALID_SORT_FIELD', message: 'Sort invalid', details: ['foo:up'] },
    });
  });

  it('maps class-validator aggregated errors to VALIDATION_FAILED with details', () => {
    run(new BadRequestException(['password too weak', 'email is invalid']));

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: ['password too weak', 'email is invalid'],
      },
    });
  });

  it('maps a generic HttpException by status code (string body)', () => {
    run(new NotFoundStub());

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Book not found' },
    });
  });

  it('maps ForbiddenException to FORBIDDEN', () => {
    run(new ForbiddenException('Insufficient permissions for this operation'));

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions for this operation' },
    });
  });

  it('maps 413 to PAYLOAD_TOO_LARGE (multer oversize uploads)', () => {
    run(new PayloadTooLargeException());

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload Too Large' },
    });
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking details', () => {
    run(new Error('boom: the database exploded'));

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    });
  });
});

class NotFoundStub extends HttpException {
  constructor() {
    super('Book not found', 404);
  }
}