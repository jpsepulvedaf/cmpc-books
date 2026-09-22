import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSession,
  getSession,
  getToken,
  hasRole,
  isAdmin,
  isRole,
  normalizeRoleCode,
  setSession,
} from './session';

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
  };
}

const user = {
  id: 7,
  email: 'admin@cmpc.libros',
  fullName: 'Admin CMPC',
  role: { code: 'ADMIN' },
  isActive: true,
};

let storage: Storage;

beforeEach(() => {
  storage = createStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session round-trip', () => {
  it('stores and retrieves a session with a normalized role', () => {
    const saved = setSession('tok-123', user);
    expect(saved.user.role).toBe('ADMIN');
    expect(getToken()).toBe('tok-123');
    expect(getSession()).toEqual({
      token: 'tok-123',
      user: {
        id: 7,
        email: 'admin@cmpc.libros',
        fullName: 'Admin CMPC',
        role: 'ADMIN',
        isActive: true,
      },
    });
  });

  it('clears the session and every storage key', () => {
    setSession('tok', user);
    clearSession();
    expect(getToken()).toBeNull();
    expect(getSession()).toBeNull();
  });
});

describe('getSession edge cases', () => {
  it('returns null when there is no token', () => {
    storage.setItem('cmpc_user', JSON.stringify({ id: 1, email: 'a@b.cl' }));
    expect(getSession()).toBeNull();
  });

  it('returns null when the token exists but the user is missing', () => {
    storage.setItem('cmpc_token', 'tok');
    expect(getSession()).toBeNull();
  });

  it('does not crash on a corrupt user JSON and returns null', () => {
    storage.setItem('cmpc_token', 'tok');
    storage.setItem('cmpc_user', '{not valid json');
    expect(getSession()).toBeNull();
  });

  it('falls back to the email as fullName when fullName is missing', () => {
    setSession('tok', { id: 1, email: 'a@b.cl', role: 'CONSULTA' });
    expect(getSession()?.user.fullName).toBe('a@b.cl');
  });
});

describe('setSession fallbacks', () => {
  it('builds a safe fallback user when the payload is unparseable', () => {
    const saved = setSession('tok', 'not-an-object');
    expect(saved.user).toEqual({
      id: 0,
      email: '',
      fullName: '',
      role: 'CONSULTA',
      isActive: true,
    });
  });

  it('survives storage failure (private mode) and still returns the session', () => {
    vi.stubGlobal(
      'localStorage',
      new Proxy(storage, {
        get(_target, prop) {
          if (prop === 'setItem') throw new Error('Storage blocked');
          return Reflect.get(storage, prop);
        },
      })
    );
    const saved = setSession('tok', user);
    expect(saved.token).toBe('tok');
  });
});

describe('role helpers', () => {
  it('normalizeRoleCode maps string and object shapes to RoleCode', () => {
    expect(normalizeRoleCode('ADMIN')).toBe('ADMIN');
    expect(normalizeRoleCode('operador')).toBe('OPERADOR');
    expect(normalizeRoleCode('whatever')).toBe('CONSULTA');
    expect(normalizeRoleCode({ code: 'ADMIN' })).toBe('ADMIN');
    expect(normalizeRoleCode(42)).toBe('CONSULTA');
    expect(normalizeRoleCode(null)).toBe('CONSULTA');
  });

  it('isRole/isAdmin/hasRole answer from the stored session', () => {
    expect(isRole('ADMIN')).toBe(false);
    setSession('tok', user);
    expect(isRole('ADMIN')).toBe(true);
    expect(isRole('OPERADOR')).toBe(false);
    expect(hasRole('ADMIN')).toBe(true);
    expect(isAdmin()).toBe(true);
  });
});

describe('storage unavailability on reads', () => {
  it('getToken and clearSession tolerate getItem/removeItem failures', () => {
    vi.stubGlobal(
      'localStorage',
      new Proxy(storage, {
        get(_target, prop) {
          if (prop === 'getItem' || prop === 'removeItem') throw new Error('nope');
          return Reflect.get(storage, prop);
        },
        set() {
          return true;
        },
      })
    );
    expect(getToken()).toBeNull();
    clearSession(); // must not throw
    expect(getSession()).toBeNull();
  });
});