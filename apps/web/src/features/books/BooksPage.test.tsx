// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setSession } from '../../lib/session';
import { BooksPage } from './BooksPage';

const mocks = vi.hoisted(() => ({
  listBooks: vi.fn(),
  getCatalogBundle: vi.fn(),
  deleteBook: vi.fn(),
  exportBooksCsv: vi.fn(),
  triggerCsvDownload: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  invalidateQueries: vi.fn(),
}));

vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: mocks.invalidateQueries } }));

vi.mock('./api', () => ({
  listBooks: mocks.listBooks,
  getCatalogBundle: mocks.getCatalogBundle,
  deleteBook: mocks.deleteBook,
  exportBooksCsv: mocks.exportBooksCsv,
  triggerCsvDownload: mocks.triggerCsvDownload,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, 'aria-label': ariaLabel }: { to: string; children: ReactNode; 'aria-label'?: string; className?: string }) => (
    <a href={to} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));

const borges = {
  id: 1,
  isbn: '978-3-16-148410-0',
  title: 'El Aleph',
  description: null,
  price: '19900',
  stock: 12,
  availability: 'IN_STOCK',
  imageUrl: null,
  author: { id: 1, name: 'Jorge Luis Borges' },
  publisher: { id: 1, name: 'Alianza' },
  genre: { id: 2, name: 'Ficción' },
};
const agotado = {
  ...borges,
  id: 2,
  title: 'Ficciones',
  availability: 'OUT_OF_STOCK',
  stock: 0,
};

function renderBooksPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BooksPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  setSession('tok', { id: 7, email: 'admin@cmpc.libros', fullName: 'Admin', role: { code: 'ADMIN' }, isActive: true });
  vi.clearAllMocks();
  mocks.getCatalogBundle.mockResolvedValue({
    genres: [borges.genre],
    authors: [borges.author],
    publishers: [borges.publisher],
  });
  mocks.listBooks.mockImplementation(async (params: { page?: number; pageSize?: number }) => ({
    items: params.page === 2 ? [agotado] : [borges],
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
    total: 25,
    totalPages: 3,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BooksPage', () => {
  it('loads the catalog and renders a book row with the Spanish availability badge', async () => {
    renderBooksPage();

    await screen.findByText('El Aleph');
    expect(screen.getByText('978-3-16-148410-0')).toBeInTheDocument();
    expect(screen.getAllByText('Jorge Luis Borges').length).toBeGreaterThan(0);
    expect(screen.getByText('$19.900')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Disponible' })).toBeInTheDocument();
    expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }));

    // Sort headers use the Spanish column labels.
    expect(screen.getByRole('button', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disponibilidad' })).toBeInTheDocument();
  });

  it('debounces the search input before querying with ?search=', async () => {
    renderBooksPage();
    await screen.findByText('El Aleph');

    vi.useFakeTimers();
    const callsBeforeTyping = mocks.listBooks.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Buscar libros'), { target: { value: 'borges' } });
    // Debounce has not elapsed: no new query yet.
    vi.advanceTimersByTime(299);
    expect(mocks.listBooks).toHaveBeenCalledTimes(callsBeforeTyping);

    vi.advanceTimersByTime(1);
    // Let react-query pick up the new query key.
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ search: 'borges' }))
    );
  });

  it('goes to page 2 when clicking Siguiente', async () => {
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    );
    await screen.findByText('Ficciones');
  });

  it('adds the availability filter to the query when changed', async () => {
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.change(screen.getByLabelText('Disponibilidad'), { target: { value: 'OUT_OF_STOCK' } });
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ availability: 'OUT_OF_STOCK' }))
    );
  });

  it('exports the CSV honoring the active filters and triggers the download', async () => {
    mocks.exportBooksCsv.mockResolvedValue({ blob: new Blob(['a,b']), filename: 'libros.csv' });
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.change(screen.getByLabelText('Disponibilidad'), { target: { value: 'IN_STOCK' } });
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ availability: 'IN_STOCK' }))
    );

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await vi.waitFor(() => expect(mocks.exportBooksCsv).toHaveBeenCalledTimes(1));
    const [params] = mocks.exportBooksCsv.mock.calls[0];
    expect(params).toMatchObject({ availability: 'IN_STOCK' });
    expect(params).not.toHaveProperty('page');
    expect(params).not.toHaveProperty('pageSize');
    await vi.waitFor(() =>
      expect(mocks.triggerCsvDownload).toHaveBeenCalledWith({ blob: expect.anything(), filename: 'libros.csv' })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Exportación completada: libros.csv');
  });

  it('shows the toast when the export fails', async () => {
    mocks.exportBooksCsv.mockRejectedValue(new Error('boom'));
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await vi.waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith('No se pudo exportar el catálogo.')
    );
  });

  it('toggles a sort criterion and stacks criteria with Shift+click', async () => {
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ sort: 'title:asc' }))
    );

    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ sort: 'title:desc' }))
    );

    fireEvent.click(screen.getByRole('button', { name: 'Autor' }), { shiftKey: true });
    await vi.waitFor(() =>
      expect(mocks.listBooks).toBeCalledWith(expect.objectContaining({ sort: 'title:desc,author.name:asc' }))
    );
  });

  it('deletes a book through the confirmation dialog', async () => {
    mocks.deleteBook.mockResolvedValue(undefined);
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar El Aleph' }));
    expect(screen.getByText(/¿Estás seguro de que deseas eliminar/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await vi.waitFor(() => expect(mocks.deleteBook).toHaveBeenCalledWith(1));
    expect(mocks.toast.success).toHaveBeenCalledWith('Libro eliminado correctamente.');
    // The list query cache is invalidated so the deleted book disappears.
    await vi.waitFor(() =>
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['books'] })
    );
    // The dialog closes after settling.
    await vi.waitFor(() => expect(screen.queryByText(/¿Estás seguro/)).toBeNull());
  });

  it('shows the error state with a Reintentar action when loading fails', async () => {
    mocks.listBooks.mockRejectedValueOnce(new Error('boom'));
    renderBooksPage();

    await screen.findByText('No se pudieron cargar los libros.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('El Aleph');
  });

  it('renders the empty state when there are no books', async () => {
    mocks.listBooks.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    renderBooksPage();
    await screen.findByText('No hay libros que coincidan con los filtros.');
    expect(screen.getByText('Aún no hay libros registrados en el catálogo.')).toBeInTheDocument();
  });

  it('hides admin-only actions for OPERADOR but keeps the CSV export', async () => {
    localStorage.clear();
    setSession('tok', { id: 8, email: 'ope@cmpc.libros', fullName: 'Operador', role: { code: 'OPERADOR' } });
    renderBooksPage();
    await screen.findByText('El Aleph');

    expect(screen.queryByRole('link', { name: 'Nuevo libro' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar El Aleph' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  it('clears the active filters with the Limpiar filtros action', async () => {
    renderBooksPage();
    await screen.findByText('El Aleph');

    fireEvent.change(screen.getByLabelText('Disponibilidad'), { target: { value: 'OUT_OF_STOCK' } });
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(expect.objectContaining({ availability: 'OUT_OF_STOCK' }))
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await vi.waitFor(() =>
      expect(mocks.listBooks).toHaveBeenCalledWith(
        expect.objectContaining({ availability: undefined, search: undefined })
      )
    );
  });
});