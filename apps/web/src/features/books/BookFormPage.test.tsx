// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BookFormPage } from './BookFormPage';

const mocks = vi.hoisted(() => ({
  createBook: vi.fn(),
  updateBook: vi.fn(),
  getBook: vi.fn(),
  getCatalogBundle: vi.fn(),
  uploadBookImage: vi.fn(),
  deleteBookImage: vi.fn(),
  navigate: vi.fn(),
  invalidateQueries: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  params: {} as Record<string, string>,
}));

vi.mock('./api', () => ({
  createBook: mocks.createBook,
  updateBook: mocks.updateBook,
  getBook: mocks.getBook,
  getCatalogBundle: mocks.getCatalogBundle,
  uploadBookImage: mocks.uploadBookImage,
  deleteBookImage: mocks.deleteBookImage,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: mocks.invalidateQueries } }));
vi.mock('sonner', () => ({ toast: mocks.toast }));

const catalog = {
  genres: [{ id: 2, name: 'Ficción' }],
  authors: [{ id: 1, name: 'Jorge Luis Borges' }],
  publishers: [{ id: 1, name: 'Alianza' }],
};

const bookDetail = {
  id: 9,
  isbn: '978-3-16-148410-0',
  title: 'El Aleph',
  description: 'Una colección de relatos.',
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

function renderForm(mode: 'create' | 'edit' = 'create') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookFormPage mode={mode} />
    </QueryClientProvider>
  );
}

function submitForm() {
  const form = screen.getByText('Guardar').closest('form');
  if (!form) throw new Error('form not found');
  fireEvent.submit(form);
}

function fillValidValues() {
  // react-hook-form in onTouched mode validates fields on blur, so we mimic a
  // real user: type into a field and move focus away.
  const fields: [string, string][] = [
    ['Título *', 'El Aleph'],
    ['ISBN (opcional)', '978-3-16-148410-0'],
    ['Precio (CLP) *', '19900'],
    ['Stock *', '12'],
    ['Autor *', '1'],
    ['Editorial *', '1'],
    ['Género *', '2'],
  ];
  for (const [label, value] of fields) {
    const input = screen.getByLabelText(label);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    fireEvent.focusOut(input);
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.params = {};
  mocks.getCatalogBundle.mockResolvedValue(catalog);
});

afterEach(() => {
  cleanup();
});

describe('BookFormPage (create)', () => {
  it('shows the Spanish heading and required messages on submit', async () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Nuevo libro' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: '' } });
    submitForm();

    await screen.findByText('El título es obligatorio');
    expect(mocks.createBook).not.toHaveBeenCalled();
  });

  it('rejects an invalid (zero) price', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Cuentos' } });
    fireEvent.change(screen.getByLabelText('Precio (CLP) *'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Autor *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Editorial *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Género *'), { target: { value: '2' } });
    submitForm();

    await screen.findByText('Ingresa un precio mayor que 0 con hasta 2 decimales');
    expect(mocks.createBook).not.toHaveBeenCalled();
  });

  it('submits a valid form calling create with the exact payload and no availability', async () => {
    mocks.createBook.mockResolvedValue({ ...bookDetail, id: 99 });
    renderForm();
    // Wait for the catalog selects to be populated before filling the form
    // (a real user can only pick from the loaded options).
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });
    fillValidValues();
    submitForm(); // pressing Enter runs handleSubmit → reactive validation → create

    await vi.waitFor(() =>
      expect(mocks.createBook).toHaveBeenCalledWith({
        title: 'El Aleph',
        isbn: '978-3-16-148410-0',
        description: null,
        price: '19900',
        stock: 12,
        authorId: 1,
        publisherId: 1,
        genreId: 2,
      })
    );
    expect(mocks.createBook).not.toHaveBeenCalledWith(expect.objectContaining({ availability: expect.anything() }));
    expect(mocks.toast.success).toHaveBeenCalledWith('Libro creado correctamente.');
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/libros/99'));
  });
});

describe('BookFormPage (edit)', () => {
  it('preloads the existing book values', async () => {
    mocks.getBook.mockResolvedValue(bookDetail);
    mocks.params = { id: '9' };
    renderForm('edit');

    await waitFor(() => expect(mocks.getBook).toHaveBeenCalledWith(9));
    expect(screen.getByRole('heading', { name: 'Editar libro' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Título *')).toHaveValue('El Aleph'));
    expect(screen.getByLabelText('Precio (CLP) *')).toHaveValue('19900');
    expect(screen.getByLabelText('Stock *')).toHaveValue('12');
    expect(screen.getByLabelText('Autor *')).toHaveValue('1');
    expect(screen.getByLabelText('ISBN (opcional)')).toHaveValue('978-3-16-148410-0');
  });

  it('updates the book with the edited payload on submit', async () => {
    mocks.getBook.mockResolvedValue(bookDetail);
    mocks.updateBook.mockResolvedValue({ ...bookDetail, price: '24900' });
    mocks.params = { id: '9' };
    renderForm('edit');
    await waitFor(() => expect(screen.getByLabelText('Título *')).toHaveValue('El Aleph'));

    fireEvent.change(screen.getByLabelText('Precio (CLP) *'), { target: { value: '24900' } });
    fireEvent.blur(screen.getByLabelText('Precio (CLP) *'));
    submitForm();

    await vi.waitFor(() =>
      expect(mocks.updateBook).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ title: 'El Aleph', price: '24900', stock: 12 })
      )
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Libro actualizado correctamente.');
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/libros/9'));
  });
});