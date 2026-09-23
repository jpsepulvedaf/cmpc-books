// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setSession } from '../../lib/session';
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
  catalogGroups: {
    authors: { create: vi.fn() },
    publishers: { create: vi.fn() },
    genres: { create: vi.fn() },
  },
}));

vi.mock('./api', () => ({
  createBook: mocks.createBook,
  updateBook: mocks.updateBook,
  getBook: mocks.getBook,
  getCatalogBundle: mocks.getCatalogBundle,
  uploadBookImage: mocks.uploadBookImage,
  deleteBookImage: mocks.deleteBookImage,
}));

// The catalog create modal (features/catalogs) uses this module; only the
// create path is exercised from the book form.
vi.mock('../catalogs/api', () => ({
  catalogGroups: mocks.catalogGroups,
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
  mocks.catalogGroups.authors.create.mockResolvedValue({ id: 7, name: 'Gabriel García Márquez' });
  mocks.catalogGroups.publishers.create.mockResolvedValue({ id: 8, name: 'Anagrama' });
  mocks.catalogGroups.genres.create.mockResolvedValue({ id: 9, name: 'Poesía' });
  // jsdom does not implement object-URL helpers used by the cover preview.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

  it('enables Guardar when only a new cover is picked (no other field touched)', async () => {
    mocks.getBook.mockResolvedValue({ ...bookDetail, imageUrl: null });
    mocks.updateBook.mockResolvedValue({ ...bookDetail, imageUrl: '/uploads/books/nueva.webp' });
    mocks.uploadBookImage.mockResolvedValue(undefined);
    mocks.params = { id: '9' };
    renderForm('edit');
    await waitFor(() => expect(screen.getByLabelText('Título *')).toHaveValue('El Aleph'));

    // Initially the Save button is disabled: no form fields have changed yet
    // and no image has been picked (RHF preloads with shouldValidate: false).
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

    // Pick ONLY a new cover — this must be enough to enable Save, since an
    // image change is not a registered RHF field and isValid stays false.
    const file = new File(['fake-webp'], 'portada.webp', { type: 'image/webp' });
    fireEvent.change(screen.getByLabelText('Portada').closest('label')!.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(screen.getByAltText('Vista previa de la nueva portada')).toBeInTheDocument();
  });
});

describe('BookFormPage (inline catalog creation)', () => {
  it('shows the Agregar buttons next to the catalog selects for ADMIN sessions', async () => {
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderForm();
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });

    expect(screen.getByRole('button', { name: 'Agregar autor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar editorial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar género' })).toBeInTheDocument();
    // The buttons must not submit the book form.
    for (const name of ['Agregar autor', 'Agregar editorial', 'Agregar género']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('type', 'button');
    }
  });

  it.each<'OPERADOR' | 'CONSULTA'>(['OPERADOR', 'CONSULTA'])(
    'does not show the Agregar buttons for %s sessions',
    async (role) => {
      setSession('tok', { id: 2, email: 'operador@cmpc.libros', role: { code: role } });
      renderForm();
      await screen.findByRole('option', { name: 'Jorge Luis Borges' });

      expect(screen.queryByRole('button', { name: 'Agregar autor' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Agregar editorial' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Agregar género' })).toBeNull();
    }
  );

  it.each<[string, string]>([
    ['Agregar autor', 'Nuevo autor'],
    ['Agregar editorial', 'Nueva editorial'],
    ['Agregar género', 'Nuevo género'],
  ])('opens the catalog modal with the right title from %s', async (buttonName, title) => {
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderForm();
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });

  it('creates an author, toasts, refreshes the catalogs and closes the modal', async () => {
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderForm();
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });

    fireEvent.click(screen.getByRole('button', { name: 'Agregar autor' }));
    const nameInput = screen.getByLabelText('Nombre');
    fireEvent.change(nameInput, { target: { value: 'Gabriel García Márquez' } });
    fireEvent.blur(nameInput);
    const createButton = screen.getByRole('button', { name: 'Crear' });
    await waitFor(() => expect(createButton).not.toBeDisabled());
    createButton.click();

    await vi.waitFor(() =>
      expect(mocks.catalogGroups.authors.create).toHaveBeenCalledWith('Gabriel García Márquez')
    );
    await vi.waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith('Autor creado correctamente.')
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['catalogs'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the typed book form values while creating a catalog entry', async () => {
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderForm();
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });

    const titleInput = screen.getByLabelText('Título *');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Cien años de soledad' } });
    fireEvent.blur(titleInput);
    fireEvent.focusOut(titleInput);
    const authorSelect = screen.getByLabelText('Autor *');
    fireEvent.change(authorSelect, { target: { value: '1' } });
    fireEvent.blur(authorSelect);
    fireEvent.focusOut(authorSelect);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar autor' }));
    const nameInput = screen.getByLabelText('Nombre');
    fireEvent.change(nameInput, { target: { value: 'Mario Vargas Llosa' } });
    fireEvent.blur(nameInput);
    const createButton = screen.getByRole('button', { name: 'Crear' });
    await waitFor(() => expect(createButton).not.toBeDisabled());
    createButton.click();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The book form stayed mounted under the overlay with its values intact.
    expect(screen.getByLabelText('Título *')).toHaveValue('Cien años de soledad');
    expect(screen.getByLabelText('Autor *')).toHaveValue('1');
  });

  it('does not submit the book form when pressing Enter inside the modal', async () => {
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderForm();
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'El Aleph' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar autor' }));

    // The dialog is rendered OUTSIDE the book <form> (sibling overlay), so an
    // Enter keypress inside it can only reach the modal's own form.
    expect(screen.getByRole('dialog').closest('form')).toBeNull();

    const nameInput = screen.getByLabelText('Nombre');
    fireEvent.change(nameInput, { target: { value: 'Julio Cortázar' } });
    fireEvent.blur(nameInput);

    // jsdom does not implicitly submit on Enter, so submit the modal's own
    // form explicitly: the point is that an Enter inside the modal can only
    // reach THIS form, never the book <form> (createBook stays untouched).
    fireEvent.keyDown(nameInput, { key: 'Enter', keyCode: 13 });
    const modalForm = nameInput.closest('form');
    expect(modalForm).not.toBeNull();
    fireEvent.submit(modalForm!);

    await vi.waitFor(() =>
      expect(mocks.catalogGroups.authors.create).toHaveBeenCalledWith('Julio Cortázar')
    );
    expect(mocks.createBook).not.toHaveBeenCalled();
  });

  it('closes the modal with Escape', async () => {
    setSession('tok', { id: 1, email: 'admin@cmpc.libros', role: { code: 'ADMIN' } });
    renderForm();
    await screen.findByRole('option', { name: 'Jorge Luis Borges' });

    fireEvent.click(screen.getByRole('button', { name: 'Agregar editorial' }));
    expect(screen.getByRole('heading', { name: 'Nueva editorial' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});