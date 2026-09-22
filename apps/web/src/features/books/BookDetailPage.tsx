import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../../lib/session';
import { formatCLP, availabilityLabel } from '../../lib/format';
import { resolveImageUrl } from '../../lib/media';
import { getBook } from './api';
import { Badge } from '../../shared/Badge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { IconEdit } from '../../shared/Icons';

export function BookDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const bookId = Number(params.id);
  const session = getSession();
  const isAdmin = session?.user.role === 'ADMIN';

  const book = useQuery({
    queryKey: ['books', bookId],
    queryFn: () => getBook(bookId),
    enabled: !Number.isNaN(bookId),
    staleTime: 30_000,
  });

  if (Number.isNaN(bookId)) {
    return (
      <div className="card">
        <EmptyState title="Libro no encontrado." />
      </div>
    );
  }

  if (book.isPending && !book.data) {
    return <LoadingSpinner />;
  }

  if (book.isError || !book.data) {
    return (
      <div className="card">
        <EmptyState
          title="No se pudo cargar el libro."
          description="Es posible que haya sido eliminado o que no tengas acceso."
          action={
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/libros')}>
              Volver al catálogo
            </button>
          }
        />
      </div>
    );
  }

  const data = book.data;

  return (
    <section className="page">
      <nav className="breadcrumb" aria-label="Ruta de navegación">
        <Link to="/libros">Libros</Link>
        <span aria-hidden="true">/</span>
        <span>{data.title}</span>
      </nav>

      <div className="card book-detail">
        <div className="book-detail__cover">
          {data.imageUrl ? (
            <img
              className="book-detail__image"
              src={resolveImageUrl(data.imageUrl)}
              alt={`Portada de ${data.title}`}
            />
          ) : (
            <div className="book-detail__placeholder" aria-hidden="true">
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="5" width="7" height="15" rx="2" />
                <rect x="13" y="3" width="7" height="17" rx="2" />
              </svg>
              <p>Sin portada</p>
            </div>
          )}
        </div>

        <div className="book-detail__info">
          <h2>{data.title}</h2>
          <div className="book-detail__badges">
            <Badge tone={data.availability === 'IN_STOCK' ? 'success' : 'danger'}>
              {availabilityLabel(data.availability)}
            </Badge>
          </div>

          <dl className="book-detail__list">
            <div>
              <dt>Autor</dt>
              <dd>{data.author.name}</dd>
            </div>
            <div>
              <dt>Editorial</dt>
              <dd>{data.publisher.name}</dd>
            </div>
            <div>
              <dt>Género</dt>
              <dd>{data.genre.name}</dd>
            </div>
            <div>
              <dt>ISBN</dt>
              <dd>{data.isbn ?? '—'}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{formatCLP(data.price)}</dd>
            </div>
            <div>
              <dt>Stock</dt>
              <dd>{data.stock}</dd>
            </div>
          </dl>

          {data.description ? (
            <div className="book-detail__description">
              <h3>Descripción</h3>
              <p>{data.description}</p>
            </div>
          ) : null}

          <div className="book-detail__actions">
            {isAdmin ? (
              <Link to={`/libros/${data.id}/editar`} className="btn btn--primary">
                <IconEdit /> Editar
              </Link>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/libros')}>
              Volver
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}