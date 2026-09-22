import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, requestBlob, resetSessionExpiredNotified, setUnauthorizedHandler, unwrap } from './api';
import * as sessionModule from './session';
import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE } from './errors.es';

// ── axios mock: captures the registered interceptors ─────────────────────────

const ax = vi.hoisted(() => ({
  handlers: { request: undefined as unknown, response: undefined as unknown },
}));

vi.mock('axios', () => {
const instance = {
    interceptors: {
      request: { use: vi.fn<(_h: unknown) => undefined>((handler) => void (ax.handlers.request = handler)) },
      // axios registers two callbacks (success + error); keep the error one.
      response: { use: vi.fn<(_ok: unknown, _err: unknown) => undefined>((_ok, errorHandler) => void (ax.handlers.response = errorHandler)) },
    },
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: { create: vi.fn(() => instance) },
  };
  return {
    default: { create: vi.fn(() => instance) },
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

// ── Test plumbing ────────────────────────────────────────────────────────────

let unauthorizedCalled = false;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(sessionModule, 'getToken').mockReturnValue(null);
  vi.spyOn(sessionModule, 'clearSession').mockImplementation(() => {});
  resetSessionExpiredNotified();
  unauthorizedCalled = false;
  setUnauthorizedHandler(() => {
    unauthorizedCalled = true;
  });
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.restoreAllMocks();
});

function invokeErrorHandler(error: unknown): unknown {
  try {
    // axios invokes the error interceptor with the error as first argument.
    (ax.handlers.response as (e: unknown) => unknown)(error);
    return undefined;
  } catch (thrown) {
    return thrown;
  }
}

function backendError(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return {
    config: { url: extra.url ?? '/books' },
    response: {
      status,
      data: { ok: false, error: { code, message: 'backend english', details: extra.details } },
    },
  };
}

// ── Request interceptor ──────────────────────────────────────────────────────

describe('request interceptor', () => {
  it('attaches the Bearer token from the session', () => {
    vi.spyOn(sessionModule, 'getToken').mockReturnValue('tok-1');
    const setHeader = vi.fn();
    const handler = ax.handlers.request as (config: Record<string, unknown>) => Record<string, unknown>;
    const config = handler({ headers: { set: setHeader } });
    expect(setHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok-1');
    expect(config).toEqual({ headers: { set: setHeader } });
  });

  it('leaves the config untouched when there is no token', () => {
    const handler = ax.handlers.request as (config: Record<string, unknown>) => Record<string, unknown>;
    const config = handler({ url: '/books' });
    expect(config).toEqual({ url: '/books' });
  });
});

// ── unwrap ───────────────────────────────────────────────────────────────────

describe('unwrap', () => {
  it('unwraps the {ok:true,data} envelope', async () => {
    const result = await unwrap<{ id: number }>(Promise.resolve({ data: { ok: true, data: { id: 42 } } }));
    expect(result.id).toBe(42);
  });

  it('returns undefined for empty or non-envelope bodies (e.g. 204)', async () => {
    expect(await unwrap<unknown>(Promise.resolve({ data: null }))).toBeUndefined();
    expect(await unwrap<unknown>(Promise.resolve({ data: 'plain' }))).toBeUndefined();
  });
});

// ── Response error normalization ─────────────────────────────────────────────

describe('response error normalization', () => {
  it('throws an ApiError with the Spanish message for a known business code', () => {
    const thrown = invokeErrorHandler(backendError('INVALID_CREDENTIALS', 401, { url: '/auth/login' }));
    expect(thrown).toBeInstanceOf(ApiError);
    const error = thrown as ApiError;
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(error.status).toBe(401);
    expect(error.userMessage).toBe('Credenciales inválidas. Verifica tu correo y contraseña.');
    expect(error.isNetwork).toBe(false);
  });

  it('falls back to the generic message for an unknown code', () => {
    const thrown = invokeErrorHandler(backendError('MYSTERY_CODE', 422));
    expect((thrown as ApiError).userMessage).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('joins validation details when present and the code is not translated', () => {
    const thrown = invokeErrorHandler(backendError('UNTRANSLATED_CODE', 422, { details: ['Campo a', 'Campo b'] }));
    expect((thrown as ApiError).userMessage).toBe('Campo a Campo b');
  });

  it('uses the server error copy for 5xx regardless of details', () => {
    const thrown = invokeErrorHandler(backendError('', 500, { details: ['ignored'] }));
    expect((thrown as ApiError).userMessage).toBe(SERVER_ERROR_MESSAGE);
  });

  it('treats a non-object response body as a generic error', () => {
    const thrown = invokeErrorHandler({ config: { url: '/books' }, response: { status: 400, data: 'boom' } });
    expect((thrown as ApiError).userMessage).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('normalizes a missing envelope to an empty code', () => {
    const thrown = invokeErrorHandler({ config: { url: '/books' }, response: { status: 422, data: { ok: true } } });
    expect((thrown as ApiError).code).toBe('');
  });

  it('exposes a network error with the connection message and isNetwork flag', () => {
    const thrown = invokeErrorHandler({ config: { url: '/books' } });
    const error = thrown as ApiError;
    expect(error.isNetwork).toBe(true);
    expect(error.userMessage).toBe(NETWORK_ERROR_MESSAGE);
    expect(error.code).toBe('');
  });
});

// ── 401 session expiry ───────────────────────────────────────────────────────

describe('401 session expiry', () => {
  it('clears the session, notifies once and invokes the unauthorized handler', () => {
    vi.spyOn(sessionModule, 'getToken').mockReturnValue('tok-x');
    const clearSpy = vi.spyOn(sessionModule, 'clearSession');

    const thrown = invokeErrorHandler(backendError('UNAUTHORIZED', 401));
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      SESSION_EXPIRED_MESSAGE,
      expect.objectContaining({ id: 'session-expired' })
    );
    expect(unauthorizedCalled).toBe(true);
    expect(thrown).toBeInstanceOf(ApiError);
  });

  it('notifies only once for repeated 401s', () => {
    vi.spyOn(sessionModule, 'getToken').mockReturnValue('tok-x');
    invokeErrorHandler(backendError('UNAUTHORIZED', 401));
    invokeErrorHandler(backendError('UNAUTHORIZED', 401));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(unauthorizedCalled).toBe(true);
  });

  it('does not treat a failed login attempt as session expiry', () => {
    vi.spyOn(sessionModule, 'getToken').mockReturnValue('tok-x');
    const clearSpy = vi.spyOn(sessionModule, 'clearSession');
    const thrown = invokeErrorHandler(backendError('INVALID_CREDENTIALS', 401, { url: '/auth/login' }));
    expect(clearSpy).not.toHaveBeenCalled();
    expect((thrown as ApiError).userMessage).toBe(
      'Credenciales inválidas. Verifica tu correo y contraseña.'
    );
  });
});

// ── requestBlob ──────────────────────────────────────────────────────────────

describe('requestBlob', () => {
  it('returns the blob body and the filename from content-disposition', async () => {
    const blob = new Blob(['a,b']);
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="libros_2026-09-22.csv"' },
    });
    const result = await requestBlob('/books/export', { params: { search: 'x' } });
    expect(api.get).toHaveBeenCalledWith('/books/export', { params: { search: 'x' }, responseType: 'blob' });
    expect(result.data).toBe(blob);
    expect(result.filename).toBe('libros_2026-09-22.csv');
  });

  it('returns a null filename when content-disposition is missing (defaults live in exportBooksCsv)', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: new Blob(['x']),
      headers: {},
    });
    const result = await requestBlob('/books/export');
    expect(result.filename).toBeNull();
  });
});