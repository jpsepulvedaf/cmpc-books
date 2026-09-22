// API data types shared across the frontend.

export type RoleCode = 'ADMIN' | 'OPERADOR' | 'CONSULTA';

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
  CONSULTA: 'Consulta',
};

export const ROLE_OPTIONS: { value: RoleCode; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'OPERADOR', label: 'Operador' },
  { value: 'CONSULTA', label: 'Consulta' },
];

export type Availability = 'IN_STOCK' | 'OUT_OF_STOCK';

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  IN_STOCK: 'Disponible',
  OUT_OF_STOCK: 'Agotado',
};

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  role: RoleCode;
  isActive: boolean;
}

export interface CatalogItem {
  id: number;
  name: string;
}

export interface AuthorRef {
  id: number;
  name: string;
}

export interface PublisherRef {
  id: number;
  name: string;
}

export interface GenreRef {
  id: number;
  name: string;
}

export interface BookListItem {
  id: number;
  isbn: string | null;
  title: string;
  description: string | null;
  price: string;
  stock: number;
  availability: Availability;
  imageUrl: string | null;
  author: AuthorRef;
  publisher: PublisherRef;
  genre: GenreRef;
}

export interface BookDetail extends BookListItem {
  authorId: number;
  publisherId: number;
  genreId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserItem {
  id: number;
  email: string;
  fullName: string;
  roleCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditItem {
  id: number;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  entityType: string;
  entityId: number | string | null;
  method: string;
  path: string;
  details: unknown;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

export interface AuditStats {
  total: number;
  byAction: { action: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
}

// ── Sort model ───────────────────────────────────────────────────────────────

export type BookSortField =
  | 'title'
  | 'price'
  | 'stock'
  | 'createdAt'
  | 'availability'
  | 'author.name'
  | 'publisher.name'
  | 'genre.name';

export type SortDirection = 'asc' | 'desc';

export interface SortCriterion {
  field: BookSortField;
  dir: SortDirection;
}

/** Allowed sort fields for the books endpoint, with their Spanish column labels. */
export const BOOK_SORT_FIELDS: Record<BookSortField, string> = {
  title: 'Título',
  price: 'Precio',
  stock: 'Stock',
  createdAt: 'Creado',
  availability: 'Disponibilidad',
  'author.name': 'Autor',
  'publisher.name': 'Editorial',
  'genre.name': 'Género',
};

// ── Books list filters ───────────────────────────────────────────────────────

export interface BookListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  genreId?: number | null;
  publisherId?: number | null;
  authorId?: number | null;
  availability?: Availability | '';
  sort?: string;
}

// ── Audit translations ───────────────────────────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  CREATE: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
  EXPORT: 'Exportación',
};

export const ENTITY_LABELS: Record<string, string> = {
  BOOK: 'Libro',
  USER: 'Usuario',
  AUTH: 'Autenticación',
};

export function translateAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function translateEntityType(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}