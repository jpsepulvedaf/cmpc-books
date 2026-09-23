// Create-only modal for catalog entries (authors, publishers, genres) launched
// from the book form. It is deliberately minimal: it never lists or deletes —
// those live in the maintainer pages (CatalogCrudPage). On success it notifies
// through `onCreated` so the caller can refresh the catalog selects; the parent
// decides the cache invalidation.

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import type { CatalogItem } from '../../lib/types';
import { catalogNameSchema, zodField } from '../../lib/validators';
import { FieldError, FormAlert, fieldErrorId, getFieldError } from '../../shared/Form';
import { IconClose } from '../../shared/Icons';
import { catalogGroups, type CatalogKind } from './api';

interface CreateCopy {
  title: string;
  label: string;
  placeholder: string;
  createMessage: string;
}

const KIND_COPY: Record<CatalogKind, CreateCopy> = {
  authors: {
    title: 'Nuevo autor',
    label: 'Nombre',
    placeholder: 'Nombre del autor',
    createMessage: 'Autor creado correctamente.',
  },
  publishers: {
    title: 'Nueva editorial',
    label: 'Nombre',
    placeholder: 'Nombre de la editorial',
    createMessage: 'Editorial creada correctamente.',
  },
  genres: {
    title: 'Nuevo género',
    label: 'Nombre',
    placeholder: 'Nombre del género',
    createMessage: 'Género creado correctamente.',
  },
};

export interface CatalogCreateModalProps {
  open: boolean;
  kind: CatalogKind;
  onClose: () => void;
  /** Called with the freshly-created catalog entry so the parent can select it. */
  onCreated?: (item: CatalogItem) => void;
}

export function CatalogCreateModal({ open, kind, onClose, onCreated }: CatalogCreateModalProps) {
  const copy = KIND_COPY[kind];
  const group = catalogGroups[kind];

  // All hooks run unconditionally (the early return below only affects markup).
  const { register, handleSubmit, formState, setValues } = useForm<{ name: string }>({
    defaultValues: { name: '' },
    mode: 'onTouched',
    shouldUseNativeValidation: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>(undefined);
  const wasOpen = useRef(open);
  const lastKind = useRef(kind);

  // Fresh form each time the dialog opens (or the kind switches while open).
  useEffect(() => {
    if (open && (kind !== lastKind.current || !wasOpen.current)) {
      setValues({ name: '' }, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
      setApiError(undefined);
      setSubmitting(false);
    }
    wasOpen.current = open;
    lastKind.current = kind;
  }, [open, kind, setValues]);

  // Close with Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const fieldError = getFieldError(formState.errors, 'name');
  const inputId = 'catalog-create-name';

  const onSubmit = handleSubmit((values) => {
    if (submitting) return;
    setSubmitting(true);
    setApiError(undefined);
    group
      .create(values.name.trim())
      .then((item: CatalogItem) => {
        toast.success(copy.createMessage);
        onCreated?.(item);
        onClose();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.userMessage
            : 'No se pudo crear el registro. Inténtalo de nuevo.';
        setApiError(message);
        toast.error(message);
      })
      .finally(() => setSubmitting(false));
  });

  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-create-title"
      >
        <button type="button" className="dialog__close" aria-label="Cerrar" onClick={onClose}>
          <IconClose />
        </button>
        <h3 id="catalog-create-title" className="dialog__title">
          {copy.title}
        </h3>
        <form className="form" noValidate onSubmit={onSubmit}>
          <FormAlert message={apiError} />
          <div className="field">
            <label htmlFor={inputId}>{copy.label}</label>
            <input
              {...register('name', { validate: zodField(catalogNameSchema) })}
              id={inputId}
              type="text"
              placeholder={copy.placeholder}
              autoFocus
              aria-invalid={fieldError ? 'true' : undefined}
              aria-describedby={fieldError ? fieldErrorId('name') : undefined}
            />
            <FieldError name="name" message={fieldError} />
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!formState.isValid || submitting}
            >
              {submitting ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}