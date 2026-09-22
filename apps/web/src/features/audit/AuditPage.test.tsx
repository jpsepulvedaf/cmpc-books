// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setSession } from '../../lib/session';
import { AuditPage } from './AuditPage';

const mocks = vi.hoisted(() => ({ listAudit: vi.fn() }));
vi.mock('./api', () => ({ listAudit: mocks.listAudit }));

const events = [
  {
    id: 1,
    userId: 1,
    userName: 'Ana Admin',
    userRole: 'ADMIN',
    action: 'CREATE',
    entityType: 'BOOK',
    entityId: 42,
    method: 'POST',
    path: '/books',
    details: { title: 'El Aleph' },
    createdAt: '2026-09-22T17:30:00.000Z',
  },
  {
    id: 2,
    userId: null,
    userName: null,
    userRole: null,
    action: 'LOGIN',
    entityType: 'AUTH',
    entityId: null,
    method: 'POST',
    path: '/auth/login',
    details: null,
    createdAt: '2026-09-22T10:00:00.000Z',
  },
];

function renderAudit() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuditPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
  vi.clearAllMocks();
  mocks.listAudit.mockResolvedValue({ items: events, page: 1, pageSize: 10, total: 2, totalPages: 1 });
});

afterEach(() => {
  cleanup();
});

describe('AuditPage', () => {
  it('renders translated actions and entity types with method/path', async () => {
    renderAudit();
    await screen.findByText('Ana Admin');

    expect(screen.getAllByText('Creación').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Libro')).toBeInTheDocument();
    expect(screen.getByText(/POST \/books/)).toBeInTheDocument();
    expect(screen.getByText(/POST \/auth\/login/)).toBeInTheDocument();
  });

  it('expands an event to show its details as JSON', async () => {
    renderAudit();
    await screen.findByText('Ana Admin');

    screen.getByRole('button', { name: 'Ver detalles' }).click();
    await screen.findByText(/"title": "El Aleph"/);
    expect(screen.getByRole('button', { name: 'Ocultar detalles' })).toBeInTheDocument();
  });

  it('shows the empty state when no events match', async () => {
    mocks.listAudit.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    renderAudit();
    await screen.findByText('No hay eventos de auditoría que coincidan con la búsqueda.');
  });
});