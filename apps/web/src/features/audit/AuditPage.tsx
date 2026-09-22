import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { formatDateTimeEs } from '../../lib/format';
import { translateAction, translateEntityType, type AuditItem } from '../../lib/types';
import { listAudit } from './api';
import { Badge } from '../../shared/Badge';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { PaginationControl } from '../../shared/PaginationControl';
import { IconChevronDown } from '../../shared/Icons';

const ACTION_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  LOGIN: 'info',
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
  EXPORT: 'neutral',
};

function formatDetails(details: unknown): string {
  if (details === null || details === undefined) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function AuditPage() {
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const audit = useQuery({
    queryKey: ['audit', { search: searchTerm, page, pageSize }],
    queryFn: () => listAudit({ search: searchTerm.length > 0 ? searchTerm : undefined, page, pageSize }),
    placeholderData: (previous) => previous,
  });

  const toggleRow = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  const data = audit.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Auditoría</h2>
          <p className="page-header__subtitle">Registro de actividad del sistema</p>
        </div>
      </header>

      <div className="filter-bar card">
        <div className="field filter-bar__search">
          <label className="visually-hidden" htmlFor="audit-search">
            Buscar en auditoría
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
              id="audit-search"
              type="search"
              value={searchInput}
              placeholder="Buscar por usuario, acción o entidad…"
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {audit.isError ? (
        <div className="alert alert--danger" role="alert">
          <p>{audit.error instanceof ApiError ? audit.error.userMessage : 'No se pudo cargar el registro de auditoría.'}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => audit.refetch()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!audit.isError && audit.isPending && !data ? <LoadingSpinner /> : null}

      {!audit.isError && data && data.items.length === 0 ? (
        <div className="card table-card">
          <EmptyState
            title="No hay eventos de auditoría que coincidan con la búsqueda."
            description={searchTerm.length > 0 ? 'Prueba con otro término.' : ''}
          />
        </div>
      ) : null}

      {!audit.isError && data && data.items.length > 0 ? (
        <div className="card table-card">
          <table className="table table--expandable">
            <caption className="visually-hidden">Eventos de auditoría del sistema</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Usuario</th>
                <th scope="col">Rol</th>
                <th scope="col">Acción</th>
                <th scope="col">Entidad</th>
                <th scope="col">Método y ruta</th>
                <th scope="col" className="th-actions">
                  <span className="visually-hidden">Detalles</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: AuditItem) => (
                <AuditRow key={item.id} item={item} expanded={expanded.has(item.id)} onToggle={() => toggleRow(item.id)} />
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
    </section>
  );
}

function AuditRow({
  item,
  expanded,
  onToggle,
}: {
  item: AuditItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detailsText = formatDetails(item.details);
  const hasDetails = detailsText.length > 0;

  return (
    <>
      <tr>
        <td>{formatDateTimeEs(item.createdAt)}</td>
        <td>{item.userName ?? '—'}</td>
        <td>
          <Badge tone="neutral">{item.userRole && item.userRole !== '-' ? item.userRole : '—'}</Badge>
        </td>
        <td>
          <Badge tone={ACTION_TONE[item.action] ?? 'neutral'}>{translateAction(item.action)}</Badge>
        </td>
        <td>
          {translateEntityType(item.entityType)}
          {item.entityId !== null ? <span className="audit-entity-id"> #{item.entityId}</span> : null}
        </td>
        <td>
          <code className="audit-path">{item.method} {item.path}</code>
        </td>
        <td className="td-actions">
          {hasDetails ? (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              aria-expanded={expanded}
              aria-label={expanded ? 'Ocultar detalles' : 'Ver detalles'}
              title={expanded ? 'Ocultar detalles' : 'Ver detalles'}
              onClick={onToggle}
            >
              <span className={`chevron${expanded ? ' chevron--open' : ''}`} aria-hidden="true">
                <IconChevronDown />
              </span>
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && hasDetails ? (
        <tr className="audit-row-details">
          <td colSpan={7}>
            <pre className="audit-details">{detailsText}</pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}