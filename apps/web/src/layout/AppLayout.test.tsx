// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { getSession, setSession } from '../lib/session';
import { AppLayout } from './AppLayout';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  exportBooksCsv: vi.fn(),
  triggerCsvDownload: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  NavLink: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  Outlet: () => null,
  useNavigate: () => mocks.navigate,
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('../features/books/api', () => ({
  exportBooksCsv: mocks.exportBooksCsv,
  triggerCsvDownload: mocks.triggerCsvDownload,
}));

function renderLayout() {
  return render(<AppLayout />);
}

const adminUser = { id: 7, email: 'admin@cmpc.libros', fullName: 'Ana Admin', role: { code: 'ADMIN' } };
const operadorUser = { id: 8, email: 'ope@cmpc.libros', fullName: 'Oscar Operador', role: { code: 'OPERADOR' } };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AppLayout', () => {
  it('shows Libros, Usuarios and Auditoría links for an ADMIN', () => {
    setSession('tok', adminUser);
    renderLayout();

    expect(screen.getAllByText('Libros').length).toBeGreaterThan(0);
    expect(screen.queryByText('Usuarios')).not.toBeNull();
    expect(screen.queryByText('Auditoría')).not.toBeNull();
    expect(screen.getByText('Ana Admin')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  it('hides Usuarios and Auditoría for an OPERADOR but keeps the CSV export', () => {
    setSession('tok', operadorUser);
    renderLayout();

    expect(screen.getAllByText('Libros').length).toBeGreaterThan(0);
    expect(screen.queryByText('Usuarios')).toBeNull();
    expect(screen.queryByText('Auditoría')).toBeNull();
    expect(screen.getByText('Operador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  it('falls back to a generic label without a session', () => {
    renderLayout();
    expect(screen.getByText('Consulta')).toBeInTheDocument();
    expect(screen.queryByText('Usuarios')).toBeNull();
  });

  it('logs out: clears the session and navigates to /login', () => {
    setSession('tok', adminUser);
    renderLayout();
    expect(getSession()).not.toBeNull();

    screen.getByRole('button', { name: 'Salir' }).click();

    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('cmpc_token')).toBeNull();
  });

  it('exports the full catalog from the navbar button', async () => {
    mocks.exportBooksCsv.mockResolvedValue({ blob: new Blob(['a,b']), filename: 'libros.csv' });
    setSession('tok', adminUser);
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await vi.waitFor(() => expect(mocks.exportBooksCsv).toHaveBeenCalledWith({}));
    await vi.waitFor(() =>
      expect(mocks.triggerCsvDownload).toHaveBeenCalledWith({ blob: expect.anything(), filename: 'libros.csv' })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Exportación completada: libros.csv');
  });

  it('notifies the user when the export fails', async () => {
    mocks.exportBooksCsv.mockRejectedValue(new Error('boom'));
    setSession('tok', adminUser);
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await vi.waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith('No se pudo exportar el catálogo.')
    );
  });

  it('opens the mobile menu and logs out from it', () => {
    setSession('tok', adminUser);
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const mobile = document.querySelector('#mobile-menu');
    expect(mobile).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toBeInTheDocument();

    const mobileSalir = Array.from(mobile!.querySelectorAll('button')).find((button) => button.textContent === 'Salir');
    expect(mobileSalir).toBeDefined();
    fireEvent.click(mobileSalir!);

    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(getSession()).toBeNull();
  });
});