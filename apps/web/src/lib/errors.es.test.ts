import { describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGES,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SERVER_ERROR_MESSAGE,
  translateErrorCode,
} from './errors.es';

describe('translateErrorCode', () => {
  it('maps a known backend code to its Spanish message', () => {
    expect(translateErrorCode('INVALID_CREDENTIALS')).toBe(
      'Credenciales inválidas. Verifica tu correo y contraseña.'
    );
    expect(translateErrorCode('EMAIL_EXISTS')).toBe('El correo ya está registrado.');
    expect(translateErrorCode('BOOK_NOT_FOUND')).toBe('Libro no encontrado.');
    expect(translateErrorCode('FORBIDDEN')).toBe('No tienes permisos para realizar esta acción.');
    expect(translateErrorCode('USER_INACTIVE')).toBe(
      'Tu usuario está desactivado. Contacta con la administración.'
    );
    expect(translateErrorCode('SELF_ACTION_FORBIDDEN')).toBe(
      'No puedes realizar esta acción sobre tu propia cuenta.'
    );
  });

  it('returns undefined for unknown codes so callers can fall back', () => {
    expect(translateErrorCode('SOME_NEW_BACKEND_CODE')).toBeUndefined();
  });

  it('returns undefined when no code is provided', () => {
    expect(translateErrorCode(undefined)).toBeUndefined();
    expect(translateErrorCode('')).toBeUndefined();
  });
});

describe('error message constants', () => {
  it('exposes the Spanish generic, network, server and session messages', () => {
    expect(GENERIC_ERROR_MESSAGE).toBe('Ha ocurrido un error inesperado');
    expect(NETWORK_ERROR_MESSAGE).toBe('No se pudo conectar con el servidor.');
    expect(SERVER_ERROR_MESSAGE).toBe('Error del servidor. Inténtalo de nuevo.');
    expect(SESSION_EXPIRED_MESSAGE).toBe('Tu sesión ha expirado. Inicia sesión nuevamente.');
  });

  it('covers every code in the map without gaps', () => {
    const expectedCodes = [
      'INVALID_CREDENTIALS',
      'USER_INACTIVE',
      'EMAIL_EXISTS',
      'USER_NOT_FOUND',
      'BOOK_NOT_FOUND',
      'FORBIDDEN',
      'UNAUTHORIZED',
      'SELF_ACTION_FORBIDDEN',
      'DUPLICATE_ISBN',
      'INVALID_IMAGE',
      'VALIDATION_FAILED',
      'INTERNAL_ERROR',
    ];
    for (const code of expectedCodes) {
      expect(ERROR_MESSAGES[code], code).toBeTruthy();
      expect(translateErrorCode(code)).toBe(ERROR_MESSAGES[code]);
    }
  });
});