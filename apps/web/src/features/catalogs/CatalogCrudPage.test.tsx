// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { CatalogCrudPage } from './CatalogCrudPage';
import type { CatalogKind } from './api';

const mocks = vi.hoisted(() => ({
  listAuthors: vi.fn(),
  createAuthor: vi.fn(),
  updateAuthor: vi.fn(),
  deleteAuthor: vi.fn(),
  listPublishers: vi.fn(),
  createPublisher: vi.fn(),
  updatePublisher: vi.fn(),
  deletePublisher: vi.fn(),
  listGenres: vi.fn(),
  createGenre: vi.fn(),
  updateGenre: vi.fn(),
  deleteGenre: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./api', () => ({
  catalogGroups: {
    authors: {
      list: mocks.listAuthors,
      create: mocks.createAuthor,
      update: mocks.updateAuthor,
      delete: mocks.deleteAuthor,
    },
    publishers: {
      list: mocks.listPublishers,
      create: mocks.createPublisher,
      update: mocks.updatePublisher,
      delete: mocks.deletePublisher,
    },
    genres: {
      list: mocks.listGenres,
      create: mocks.createGenre,
      update: mocks.updateGenre,
      delete: mocks.deleteGenre,
    },
  },
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));

const authors = [
  { id: 1, name: 'Jorge Luis Borges' },
  { id: 2, name: 'Pablo Neruda' },
];

const LIST_MOCKS: Record<CatalogKind, ReturnType<typeof vi.fn>> = {
  authors: mocks.listAuthors,
  publishers: mocks.listPublishers,
  genres: mocks.listGenres,
};

const CREATE_MOCKS: Record<CatalogKind, ReturnType<typeof vi.fn>> = {
  authors: mocks.createAuthor,
  publishers: mocks.createPublisher,
  genres: mocks.createGenre,
};

function renderPage(kind: CatalogKind) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CatalogCrudPage kind={kind} />
    </QueryClientProvider>
  );
}

const catalogInUseError = new ApiError({
  code: 'CATALOG_IN_USE',
  status: 409,
  userMessage: 'No se puede eliminar: hay libros asociados a este registro.',
});

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CatalogCrudPage', () => {
  it('renders authors with a Spanish title, subtitle and rows', async () => {
    mocks.listAuthors.mockResolvedValue(authors);
    renderPage('authors');

    expect(await screen.findByText('Jorge Luis Borges')).toBeInTheDocument();
    expect(screen.getByText('Pablo Neruda')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Autores' })).toBeInTheDocument();
    expect(screen.getByText('Mantenedor de autores — administra el catálogo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo autor' })).toBeInTheDocument();
  });

  it.each([
    ['publishers', 'Editoriales', 'Nueva editorial', 'Mantenedor de editoriales — administra el catálogo', 'Alianza Editorial', 'Editorial creada correctamente.'],
    ['genres', 'Géneros', 'Nuevo género', 'Mantenedor de géneros — administra el catálogo', 'Ficción', 'Género creado correctamente.'],
  ] as const)('renders and creates %s with Spanish labels', async (kind, heading, newButton, subtitle, itemName, createdMessage) => {
    LIST_MOCKS[kind].mockResolvedValue([{ id: 1, name: itemName }]);
    CREATE_MOCKS[kind].mockResolvedValue({ id: 99, name: itemName });
    renderPage(kind);

    expect(await screen.findByText(itemName)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(subtitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: newButton })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: newButton }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: itemName } });
    fireEvent.blur(screen.getByLabelText('Nombre'));
    const submit = screen.getByRole('button', { name: 'Guardar' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    submit.click();

    await vi.waitFor(() => expect(CREATE_MOCKS[kind]).toHaveBeenCalledWith(itemName));
    expect(mocks.toast.success).toHaveBeenCalledWith(createdMessage);
  });

  it('creates a catalog item trimming the name and shows a success toast', async () => {
    mocks.listAuthors.mockResolvedValue(authors);
    mocks.createAuthor.mockResolvedValue({ id: 3, name: 'Gabriel García Márquez' });
    renderPage('authors');
    await screen.findByText('Jorge Luis Borges');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo autor' }));
    const input = screen.getByLabelText('Nombre');
    fireEvent.change(input, { target: { value: '  Gabriel García Márquez  ' } });
    fireEvent.blur(input);
    const submit = screen.getByRole('button', { name: 'Guardar' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    submit.click();

    await vi.waitFor(() => expect(mocks.createAuthor).toHaveBeenCalledWith('Gabriel García Márquez'));
    expect(mocks.toast.success).toHaveBeenCalledWith('Autor creado correctamente.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull());
  });

  it('preloads the name when editing and updates via PATCH', async () => {
    mocks.listAuthors.mockResolvedValue(authors);
    mocks.updateAuthor.mockResolvedValue({ id: 1, name: 'Jorge Luis Borges' });
    renderPage('authors');
    await screen.findByText('Jorge Luis Borges');

    fireEvent.click(screen.getByRole('button', { name: 'Editar Jorge Luis Borges' }));
    const input = screen.getByLabelText('Nombre');
    expect(input).toHaveValue('Jorge Luis Borges');

    fireEvent.change(input, { target: { value: 'Jorge Luis Borges' } });
    fireEvent.blur(input);
    const submit = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    submit.click();

    await vi.waitFor(() =>
      expect(mocks.updateAuthor).toHaveBeenCalledWith(1, 'Jorge Luis Borges')
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Autor actualizado correctamente.');
  });

  it('closes the edit form when switching to another maintainer (kind change resets state)', async () => {
    // A real navigation from /autores to /generos reuses the SAME component
    // instance but with a different `kind`; the open edit form must not leak.
    mocks.listAuthors.mockResolvedValue(authors);
    mocks.listGenres.mockResolvedValue([{ id: 1, name: 'Ficción' }]);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rerender = render(
      <QueryClientProvider client={client}>
        <CatalogCrudPage kind="authors" />
      </QueryClientProvider>
    );
    await screen.findByText('Jorge Luis Borges');
    fireEvent.click(screen.getByRole('button', { name: 'Editar Jorge Luis Borges' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Jorge Luis Borges');

    // Simulate navigating to another maintainer route (same component, new kind).
    rerender.rerender(
      <QueryClientProvider client={client}>
        <CatalogCrudPage kind="genres" />
      </QueryClientProvider>
    );

    await screen.findByText('Ficción');
    expect(screen.getByRole('heading', { name: 'Géneros' })).toBeInTheDocument();
    // The edit form of the author must be closed, not carried over.
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Editar el autor/ })).toBeNull();
  });

  it('deletes an item after confirming in the dialog', async () => {
    mocks.listAuthors.mockResolvedValue(authors);
    mocks.deleteAuthor.mockResolvedValue(undefined);
    renderPage('authors');
    await screen.findByText('Jorge Luis Borges');

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Eliminar autor')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/¿Estás seguro de que deseas eliminar el autor/)
    ).toBeInTheDocument();

    within(dialog).getByRole('button', { name: 'Eliminar' }).click();

    await vi.waitFor(() => expect(mocks.deleteAuthor).toHaveBeenCalledWith(1));
    expect(mocks.toast.success).toHaveBeenCalledWith('Autor eliminado correctamente.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows the translated error toast when deleting a catalog item in use (409 CATALOG_IN_USE)', async () => {
    mocks.listAuthors.mockResolvedValue(authors);
    mocks.deleteAuthor.mockRejectedValue(catalogInUseError);
    renderPage('authors');
    await screen.findByText('Jorge Luis Borges');

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }).click();

    await vi.waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        'No se puede eliminar: hay libros asociados a este registro.'
      )
    );
    // The dialog closes even when the request fails (onSettled).
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Jorge Luis Borges')).toBeInTheDocument();
  });

  it('shows an empty state when the catalog has no items', async () => {
    mocks.listAuthors.mockResolvedValue([]);
    renderPage('authors');

    expect(await screen.findByText('Aún no hay autores registrados.')).toBeInTheDocument();
    expect(screen.getByText('Crea el primero con el botón «Nuevo autor».')).toBeInTheDocument();
  });

  it('shows a load error with a Reintentar button that refetches', async () => {
    mocks.listAuthors.mockRejectedValueOnce(
      new ApiError({ code: 'INTERNAL_ERROR', status: 500, userMessage: 'Error del servidor. Inténtalo de nuevo.' })
    );
    mocks.listAuthors.mockResolvedValue(authors);
    renderPage('authors');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error del servidor. Inténtalo de nuevo.'
    );
    screen.getByRole('button', { name: 'Reintentar' }).click();

    expect(await screen.findByText('Jorge Luis Borges')).toBeInTheDocument();
    expect(mocks.listAuthors).toHaveBeenCalledTimes(2);
  });
});