// Users endpoints (admin only).

import { api, unwrap } from '../../lib/api';
import type { Paged, UserItem } from '../../lib/types';

export interface UserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * The API historically returned the role in different shapes: the list
 * response carries `role: { code, name }` while create/update return
 * `role: "ADMIN"` (string). Normalize everything to `roleCode` so the rest of
 * the frontend has a single stable contract.
 */
function normalizeUser(raw: unknown): UserItem {
  const user = (raw ?? {}) as Record<string, unknown>;
  const role = user.role as unknown;
  const roleCode =
    typeof role === 'string'
      ? role.toUpperCase()
      : role && typeof role === 'object'
        ? String((role as { code?: unknown }).code ?? '').toUpperCase()
        : String(user.roleCode ?? '').toUpperCase();
  return {
    id: Number(user.id),
    email: String(user.email ?? ''),
    fullName: String(user.fullName ?? ''),
    isActive: Boolean(user.isActive),
    createdAt: String(user.createdAt ?? ''),
    roleCode,
  };
}

export function listUsers(params: UserListParams): Promise<Paged<UserItem>> {
  const query: Record<string, unknown> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.search) query.search = params.search;
  return unwrap<Paged<UserItem>>(api.get('/users', { params: query })).then((paged) => ({
    page: paged.page,
    pageSize: paged.pageSize,
    total: paged.total,
    totalPages: paged.totalPages,
    items: paged.items.map(normalizeUser),
  }));
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  roleCode: string;
  password: string;
}

export function createUser(payload: CreateUserPayload): Promise<UserItem> {
  return unwrap<unknown>(api.post('/users', payload)).then(normalizeUser);
}

export interface UpdateUserPayload {
  fullName?: string;
  roleCode?: string;
  isActive?: boolean;
  /** Nueva contraseña; vacía o ausente = mantener la actual. */
  password?: string;
}

export function updateUser(id: number, payload: UpdateUserPayload): Promise<UserItem> {
  return unwrap<unknown>(api.patch(`/users/${id}`, payload)).then(normalizeUser);
}

export function deleteUser(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/users/${id}`));
}