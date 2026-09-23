import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import { resolveImageUrl } from '../../lib/media';
import { isRole } from '../../lib/session';
import { getFieldError, FieldError, FormAlert, fieldErrorId, FormHint } from '../../shared/Form';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { IconClose, IconPlus } from '../../shared/Icons';
import {
  bookSchemas,
  EMPTY_BOOK_FORM,
  toBookPayload,
  zodField,
  type BookFormValues,
} from '../../lib/validators';
import {
  createBook,
  deleteBookImage,
  getBook,
  getCatalogBundle,
  updateBook,
  uploadBookImage,
} from './api';
import { CatalogCreateModal } from '../catalogs/CatalogCreateModal';
import type { CatalogKind } from '../catalogs/api';
import { queryClient } from '../../lib/queryClient';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

function validateImageFile(file: File): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'La imagen debe ser JPEG, PNG o WebP.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'La imagen no puede superar los 2 MB.';
  }
  return undefined;
}

export function BookFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const params = useParams();
  const isEdit = mode === 'edit';
  const bookId = isEdit ? Number(params.id) : undefined;

  const { register, handleSubmit, formState, setValues } = useForm<BookFormValues>({
    defaultValues: EMPTY_BOOK_FORM,
    mode: 'onTouched',
    shouldUseNativeValidation: false,
  });

  const fieldError = (name: keyof BookFormValues) => getFieldError(formState.errors, name);

  const catalogs = useQuery({ queryKey: ['catalogs'], queryFn: getCatalogBundle, staleTime: 60_000 });

  const bookQuery = useQuery({
    queryKey: ['books', bookId],
    queryFn: () => getBook(Number(bookId)),
    enabled: isEdit && bookId !== undefined && !Number.isNaN(Number(bookId)),
    staleTime: 30_000,
  });

  // ── Image state ────────────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | undefined>(undefined);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [catalogKind, setCatalogKind] = useState<CatalogKind | null>(null);
  const [autoSelectNew, setAutoSelectNew] = useState<{ kind: CatalogKind; id: number } | null>(null);

  // After a catalog entry is created from the inline modal the select should
  // stay on the fresh value. This runs in an effect so RHF sets the value on a
  // stable tree (the modal has already unmounted by then) and the catalog
  // select has been refreshed.
useEffect(() => {
    if (!autoSelectNew) return;
    const field =
      autoSelectNew.kind === 'authors'
        ? 'authorId'
        : autoSelectNew.kind === 'publishers'
          ? 'publisherId'
          : 'genreId';
    const hasEntry =
      autoSelectNew.kind === 'authors'
        ? catalogs.data?.authors.some((a) => a.id === autoSelectNew.id)
        : autoSelectNew.kind === 'publishers'
          ? catalogs.data?.publishers.some((p) => p.id === autoSelectNew.id)
          : catalogs.data?.genres.some((g) => g.id === autoSelectNew.id);
    // Wait for the refreshed bundle to include the created entry before RHF
    // sets the select value (a value without an option would be dropped).
    if (!hasEntry) return;
    setValues(
      { [field]: String(autoSelectNew.id) } as Partial<BookFormValues>,
      { shouldValidate: true, shouldDirty: true, shouldTouch: false },
    );
    setAutoSelectNew(null);
  }, [autoSelectNew, setValues, catalogs.data]);

  const canManageCatalogs = isRole('ADMIN');
  const currentImageUrl = bookQuery.data?.imageUrl;

  // A change the form fields don't track: either a brand-new file picked in
  // the picker or the current cover marked for removal. Selecting an image
  // does not touch any registered RHF field, so `formState.isValid` would
  // otherwise stay `false` (preloaded with shouldValidate:false) and the
  // Save button would never enable from the image alone.
  const hasPendingImageChange = imageFile !== null || removeImage;

  // Effective preview: a just-selected file, else the current cover unless removed.
  const previewSource = imageFile
    ? imageObjectUrl
    : !removeImage && currentImageUrl
      ? resolveImageUrl(currentImageUrl)
      : undefined;

  const handleFileChange = (file: File | undefined) => {
    setImageError(undefined);
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImageFile(file);
    setImageObjectUrl(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  // Preload existing values once when the book loads (edit mode).
  const loadedForId = useRef<number | undefined>(undefined);
  useEffect(() => {
    const book = bookQuery.data;
    if (!book) return;
    if (loadedForId.current === book.id) return;
    loadedForId.current = book.id;
    setValues(
      {
        title: book.title ?? '',
        isbn: book.isbn ?? '',
        description: book.description ?? '',
        price: book.price,
        stock: String(book.stock),
        authorId: String(book.authorId),
        publisherId: String(book.publisherId),
        genreId: String(book.genreId),
      },
      { shouldValidate: false, shouldDirty: false, shouldTouch: false }
    );
  }, [bookQuery.data, setValues]);

  // ── Mutation helpers ───────────────────────────────────────────────────────
  const invalidateBooks = () => {
    queryClient.invalidateQueries({ queryKey: ['books'] });
  };

  const doCreate = async (payload: ReturnType<typeof toBookPayload>) => {
    const book = await createBook(payload);
    if (imageFile) {
      await uploadBookImage(book.id, imageFile);
    }
    invalidateBooks();
    return book;
  };

  const doUpdate = async (id: number, payload: ReturnType<typeof toBookPayload>) => {
    const book = await updateBook(id, payload);
    if (currentImageUrl && removeImage) {
      await deleteBookImage(id);
    } else if (imageFile) {
      await uploadBookImage(id, imageFile);
    }
    invalidateBooks();
    queryClient.invalidateQueries({ queryKey: ['books', id] });
    return book;
  };

  const onSubmit = handleSubmit((values) => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(undefined);
    const payload = toBookPayload(values);
    const run = isEdit
      ? doUpdate(Number(bookId), payload)
      : doCreate(payload);
    run
      .then((book) => {
        toast.success(isEdit ? 'Libro actualizado correctamente.' : 'Libro creado correctamente.');
        navigate(`/libros/${book.id}`);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.userMessage
            : 'No se pudo guardar el libro. Inténtalo de nuevo.';
        setFormError(message);
        toast.error(message);
      })
      .finally(() => setSubmitting(false));
  });

  if (isEdit && bookId === undefined) {
    return (
      <div className="card">
        <p>Libro no encontrado.</p>
      </div>
    );
  }

  return (
    <section className="page">
      <nav className="breadcrumb" aria-label="Ruta de navegación">
        <Link to="/libros">Libros</Link>
        <span aria-hidden="true">/</span>
        <span>{isEdit ? 'Editar libro' : 'Nuevo libro'}</span>
      </nav>

      <header className="page-header">
        <div>
          <h2>{isEdit ? 'Editar libro' : 'Nuevo libro'}</h2>
          <p className="page-header__subtitle">
            {isEdit ? 'Modifica los datos del libro y guarda los cambios.' : 'Completa los datos para registrar un nuevo libro.'}
          </p>
        </div>
      </header>

      {isEdit && bookQuery.isPending ? <LoadingSpinner /> : null}
      {isEdit && bookQuery.isError ? (
        <div className="alert alert--danger" role="alert">
          <p>No se pudo cargar el libro.</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => bookQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {(!isEdit || bookQuery.data) ? (
        <form className="card form form-grid" noValidate onSubmit={onSubmit}>
          <FormAlert message={formError} />

          <div className="field form-grid__full">
            <label htmlFor="book-title">Título *</label>
            <input
              {...register('title', { validate: zodField(bookSchemas.title) })}
              id="book-title"
              type="text"
              maxLength={255}
              placeholder="Título del libro"
              aria-invalid={fieldError('title') ? 'true' : undefined}
              aria-describedby={fieldError('title') ? fieldErrorId('title') : undefined}
            />
            <FieldError name="title" message={fieldError('title')} />
          </div>

          <div className="field form-grid__third">
            <label htmlFor="book-isbn">ISBN (opcional)</label>
            <input
              {...register('isbn', { validate: zodField(bookSchemas.isbn) })}
              id="book-isbn"
              type="text"
              placeholder="10 o 13 dígitos"
              aria-invalid={fieldError('isbn') ? 'true' : undefined}
              aria-describedby={fieldError('isbn') ? fieldErrorId('isbn') : undefined}
            />
            <FieldError name="isbn" message={fieldError('isbn')} />
          </div>

          <div className="field form-grid__third">
            <label htmlFor="book-price">Precio (CLP) *</label>
            <input
              {...register('price', { validate: zodField(bookSchemas.price) })}
              id="book-price"
              type="text"
              inputMode="decimal"
              placeholder="19.900"
              aria-invalid={fieldError('price') ? 'true' : undefined}
              aria-describedby={fieldError('price') ? fieldErrorId('price') : undefined}
            />
            <FieldError name="price" message={fieldError('price')} />
          </div>

          <div className="field form-grid__third">
            <label htmlFor="book-stock">Stock *</label>
            <input
              {...register('stock', { validate: zodField(bookSchemas.stock) })}
              id="book-stock"
              type="text"
              inputMode="numeric"
              placeholder="0"
              aria-invalid={fieldError('stock') ? 'true' : undefined}
              aria-describedby={fieldError('stock') ? fieldErrorId('stock') : undefined}
            />
            <FieldError name="stock" message={fieldError('stock')} />
          </div>

          <div className="field field-with-add form-grid__half">
            <label htmlFor="book-author">Autor *</label>
            <div className="field-add-row">
              <select
                {...register('authorId', { validate: zodField(bookSchemas.authorId) })}
                id="book-author"
                aria-invalid={fieldError('authorId') ? 'true' : undefined}
                aria-describedby={fieldError('authorId') ? fieldErrorId('authorId') : undefined}
              >
                <option value="">Selecciona un autor…</option>
                {catalogs.data?.authors.map((author) => (
                  <option key={author.id} value={String(author.id)}>
                    {author.name}
                  </option>
                ))}
              </select>
              {canManageCatalogs ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-label="Agregar autor"
                  onClick={() => setCatalogKind('authors')}
                >
                  <IconPlus /> Agregar
                </button>
              ) : null}
            </div>
            <FieldError name="authorId" message={fieldError('authorId')} />
          </div>

          <div className="field field-with-add form-grid__half">
            <label htmlFor="book-publisher">Editorial *</label>
            <div className="field-add-row">
              <select
                {...register('publisherId', { validate: zodField(bookSchemas.publisherId) })}
                id="book-publisher"
                aria-invalid={fieldError('publisherId') ? 'true' : undefined}
                aria-describedby={fieldError('publisherId') ? fieldErrorId('publisherId') : undefined}
              >
                <option value="">Selecciona una editorial…</option>
                {catalogs.data?.publishers.map((publisher) => (
                  <option key={publisher.id} value={String(publisher.id)}>
                    {publisher.name}
                  </option>
                ))}
              </select>
              {canManageCatalogs ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-label="Agregar editorial"
                  onClick={() => setCatalogKind('publishers')}
                >
                  <IconPlus /> Agregar
                </button>
              ) : null}
            </div>
            <FieldError name="publisherId" message={fieldError('publisherId')} />
          </div>

          <div className="field field-with-add form-grid__full">
            <label htmlFor="book-genre">Género *</label>
            <div className="field-add-row">
              <select
                {...register('genreId', { validate: zodField(bookSchemas.genreId) })}
                id="book-genre"
                aria-invalid={fieldError('genreId') ? 'true' : undefined}
                aria-describedby={fieldError('genreId') ? fieldErrorId('genreId') : undefined}
              >
                <option value="">Selecciona un género…</option>
                {catalogs.data?.genres.map((genre) => (
                  <option key={genre.id} value={String(genre.id)}>
                    {genre.name}
                  </option>
                ))}
              </select>
              {canManageCatalogs ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-label="Agregar género"
                  onClick={() => setCatalogKind('genres')}
                >
                  <IconPlus /> Agregar
                </button>
              ) : null}
            </div>
            <FieldError name="genreId" message={fieldError('genreId')} />
          </div>

          <div className="field form-grid__full">
            <label htmlFor="book-description">Descripción</label>
            <textarea
              {...register('description', { validate: zodField(bookSchemas.description) })}
              id="book-description"
              rows={4}
              maxLength={2000}
              placeholder="Descripción del libro (opcional)"
              aria-invalid={fieldError('description') ? 'true' : undefined}
              aria-describedby={fieldError('description') ? fieldErrorId('description') : undefined}
            />
            <FieldError name="description" message={fieldError('description')} />
          </div>

          <div className="field form-grid__full">
            <span className="field-label" id="book-cover-label">
              Portada
            </span>
            <div className="cover-zone" id="book-cover-zone">
              {previewSource ? (
                <img
                  className="cover-preview"
                  src={previewSource}
                  alt={imageFile ? 'Vista previa de la nueva portada' : 'Portada actual del libro'}
                />
              ) : (
                <div className="cover-placeholder" aria-hidden="true">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="4" y="5" width="7" height="15" rx="2" />
                    <rect x="13" y="3" width="7" height="17" rx="2" />
                  </svg>
                  <span>Sin portada</span>
                </div>
              )}
              <div className="cover-actions">
                <label className="btn btn--ghost btn--sm">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="visually-hidden"
                    aria-labelledby="book-cover-label"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      handleFileChange(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                  {imageFile ? 'Reemplazar portada' : 'Subir portada'}
                </label>
                {previewSource ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => {
                      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
                      setImageFile(null);
                      setImageObjectUrl(undefined);
                      setRemoveImage(true);
                      setImageError(undefined);
                    }}
                  >
                    <IconClose /> Quitar imagen
                  </button>
                ) : null}
              </div>
              {imageError ? <p className="field-error">{imageError}</p> : null}
              <FormHint>JPEG, PNG o WebP con un tamaño máximo de 2 MB.</FormHint>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/libros')}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={(!formState.isValid && !hasPendingImageChange) || submitting}
            >
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      ) : null}

      {catalogKind ? (
        <CatalogCreateModal
          open
          kind={catalogKind}
          onClose={() => setCatalogKind(null)}
          onCreated={(item) => {
            // Refresh the catalog bundle; the effect then selects the novel id.
            queryClient.invalidateQueries({ queryKey: ['catalogs'] });
            setAutoSelectNew({ kind: catalogKind!, id: item.id });
          }}
        />
      ) : null}
    </section>
  );
}