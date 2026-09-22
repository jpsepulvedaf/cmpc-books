// Session persistence: token (cmpc_token) and user (cmpc_user) in localStorage.

import type { RoleCode, SessionUser } from './types';

const TOKEN_KEY = 'cmpc_token';
const USER_KEY = 'cmpc_user';

export interface Session {
  token: string;
  user: SessionUser;
}

/** Normalizes whatever role shape the API returns into a RoleCode. */
export function normalizeRoleCode(role: unknown): RoleCode {
  if (typeof role === 'string') {
    const upper = role.toUpperCase();
    if (upper === 'ADMIN' || upper === 'OPERADOR' || upper === 'CONSULTA') {
      return upper;
    }
    return 'CONSULTA';
  }
  if (role && typeof role === 'object') {
    return normalizeRoleCode((role as { code?: unknown }).code);
  }
  return 'CONSULTA';
}

function parseUser(raw: unknown): SessionUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number' || typeof r.email !== 'string') return null;
  return {
    id: r.id,
    email: r.email,
    fullName: typeof r.fullName === 'string' && r.fullName.length > 0 ? r.fullName : String(r.email),
    role: normalizeRoleCode(r.role ?? r.roleCode),
    isActive: r.isActive !== false,
  };
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const rawUser = localStorage.getItem(USER_KEY);
    if (!rawUser) return null;
    const user = parseUser(JSON.parse(rawUser));
    if (!user) return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function setSession(token: string, user: unknown): Session {
  const normalized = parseUser(user);
  const fallback: SessionUser = {
    id: 0,
    email: '',
    fullName: '',
    role: 'CONSULTA',
    isActive: true,
  };
  const session: Session = { token, user: normalized ?? fallback };
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } catch {
    // Storage unavailable (e.g. private mode): session stays in memory only.
  }
  return session;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage errors on logout.
  }
}

export function isRole(role: RoleCode): boolean {
  return getSession()?.user.role === role;
}

export function hasRole(role: RoleCode): boolean {
  return isRole(role);
}

export function isAdmin(): boolean {
  return hasRole('ADMIN');
}