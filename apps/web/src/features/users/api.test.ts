// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUsers, updateUser } from './api';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.del },
  unwrap: async (p: Promise<unknown>) => p,
}));

describe('users api (contract normalization)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes the list response role: { code, name } into roleCode', async () => {
    mocks.get.mockResolvedValue({
      items: [{ id: 1, email: 'a@c.cl', fullName: 'Ana', isActive: true, createdAt: '2026-09-01', role: { code: 'ADMIN', name: 'Administrador' } }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });

    const result = await listUsers({ page: 1, pageSize: 10 });
    expect(result.items[0].roleCode).toBe('ADMIN');
  });

  it('normalizes an ADMIN role object on update responses', async () => {
    mocks.patch.mockResolvedValue({
      id: 2,
      email: 'ope@c.cl',
      fullName: 'Oscar',
      isActive: true,
      createdAt: '2026-09-02',
      role: { code: 'OPERADOR', name: 'Operador' },
    });

    const result = await updateUser(2, { roleCode: 'OPERADOR' });
    expect(result.roleCode).toBe('OPERADOR');
  });

  it('keeps the password out of the update payload when empty', async () => {
    // The frontend sends password: undefined when the field is left blank;
    // updateUser must not add it to the request body.
    await updateUser(2, { fullName: 'Oscar', roleCode: 'OPERADOR', password: undefined });
    expect(mocks.patch).toHaveBeenCalledWith('/users/2', {
      fullName: 'Oscar',
      roleCode: 'OPERADOR',
      password: undefined,
    });
  });

  it('includes the password in the update payload when provided', async () => {
    await updateUser(3, { fullName: 'Ana', roleCode: 'ADMIN', password: 'Nueva123a' });
    expect(mocks.patch).toHaveBeenCalledWith('/users/3', {
      fullName: 'Ana',
      roleCode: 'ADMIN',
      password: 'Nueva123a',
    });
  });
});