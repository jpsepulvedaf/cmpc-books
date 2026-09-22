// Spanish translations for backend error codes.
// Backend messages arrive in English; the UI must show friendly Spanish text.

export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: 'Credenciales inválidas. Verifica tu correo y contraseña.',
  EMAIL_EXISTS: 'El correo ya está registrado.',
  USER_NOT_FOUND: 'Usuario no encontrado.',
  BOOK_NOT_FOUND: 'Libro no encontrado.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  UNAUTHORIZED: 'Tu sesión no es válida. Inicia sesión nuevamente.',
  DUPLICATE_ISBN: 'Ya existe un libro con este ISBN.',
  INVALID_IMAGE: 'La imagen no es válida (JPEG, PNG o WebP, máx. 2 MB).',
  VALIDATION_FAILED: 'Revisa los campos marcados.',
  INTERNAL_ERROR: 'Error del servidor. Inténtalo de nuevo.',
};

export const GENERIC_ERROR_MESSAGE = 'Ha ocurrido un error inesperado';
export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor.';
export const SERVER_ERROR_MESSAGE = 'Error del servidor. Inténtalo de nuevo.';
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha expirado. Inicia sesión nuevamente.';

export interface RawBackendError {
  code?: string;
  message?: string;
  details?: unknown;
}

/** Maps a backend error code to its Spanish message, if known. */
export function translateErrorCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return ERROR_MESSAGES[code];
}