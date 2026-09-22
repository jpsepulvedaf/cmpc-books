export interface PaginationControlProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZES = [10, 20, 50];

export function PaginationControl({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationControlProps) {
  const safeTotalPages = Math.max(1, totalPages);
  return (
    <div className="pagination" role="navigation" aria-label="Paginación">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </button>
      <span className="pagination__info">
        Página {Math.min(page, safeTotalPages)} de {safeTotalPages} · {total} resultados
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={page >= safeTotalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
      </button>
      <label className="pagination__size">
        <span className="pagination__size-label">Resultados por página</span>
        <select
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={String(size)}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}