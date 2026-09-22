// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setSession } from '../../lib/session';
import { UsersPage } from './UsersPage';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  createUser: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./api', () => ({
  listUsers: mocks.listUsers,
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
  createUser: mocks.createUser,
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));

const users = [
  { id: 1, email: 'ana@cmpc.libros', fullName: 'Ana Admin', roleCode: 'ADMIN', isActive: true, createdAt: '2026-09-01T10:00:00.000Z' },
  { id: 2, email: 'ope@cmpc.libros', fullName: 'Oscar Operador', roleCode: 'OPERADOR', isActive: false, createdAt: '2026-09-02T10:00:00.000Z' },
];

function renderUsers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  setSession('tok', { id: 1, email: 'ana@cmpc.libros', fullName: 'Ana Admin', role: { code: 'ADMIN' } });
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue({
    items: users,
    page: 1,
    pageSize: 10,
    total: 2,
    totalPages: 1,
  });
  mocks.updateUser.mockResolvedValue({ ...users[0], isActive: false });
});

afterEach(() => {
  cleanup();
});

describe('UsersPage', () => {
  it('loads and renders users with Spanish role/status badges', async () => {
    renderUsers();
    await screen.findByText('Ana Admin');

    expect(screen.getByText('ana@cmpc.libros')).toBeInTheDocument();
    expect(screen.getByText('Oscar Operador')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(mocks.listUsers).toHaveBeenCalledWith({ search: undefined, page: 1, pageSize: 10 });
  });

  it('marks the current user with a Tú badge', async () => {
    renderUsers();
    await screen.findByText('Ana Admin');
    expect(screen.getByText('Tú')).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole('button', { name: 'Eliminar' });
    expect(deleteButtons[0]).toBeDisabled(); // cannot delete yourself
  });

  it('toggles a user active state through updateUser', async () => {
    renderUsers();
    await screen.findByText('Ana Admin');
    screen.getByRole('button', { name: 'Desactivar' }).click();

    await vi.waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith(1, { isActive: false })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Usuario desactivado.');
  });

  it('shows the empty state when there are no matches', async () => {
    mocks.listUsers.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    renderUsers();
    await screen.findByText('No hay usuarios que coincidan con la búsqueda.');
  });
});