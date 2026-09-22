// Users endpoints (admin only).

import { api, unwrap } from '../../lib/api';
import type { Paged, UserItem } from '../../lib/types';

export interface UserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function listUsers(params: UserListParams): Promise<Paged<UserItem>> {
  const query: Record<string, unknown> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.search) query.search = params.search;
  return unwrap<Paged<UserItem>>(api.get('/users', { params: query }));
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  roleCode: string;
  password: string;
}

export function createUser(payload: CreateUserPayload): Promise<UserItem> {
  return unwrap<UserItem>(api.post('/users', payload));
}

export interface UpdateUserPayload {
  fullName?: string;
  roleCode?: string;
  isActive?: boolean;
}

export function updateUser(id: number, payload: UpdateUserPayload): Promise<UserItem> {
  return unwrap<UserItem>(api.patch(`/users/${id}`, payload));
}

export function deleteUser(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/users/${id}`));
}