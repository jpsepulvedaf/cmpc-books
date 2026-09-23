// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { getSession, setSession } from '../lib/session';
import { AppLayout } from './AppLayout';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  NavLink: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  Outlet: () => null,
  useNavigate: () => mocks.navigate,
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));

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
  });

  it('hides Usuarios and Auditoría for an OPERADOR', () => {
    setSession('tok', operadorUser);
    renderLayout();

    expect(screen.getAllByText('Libros').length).toBeGreaterThan(0);
    expect(screen.queryByText('Usuarios')).toBeNull();
    expect(screen.queryByText('Auditoría')).toBeNull();
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  // The document CSV export lives inside the books section, not in the navbar,
  // so no export button should ever appear in this layout.
  it('never renders an Exportar CSV button in the navbar', () => {
    setSession('tok', adminUser);
    renderLayout();
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).toBeNull();
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