// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setSession } from '../../lib/session';
import { BookDetailPage } from './BookDetailPage';

const mocks = vi.hoisted(() => ({
  getBook: vi.fn(),
  navigate: vi.fn(),
  params: {} as Record<string, string>,
}));

vi.mock('./api', () => ({ getBook: mocks.getBook }));
vi.mock('react-router-dom', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

const book = {
  id: 9,
  isbn: '978-3-16-148410-0',
  title: 'El Aleph',
  description: 'Relatos que exploran el infinito.',
  price: '19900',
  stock: 12,
  availability: 'IN_STOCK',
  imageUrl: null,
  author: { id: 1, name: 'Jorge Luis Borges' },
  publisher: { id: 1, name: 'Alianza' },
  genre: { id: 2, name: 'Ficción' },
  authorId: 1,
  publisherId: 1,
  genreId: 2,
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookDetailPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.params = { id: '9' };
});

afterEach(() => {
  cleanup();
});

describe('BookDetailPage', () => {
  it('renders the book data with formatted price and availability badge', async () => {
    mocks.getBook.mockResolvedValue(book);
    renderDetail();
    await waitFor(() => expect(mocks.getBook).toHaveBeenCalledWith(9));

    expect(await screen.findByRole('heading', { name: 'El Aleph' })).toBeInTheDocument();
    expect(screen.getByText('Jorge Luis Borges')).toBeInTheDocument();
    expect(screen.getByText('Alianza')).toBeInTheDocument();
    expect(screen.getByText('Ficción')).toBeInTheDocument();
    expect(screen.getByText('978-3-16-148410-0')).toBeInTheDocument();
    expect(screen.getByText('$19.900')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Relatos que exploran el infinito.')).toBeInTheDocument();
    // Badge with the Spanish availability label.
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('renders an Agotado badge for out-of-stock books', async () => {
    mocks.getBook.mockResolvedValue({ ...book, availability: 'OUT_OF_STOCK' });
    renderDetail();
    await screen.findByRole('heading', { name: 'El Aleph' });
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('navigates back to the catalog on Volver', async () => {
    mocks.getBook.mockResolvedValue(book);
    renderDetail();
    await screen.findByRole('heading', { name: 'El Aleph' });

    const volver = screen.getByRole('button', { name: 'Volver' });
    volver.click();
    expect(mocks.navigate).toHaveBeenCalledWith('/libros');
  });

  it('does not offer the edit link for non-ADMIN sessions', async () => {
    mocks.getBook.mockResolvedValue(book);
    localStorage.clear();
    renderDetail();
    await screen.findByRole('heading', { name: 'El Aleph' });
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
  });

  it('offers the edit link to ADMIN sessions', async () => {
    mocks.getBook.mockResolvedValue(book);
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'El Aleph' });
    const edit = screen.getByRole('link', { name: 'Editar' });
    expect(edit).toHaveAttribute('href', '/libros/9/editar');
  });

  it('shows ErrorState-style message when the book cannot be loaded', async () => {
    mocks.getBook.mockRejectedValue(new Error('boom'));
    renderDetail();
    await screen.findByText('No se pudo cargar el libro.');
    expect(screen.getByRole('button', { name: 'Volver al catálogo' })).toBeInTheDocument();
  });
});