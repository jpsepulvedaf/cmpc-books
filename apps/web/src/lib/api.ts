// Axios client: attaches the Bearer token, unwraps the backend envelope
// ({ok:true,data} | {ok:false,error}) and normalizes every failure into an
// ApiError whose `userMessage` is already in Spanish.

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import {
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SERVER_ERROR_MESSAGE,
  translateErrorCode,
} from './errors.es';
import { clearSession, getToken } from './session';

const AUTH_LOGIN_PATH = '/auth/login';

let unauthorizedHandler: (() => void) | null = null;
let sessionExpiredNotified = false;

/**
 * Registers a callback invoked when the backend rejects the session token
 * (401). App wires this to redirect to /login. Keep only one handler alive.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/** Called by the login flow when a new session is stored. */
export function resetSessionExpiredNotified(): void {
  sessionExpiredNotified = false;
}

export class ApiError extends Error {
  /** Backend error code, e.g. INVALID_CREDENTIALS. Empty for transport errors. */
  readonly code: string;
  readonly status: number | undefined;
  readonly details: unknown;
  readonly isNetwork: boolean;
  /** Message already translated to neutral Spanish. */
  readonly userMessage: string;

  constructor(input: {
    code: string;
    status?: number;
    details?: unknown;
    isNetwork?: boolean;
    userMessage: string;
  }) {
    super(input.userMessage);
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.isNetwork = input.isNetwork ?? false;
    this.userMessage = input.userMessage;
  }
}

export interface RequestConfig extends AxiosRequestConfig {}

function extractEnvelope(data: unknown): { ok: boolean; error?: { code?: unknown; message?: unknown; details?: unknown } } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.ok !== 'boolean') return null;
  return {
    ok: d.ok,
    error: d.error && typeof d.error === 'object' ? (d.error as { code?: unknown; message?: unknown; details?: unknown }) : undefined,
  };
}

function toUserMessage(status: number | undefined, details: unknown): string {
  if (typeof status === 'number' && status >= 500) return SERVER_ERROR_MESSAGE;
  const list = details;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((d) => String(d)).join(' ');
  }
  return GENERIC_ERROR_MESSAGE;
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 25_000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const configUrl = error.config?.url ?? '';
    const status = error.response?.status;
    const body = error.response?.data;
    const envelope = extractEnvelope(body);

    let code = '';
    let details: unknown = undefined;

    if (envelope) {
      code = typeof envelope.error?.code === 'string' ? envelope.error.code : '';
      details = envelope.error?.details;
    }

    // 401 with an active token is a session expiry: notify once, clear and redirect.
    const hasToken = getToken() !== null;
    const isLoginAttempt = configUrl.includes(AUTH_LOGIN_PATH) || configUrl.endsWith('/auth/login');
    if (status === 401 && hasToken && !isLoginAttempt) {
      clearSession();
      if (!sessionExpiredNotified) {
        sessionExpiredNotified = true;
        toast.error(SESSION_EXPIRED_MESSAGE, { id: 'session-expired', duration: 5000 });
        unauthorizedHandler?.();
      }
    }

    const translated = translateErrorCode(code);
    const userMessage =
      translated ??
      (error.response ? toUserMessage(status, details) : NETWORK_ERROR_MESSAGE);

    throw new ApiError({
      code,
      status,
      details,
      isNetwork: !error.response,
      userMessage,
    });
  }
);

/**
 * Unwraps the success envelope `{ ok: true, data }` from an executed request.
 * Non-2xx responses already throw an ApiError via the response interceptor.
 */
export async function unwrap<T>(request: Promise<{ data: unknown }>): Promise<T> {
  const response = await request;
  const body = response.data;
  if (body && typeof body === 'object' && (body as { ok?: unknown }).ok === true) {
    return (body as { data: T }).data;
  }
  // 204 No Content and other empty bodies have no envelope.
  return undefined as T;
}

/**
 * Performs a request that returns a raw binary body (CSV export), bypassing the
 * envelope unwrapping.
 */
export async function requestBlob<T = Blob>(
  url: string,
  config?: RequestConfig
): Promise<{ data: T; filename: string | null }> {
  const response = await api.get(url, { ...config, responseType: 'blob' });
  const disposition = response.headers['content-disposition'] ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { data: response.data as T, filename: match ? match[1] : null };
}