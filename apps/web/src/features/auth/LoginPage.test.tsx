// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({
  loginRequest: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('./api', () => ({ loginRequest: mocks.loginRequest }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Navigate: () => null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const loginResult = {
  token: 'tok-123',
  user: { id: 7, email: 'admin@cmpc.libros', fullName: 'Admin', role: 'ADMIN', isActive: true },
};

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginPage />
    </QueryClientProvider>
  );
}

function fillCredentials(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('LoginPage', () => {
  it('renders the login screen in Spanish', () => {
    renderLogin();
    expect(screen.getByAltText('CMPC Libros')).toBeInTheDocument();
    expect(screen.getByText('Gestión del catálogo bibliográfico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('validates empty credentials reactively and never calls the API', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await screen.findByText('El correo es obligatorio');
    await screen.findByText('La contraseña es obligatoria');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.loginRequest).not.toHaveBeenCalled();
  });

  it('submits email/password, stores the session and navigates to the catalog', async () => {
    mocks.loginRequest.mockResolvedValue(loginResult);
    renderLogin();
    fillCredentials('admin@cmpc.libros', 'Admin123');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() =>
      expect(mocks.loginRequest).toHaveBeenCalledWith('admin@cmpc.libros', 'Admin123')
    );
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/libros', { replace: true }));
    expect(localStorage.getItem('cmpc_token')).toBe('tok-123');
    expect(JSON.parse(localStorage.getItem('cmpc_user') ?? '{}').role).toBe('ADMIN');
  });

  it('surfaces backend errors in Spanish without storing a session', async () => {
    mocks.loginRequest.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CREDENTIALS',
        status: 401,
        userMessage: 'Credenciales inválidas. Verifica tu correo y contraseña.',
      })
    );
    renderLogin();
    fillCredentials('admin@cmpc.libros', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await screen.findByText('Credenciales inválidas. Verifica tu correo y contraseña.');
    expect(localStorage.getItem('cmpc_token')).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});