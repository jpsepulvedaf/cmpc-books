// Single parameterized CRUD page for the catalog maintainers (authors,
// publishers, genres). One component drives the three routes; the per-kind
// labels and API grouping come from KIND_CONFIG and catalogGroups.

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import type { CatalogItem } from '../../lib/types';
import { catalogNameSchema, zodField } from '../../lib/validators';
import { catalogGroups, type CatalogKind } from './api';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { FieldError, FormAlert, fieldErrorId, getFieldError } from '../../shared/Form';
import { IconEdit, IconPlus } from '../../shared/Icons';

interface KindConfig {
  label: string;
  singular: string;
  article: string;
  newButtonLabel: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  createMessage: string;
  updateMessage: string;
  deleteMessage: string;
  deleteDialogTitle: string;
  deletePrompt: (name: string) => ReactNode;
}

const KIND_CONFIG: Record<CatalogKind, KindConfig> = {
  authors: {
    label: 'Autores',
    singular: 'autor',
    article: 'el',
    newButtonLabel: 'Nuevo autor',
    subtitle: 'Mantenedor de autores — administra el catálogo',
    emptyTitle: 'Aún no hay autores registrados.',
    emptyDescription: 'Crea el primero con el botón «Nuevo autor».',
    createMessage: 'Autor creado correctamente.',
    updateMessage: 'Autor actualizado correctamente.',
    deleteMessage: 'Autor eliminado correctamente.',
    deleteDialogTitle: 'Eliminar autor',
    deletePrompt: (name) => (
      <>
        ¿Estás seguro de que deseas eliminar el autor <strong>{name}</strong>? Esta acción no se puede
        deshacer.
      </>
    ),
  },
  publishers: {
    label: 'Editoriales',
    singular: 'editorial',
    article: 'la',
    newButtonLabel: 'Nueva editorial',
    subtitle: 'Mantenedor de editoriales — administra el catálogo',
    emptyTitle: 'Aún no hay editoriales registradas.',
    emptyDescription: 'Crea la primera con el botón «Nueva editorial».',
    createMessage: 'Editorial creada correctamente.',
    updateMessage: 'Editorial actualizada correctamente.',
    deleteMessage: 'Editorial eliminada correctamente.',
    deleteDialogTitle: 'Eliminar editorial',
    deletePrompt: (name) => (
      <>
        ¿Estás seguro de que deseas eliminar la editorial <strong>{name}</strong>? Esta acción no se
        puede deshacer.
      </>
    ),
  },
  genres: {
    label: 'Géneros',
    singular: 'género',
    article: 'el',
    newButtonLabel: 'Nuevo género',
    subtitle: 'Mantenedor de géneros — administra el catálogo',
    emptyTitle: 'Aún no hay géneros registrados.',
    emptyDescription: 'Crea el primero con el botón «Nuevo género».',
    createMessage: 'Género creado correctamente.',
    updateMessage: 'Género actualizado correctamente.',
    deleteMessage: 'Género eliminado correctamente.',
    deleteDialogTitle: 'Eliminar género',
    deletePrompt: (name) => (
      <>
        ¿Estás seguro de que deseas eliminar el género <strong>{name}</strong>? Esta acción no se
        puede deshacer.
      </>
    ),
  },
};

export function CatalogCrudPage({ kind }: { kind: CatalogKind }) {
  const config = KIND_CONFIG[kind];
  const group = catalogGroups[kind];

  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<CatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);

  const items = useQuery({
    queryKey: ['catalogs', kind],
    queryFn: () => group.list(),
  });

  const remove = useMutation({
    mutationFn: (id: number) => group.delete(id),
    onSuccess: () => toast.success(config.deleteMessage),
    onError: (error: ApiError) => toast.error(error.userMessage),
    onSettled: () => {
      setDeleteTarget(null);
      invalidateCatalogs(kind);
    },
  });

  const data = items.data;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>{config.label}</h2>
          <p className="page-header__subtitle">{config.subtitle}</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn--primary"
            aria-expanded={showNew}
            onClick={() => {
              setShowNew((open) => !open);
              setEditTarget(null);
            }}
          >
            <IconPlus /> {config.newButtonLabel}
          </button>
        </div>
      </header>

      {showNew ? <CatalogForm kind={kind} onDone={() => setShowNew(false)} /> : null}
      {editTarget ? (
        <CatalogForm kind={kind} initial={editTarget} onDone={() => setEditTarget(null)} />
      ) : null}

      {items.isError ? (
        <div className="alert alert--danger" role="alert">
          <p>
            {items.error instanceof ApiError
              ? items.error.userMessage
              : 'No se pudieron cargar los registros.'}
          </p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => items.refetch()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!items.isError && items.isPending && !data ? <LoadingSpinner /> : null}

      {!items.isError && data && data.length === 0 ? (
        <div className="card table-card">
          <EmptyState title={config.emptyTitle} description={config.emptyDescription} />
        </div>
      ) : null}

      {!items.isError && data && data.length > 0 ? (
        <div className="card table-card">
          <table className="table">
            <caption className="visually-hidden">
              Listado de {config.label.toLowerCase()} del catálogo
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col" className="th-actions">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="td-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-label={`Editar ${item.name}`}
                      onClick={() => {
                        setEditTarget(item);
                        setShowNew(false);
                      }}
                    >
                      <IconEdit /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger"
                      title={`Eliminar ${item.name}`}
                      disabled={remove.isPending}
                      onClick={() => setDeleteTarget(item)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={config.deleteDialogTitle}
        message={deleteTarget ? config.deletePrompt(deleteTarget.name) : undefined}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

type CatalogFormValues = { name: string };

function CatalogForm({ kind, initial, onDone }: { kind: CatalogKind; initial?: CatalogItem; onDone: () => void }) {
  const config = KIND_CONFIG[kind];
  const group = catalogGroups[kind];
  const isEdit = initial !== undefined;

  const { register, handleSubmit, formState, setValues } = useForm<CatalogFormValues>({
    defaultValues: { name: initial?.name ?? '' },
    mode: 'onTouched',
    shouldUseNativeValidation: false,
  });

  // Keep the fields in sync when switching between edit targets (the form is
  // recreated on each edit click, so this is mostly a guard).
  useEffect(() => {
    setValues({ name: initial?.name ?? '' }, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
  }, [initial, setValues]);

  const mutation = useMutation({
    mutationFn: (values: CatalogFormValues) =>
      initial
        ? group.update(initial.id, values.name.trim())
        : group.create(values.name.trim()),
    onSuccess: () => {
      toast.success(isEdit ? config.updateMessage : config.createMessage);
      invalidateCatalogs(kind);
      onDone();
    },
  });

  const apiMessage = mutation.error ? (mutation.error as ApiError).userMessage : undefined;
  const onSubmit = handleSubmit((values) => mutation.mutate(values));
  const inputId = isEdit ? 'edit-catalog-name' : 'new-catalog-name';
  const fieldError = getFieldError(formState.errors, 'name');

  return (
    <form className="card form" noValidate onSubmit={onSubmit}>
      <FormAlert message={apiMessage} />
      <h3 className="form-title">
        {initial
          ? `Editar ${config.article} ${config.singular} — ${initial.name}`
          : config.newButtonLabel}
      </h3>

      <div className="field">
        <label htmlFor={inputId}>Nombre</label>
        <input
          {...register('name', { validate: zodField(catalogNameSchema) })}
          id={inputId}
          type="text"
          placeholder="Nombre"
          aria-invalid={fieldError ? 'true' : undefined}
          aria-describedby={fieldError ? fieldErrorId('name') : undefined}
        />
        <FieldError name="name" message={fieldError} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!formState.isValid || mutation.isPending}
        >
          {mutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

/** Shared by the page and the inline form to refresh catalog data everywhere. */
function invalidateCatalogs(kind: CatalogKind) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['catalogs'] }),
    queryClient.invalidateQueries({ queryKey: ['catalogs', kind] }),
  ]);
}