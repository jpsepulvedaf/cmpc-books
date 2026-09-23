import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { getSession, normalizeRoleCode } from '../../lib/session';
import { formatDateEs, roleLabel } from '../../lib/format';
import { ROLE_OPTIONS, type RoleCode, type UserItem } from '../../lib/types';
import { EMPTY_USER_FORM, PASSWORD_HINT, editUserPasswordSchema, userSchemas, zodField, type UserFormValues } from '../../lib/validators';
import { createUser, deleteUser, listUsers, updateUser } from './api';
import { queryClient } from '../../lib/queryClient';
import { Badge } from '../../shared/Badge';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { PaginationControl } from '../../shared/PaginationControl';
import { FieldError, FormAlert, getFieldError, fieldErrorId, FormHint } from '../../shared/Form';
import { IconEdit, IconPlus } from '../../shared/Icons';

const ROLE_TONE: Record<RoleCode, 'role' | 'info' | 'neutral'> = {
  ADMIN: 'role',
  OPERADOR: 'info',
  CONSULTA: 'neutral',
};

export function UsersPage() {
  const session = getSession();
  const currentUserId = session?.user.id;

  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  const users = useQuery({
    queryKey: ['users', { search: searchTerm, page, pageSize }],
    queryFn: () => listUsers({ search: searchTerm.length > 0 ? searchTerm : undefined, page, pageSize }),
    placeholderData: (previous) => previous,
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserItem) => updateUser(user.id, { isActive: !user.isActive }),
    onSuccess: (_, user) => {
      toast.success(user.isActive ? 'Usuario desactivado.' : 'Usuario activado.');
    },
    onError: (error: ApiError) => toast.error(error.userMessage),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const removeUser = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => toast.success('Usuario eliminado correctamente.'),
    onError: (error: ApiError) => toast.error(error.userMessage),
    onSettled: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const data = users.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Usuarios</h2>
          <p className="page-header__subtitle">Administración de accesos y roles del sistema</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowNewUser((open) => !open)}
            aria-expanded={showNewUser}
          >
            <IconPlus /> Nuevo usuario
          </button>
        </div>
      </header>

      {showNewUser ? <NewUserForm onDone={() => setShowNewUser(false)} /> : null}
      {editTarget ? (
        <EditUserForm
          user={editTarget}
          onDone={() => setEditTarget(null)}
        />
      ) : null}

      <div className="filter-bar card">
        <div className="field filter-bar__search">
          <label className="visually-hidden" htmlFor="user-search">
            Buscar usuarios
          </label>
          <div className="input-with-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="12" r="7" />
              <path d="M8 9 L14 9 L14 17 L8 17 M10 19 L14 19" />
            </svg>
            <input
              id="user-search"
              type="search"
              value={searchInput}
              placeholder="Buscar por nombre o correo…"
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {users.isError ? (
        <div className="alert alert--danger" role="alert">
          <p>{users.error instanceof ApiError ? users.error.userMessage : 'No se pudieron cargar los usuarios.'}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => users.refetch()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!users.isError && users.isPending && !data ? <LoadingSpinner /> : null}

      {!users.isError && data && data.items.length === 0 ? (
        <div className="card table-card">
          <EmptyState
            title="No hay usuarios que coincidan con la búsqueda."
            description={searchTerm.length > 0 ? 'Prueba con otro nombre o correo.' : ''}
          />
        </div>
      ) : null}

      {!users.isError && data && data.items.length > 0 ? (
        <div className="card table-card">
          <table className="table">
            <caption className="visually-hidden">Listado de usuarios del sistema</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Creado</th>
                <th scope="col" className="th-actions">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.fullName}
                    {user.id === currentUserId ? <Badge tone="info">Tú</Badge> : null}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <Badge tone={ROLE_TONE[normalizeRoleCode(user.roleCode)] ?? 'neutral'}>
                      {roleLabel(normalizeRoleCode(user.roleCode))}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={user.isActive ? 'success' : 'neutral'}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td>{formatDateEs(user.createdAt)}</td>
                  <td className="td-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      title="Editar usuario"
                      aria-label={`Editar ${user.fullName}`}
                      onClick={() => setEditTarget(user)}
                    >
                      <IconEdit /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => toggleActive.mutate(user)}
                      title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger"
                      title="Eliminar usuario"
                      disabled={user.id === currentUserId || removeUser.isPending}
                      onClick={() => setDeleteTarget(user)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <PaginationControl
            page={data.page}
            totalPages={totalPages}
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
        title="Eliminar usuario"
        message={
          deleteTarget ? (
            <>
              ¿Estás seguro de que deseas eliminar a <strong>{deleteTarget.fullName}</strong> ({deleteTarget.email})? Esta acción no se puede deshacer.
            </>
          ) : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleteTarget) removeUser.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function EditUserForm({ user, onDone }: { user: UserItem; onDone: () => void }) {
  const { register, handleSubmit, formState, setValues } = useForm<EditUserFormValues>({
    defaultValues: {
      fullName: user.fullName ?? '',
      roleCode: normalizeRoleCode(user.roleCode),
      password: '',
    },
    mode: 'onTouched',
    shouldUseNativeValidation: false,
  });

  // Ensure the fields hold the values of the user being edited (the form is
  // created fresh whenever `editTarget` changes, so this is mostly a guard).
  useEffect(() => {
    setValues(
      {
        fullName: user.fullName ?? '',
        roleCode: normalizeRoleCode(user.roleCode),
        password: '',
      },
      { shouldValidate: false, shouldDirty: false, shouldTouch: false }
    );
  }, [user, setValues]);

  const fieldError = (name: keyof EditUserFormValues) => getFieldError(formState.errors, name);

  const update = useMutation({
    mutationFn: (values: EditUserFormValues) =>
      updateUser(user.id, {
        fullName: values.fullName.trim(),
        roleCode: values.roleCode,
        // Empty password = keep the current one (backend ignores it).
        password: values.password.trim().length > 0 ? values.password.trim() : undefined,
      }),
    onSuccess: () => {
      toast.success('Usuario actualizado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onDone();
    },
  });

  const apiMessage = update.error ? (update.error as ApiError).userMessage : undefined;
  const onSubmit = handleSubmit((values) => update.mutate(values));

  return (
    <form className="card form user-form" noValidate onSubmit={onSubmit}>
      <FormAlert message={apiMessage} />
      <h3 className="form-title">Editar usuario — {user.email}</h3>

      <div className="field">
        <label htmlFor="edit-user-fullName">Nombre completo</label>
        <input
          {...register('fullName', { validate: zodField(userSchemas.fullName) })}
          id="edit-user-fullName"
          type="text"
          placeholder="Nombre y apellido"
          aria-invalid={fieldError('fullName') ? 'true' : undefined}
          aria-describedby={fieldError('fullName') ? fieldErrorId('fullName') : undefined}
        />
        <FieldError name="fullName" message={fieldError('fullName')} />
      </div>

      <div className="field">
        <label htmlFor="edit-user-role">Rol</label>
        <select
          {...register('roleCode', { validate: zodField(userSchemas.roleCode) })}
          id="edit-user-role"
          aria-invalid={fieldError('roleCode') ? 'true' : undefined}
          aria-describedby={fieldError('roleCode') ? fieldErrorId('roleCode') : undefined}
        >
          <option value="">Selecciona un rol…</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <FieldError name="roleCode" message={fieldError('roleCode')} />
      </div>

      <div className="field">
        <label htmlFor="edit-user-password">Nueva contraseña</label>
        <input
          {...register('password', { validate: zodField(editUserPasswordSchema) })}
          id="edit-user-password"
          type="password"
          autoComplete="new-password"
          placeholder="Dejar vacío para mantener la actual"
          aria-invalid={fieldError('password') ? 'true' : undefined}
          aria-describedby={fieldError('password') ? fieldErrorId('password') : 'edit-user-password-hint'}
        />
        <FormHint id="edit-user-password-hint">{PASSWORD_HINT}</FormHint>
        <FieldError name="password" message={fieldError('password')} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!formState.isValid || update.isPending}
        >
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

type EditUserFormValues = {
  fullName: string;
  roleCode: string;
  password: string;
};

function NewUserForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, formState } = useForm<UserFormValues>({
    defaultValues: EMPTY_USER_FORM,
    mode: 'onTouched',
    shouldUseNativeValidation: false,
  });

  const fieldError = (name: keyof UserFormValues) => getFieldError(formState.errors, name);

  const create = useMutation({
    mutationFn: (values: UserFormValues) =>
      createUser({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        roleCode: values.roleCode,
        password: values.password,
      }),
    onSuccess: () => {
      toast.success('Usuario creado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onDone();
    },
  });

  const apiMessage = create.error ? (create.error as ApiError).userMessage : undefined;
  const onSubmit = handleSubmit((values) => create.mutate(values));

  return (
    <form className="card form user-form" noValidate onSubmit={onSubmit}>
      <FormAlert message={apiMessage} />

      <div className="field">
        <label htmlFor="user-fullName">Nombre completo</label>
        <input
          {...register('fullName', { validate: zodField(userSchemas.fullName) })}
          id="user-fullName"
          type="text"
          placeholder="Nombre y apellido"
          aria-invalid={fieldError('fullName') ? 'true' : undefined}
          aria-describedby={fieldError('fullName') ? fieldErrorId('fullName') : undefined}
        />
        <FieldError name="fullName" message={fieldError('fullName')} />
      </div>

      <div className="field">
        <label htmlFor="user-email">Correo electrónico</label>
        <input
          {...register('email', { validate: zodField(userSchemas.email) })}
          id="user-email"
          type="email"
          placeholder="correo@ejemplo.cl"
          aria-invalid={fieldError('email') ? 'true' : undefined}
          aria-describedby={fieldError('email') ? fieldErrorId('email') : undefined}
        />
        <FieldError name="email" message={fieldError('email')} />
      </div>

      <div className="field">
        <label htmlFor="user-role">Rol</label>
        <select
          {...register('roleCode', { validate: zodField(userSchemas.roleCode) })}
          id="user-role"
          aria-invalid={fieldError('roleCode') ? 'true' : undefined}
          aria-describedby={fieldError('roleCode') ? fieldErrorId('roleCode') : undefined}
        >
          <option value="">Selecciona un rol…</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <FieldError name="roleCode" message={fieldError('roleCode')} />
      </div>

      <div className="field">
        <label htmlFor="user-password">Contraseña</label>
        <input
          {...register('password', { validate: zodField(userSchemas.password) })}
          id="user-password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          aria-invalid={fieldError('password') ? 'true' : undefined}
          aria-describedby={fieldError('password') ? fieldErrorId('password') : 'user-password-hint'}
        />
        <FormHint id="user-password-hint">{PASSWORD_HINT}</FormHint>
        <FieldError name="password" message={fieldError('password')} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!formState.isValid || create.isPending}
        >
          {create.isPending ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}