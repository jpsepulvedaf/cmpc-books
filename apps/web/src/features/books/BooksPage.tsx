import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { useDebounced } from '../../lib/hooks';
import { getSession } from '../../lib/session';
import { formatCLP, availabilityLabel } from '../../lib/format';
import { resolveImageUrl } from '../../lib/media';
import {
  AVAILABILITY_LABELS,
  type Availability,
  type BookListItem,
  type BookSortField,
  type SortCriterion,
} from '../../lib/types';
import {
  deleteBook,
  exportBooksCsv,
  getCatalogBundle,
  listBooks,
  triggerCsvDownload,
} from './api';
import { Badge } from '../../shared/Badge';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { PaginationControl } from '../../shared/PaginationControl';
import { IconDownload, IconEye, IconPlus, IconEdit, IconSearch, IconTrash } from '../../shared/Icons';

const MAX_SORT_CRITERIA = 3;

function sortToString(sorts: SortCriterion[]): string | undefined {
  if (sorts.length === 0) return undefined;
  return sorts.map((criterion) => `${criterion.field}:${criterion.dir}`).join(',');
}

export function BooksPage() {
  const session = getSession();
  const isAdmin = session?.user.role === 'ADMIN';
  const canExport = session?.user.role === 'ADMIN' || session?.user.role === 'OPERADOR';

  // ── Filters / pagination state ────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounced(searchInput, 300);
  const [genreId, setGenreId] = useState<number | undefined>(undefined);
  const [publisherId, setPublisherId] = useState<number | undefined>(undefined);
  const [authorId, setAuthorId] = useState<number | undefined>(undefined);
  const [availability, setAvailability] = useState<Availability | ''>('');
  const [sorts, setSorts] = useState<SortCriterion[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<BookListItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const filtersActive =
    searchTerm.length > 0 || genreId !== undefined || publisherId !== undefined || authorId !== undefined || availability !== '' || sorts.length > 0;

  // ── Catalogs ───────────────────────────────────────────────────────────────
  const catalogs = useQuery({
    queryKey: ['catalogs'],
    queryFn: getCatalogBundle,
    staleTime: 60_000,
  });

  // ── Books query ────────────────────────────────────────────────────────────
  const books = useQuery({
    queryKey: [
      'books',
      {
        search: searchTerm,
        genreId,
        publisherId,
        authorId,
        availability,
        sort: sortToString(sorts),
        page,
        pageSize,
      },
    ],
    queryFn: () =>
      listBooks({
        search: searchTerm.length > 0 ? searchTerm : undefined,
        genreId,
        publisherId,
        authorId,
        availability: availability !== '' ? availability : undefined,
        sort: sortToString(sorts),
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const removeBook = useMutation({
    mutationFn: (id: number) => deleteBook(id),
    onSuccess: () => {
      toast.success('Libro eliminado correctamente.');
      // The soft-deleted book must disappear from the current listing; the
      // list query cache keeps stale data otherwise.
      queryClient.invalidateQueries({ queryKey: ['books'] });
      if (books.data && books.data.items.length === 1 && page > 1) {
        setPage(page - 1);
      }
    },
    onError: (error: ApiError) => {
      toast.error(error.userMessage);
    },
    onSettled: () => {
      setDeleteTarget(null);
    },
  });

  const resetFilters = () => {
    setSearchInput('');
    setGenreId(undefined);
    setPublisherId(undefined);
    setAuthorId(undefined);
    setAvailability('');
    setSorts([]);
    setPage(1);
  };

  const handleSortClick = (field: BookSortField, event: ReactMouseEvent<HTMLButtonElement>) => {
    const multi = event.shiftKey;
    const existingIndex = sorts.findIndex((criterion) => criterion.field === field);
    let next: SortCriterion[];
    if (existingIndex >= 0) {
      next = sorts.map((criterion, index) =>
        index === existingIndex
          ? { field: criterion.field, dir: criterion.dir === 'asc' ? ('desc' as const) : ('asc' as const) }
          : criterion
      );
    } else if (multi) {
      next = [...sorts, { field, dir: 'asc' as const }].slice(0, MAX_SORT_CRITERIA);
    } else {
      next = [{ field, dir: 'asc' as const }];
    }
    setSorts(next);
    setPage(1);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportBooksCsv({
        search: searchTerm.length > 0 ? searchTerm : undefined,
        genreId,
        publisherId,
        authorId,
        availability: availability !== '' ? availability : undefined,
        sort: sortToString(sorts),
      });
      triggerCsvDownload(result);
      toast.success(`Exportación completada: ${result.filename}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.userMessage : 'No se pudo exportar el catálogo.');
    } finally {
      setExporting(false);
    }
  };

  const data = books.data;
  const hasError = books.isError;

  const renderSortableHeader = (field: BookSortField, label: string, right = false) => {
    const criterion = sorts.find((item) => item.field === field);
    const active = criterion !== undefined;
    return (
      <th
        scope="col"
        className={`th-sortable${active ? ' th-sortable--active' : ''}${right ? ' th-sortable--right' : ''}`}
        aria-sort={active ? (criterion!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <button type="button" className="th-sort-btn" onClick={(event) => handleSortClick(field, event)}>
          <span>{label}</span>
          <span className="th-sort-indicator" aria-hidden="true">
            {active ? (criterion!.dir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      removeBook.mutate(deleteTarget.id);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Libros</h2>
          <p className="page-header__subtitle">Catálogo completo de la biblioteca</p>
        </div>
        <div className="page-header__actions">
          {canExport ? (
            <button type="button" className="btn btn--ghost" onClick={handleExport} disabled={exporting}>
              <IconDownload /> {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          ) : null}
          {isAdmin ? (
            <Link to="/libros/nuevo" className="btn btn--primary">
              <IconPlus /> Nuevo libro
            </Link>
          ) : null}
        </div>
      </header>

      <div className="filter-bar card">
        <div className="field filter-bar__search">
          <label className="visually-hidden" htmlFor="book-search">
            Buscar libros
          </label>
          <div className="input-with-icon">
            <IconSearch />
            <input
              id="book-search"
              type="search"
              value={searchInput}
              placeholder="Buscar por título, ISBN o autor…"
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-genre">Género</label>
          <select
            id="filter-genre"
            value={genreId ? String(genreId) : ''}
            onChange={(event) => {
              setGenreId(event.target.value ? Number(event.target.value) : undefined);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {catalogs.data?.genres.map((genre) => (
              <option key={genre.id} value={String(genre.id)}>
                {genre.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-publisher">Editorial</label>
          <select
            id="filter-publisher"
            value={publisherId ? String(publisherId) : ''}
            onChange={(event) => {
              setPublisherId(event.target.value ? Number(event.target.value) : undefined);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {catalogs.data?.publishers.map((publisher) => (
              <option key={publisher.id} value={String(publisher.id)}>
                {publisher.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-author">Autor</label>
          <select
            id="filter-author"
            value={authorId ? String(authorId) : ''}
            onChange={(event) => {
              setAuthorId(event.target.value ? Number(event.target.value) : undefined);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {catalogs.data?.authors.map((author) => (
              <option key={author.id} value={String(author.id)}>
                {author.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-availability">Disponibilidad</label>
          <select
            id="filter-availability"
            value={availability}
            onChange={(event) => {
              setAvailability(event.target.value as Availability | '');
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="IN_STOCK">{AVAILABILITY_LABELS.IN_STOCK}</option>
            <option value="OUT_OF_STOCK">{AVAILABILITY_LABELS.OUT_OF_STOCK}</option>
          </select>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters} disabled={!filtersActive}>
          Limpiar filtros
        </button>
      </div>

      {hasError ? (
        <div className="alert alert--danger" role="alert">
          <p>{books.error instanceof ApiError ? books.error.userMessage : 'No se pudieron cargar los libros.'}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => books.refetch()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!hasError && books.isPending && !books.data ? <LoadingSpinner /> : null}

      {!hasError && books.isFetching && books.data ? (
        <p className="sr-only" role="status">
          Actualizando resultados…
        </p>
      ) : null}

      {!hasError && data && data.items.length === 0 ? (
        <div className="card table-card">
          <EmptyState
            title="No hay libros que coincidan con los filtros."
            description={
              filtersActive
                ? 'Prueba con otros términos de búsqueda o limpiando los filtros aplicados.'
                : 'Aún no hay libros registrados en el catálogo.'
            }
            action={
              filtersActive ? (
                <button type="button" className="btn btn--ghost" onClick={resetFilters}>
                  Limpiar filtros
                </button>
              ) : undefined
            }
          />
        </div>
      ) : null}

      {!hasError && data && data.items.length > 0 ? (
        <div className="card table-card">
          <table className="table">
            <caption className="visually-hidden">Listado de libros del catálogo</caption>
            <thead>
              <tr>
                <th scope="col" className="th-thumb">
                  <span className="visually-hidden">Portada</span>
                </th>
                {renderSortableHeader('title', 'Título')}
                {renderSortableHeader('author.name', 'Autor')}
                {renderSortableHeader('publisher.name', 'Editorial')}
                {renderSortableHeader('genre.name', 'Género')}
                {renderSortableHeader('price', 'Precio', true)}
                {renderSortableHeader('stock', 'Stock', true)}
                {renderSortableHeader('availability', 'Disponibilidad')}
                <th scope="col" className="th-actions">
                  <span className="sort-hint">Orden: clic para ordenar · Mayús+clic para añadir criterio</span>
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((book) => (
                <tr key={book.id}>
                  <td className="td-thumb">
                    {book.imageUrl ? (
                      <img
                        className="book-thumb"
                        src={resolveImageUrl(book.imageUrl)}
                        alt={`Portada de ${book.title}`}
                        loading="lazy"
                      />
                    ) : (
                      <span className="book-thumb book-thumb--empty" aria-hidden="true" />
                    )}
                  </td>
                  <td>
                    <Link to={`/libros/${book.id}`} className="book-title-link">
                      {book.title}
                    </Link>
                    {book.isbn ? <div className="book-isbn">{book.isbn}</div> : null}
                  </td>
                  <td>{book.author.name}</td>
                  <td>{book.publisher.name}</td>
                  <td>{book.genre.name}</td>
                  <td className="td-numeric">{formatCLP(book.price)}</td>
                  <td className="td-numeric">{book.stock}</td>
                  <td>
                    <Badge tone={book.availability === 'IN_STOCK' ? 'success' : 'danger'}>
                      {availabilityLabel(book.availability)}
                    </Badge>
                  </td>
                  <td className="td-actions">
                    <Link
                      to={`/libros/${book.id}`}
                      className="btn btn--ghost btn--icon"
                      aria-label={`Ver detalle de ${book.title}`}
                      title="Ver detalle"
                    >
                      <IconEye />
                    </Link>
                    {isAdmin ? (
                      <>
                        <Link
                          to={`/libros/${book.id}/editar`}
                          className="btn btn--ghost btn--icon"
                          aria-label={`Editar ${book.title}`}
                          title="Editar"
                        >
                          <IconEdit />
                        </Link>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon btn--danger"
                          aria-label={`Eliminar ${book.title}`}
                          title="Eliminar"
                          onClick={() => setDeleteTarget(book)}
                        >
                          <IconTrash />
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <PaginationControl
            page={data.page}
            totalPages={data.totalPages ?? Math.max(1, Math.ceil(data.total / data.pageSize))}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar libro"
        message={
          deleteTarget ? (
            <>
              ¿Estás seguro de que deseas eliminar <strong>{deleteTarget.title}</strong>? Esta acción no se puede deshacer.
            </>
          ) : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}