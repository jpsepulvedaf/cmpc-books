// Books endpoints: listing, CRUD, image upload and CSV export.

import { api, requestBlob, unwrap } from '../../lib/api';
import type { BookDetail, BookListItem, BookListParams, CatalogItem, Paged } from '../../lib/types';

export function listBooks(params: BookListParams): Promise<Paged<BookListItem>> {
  const query: Record<string, unknown> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.genreId) query.genreId = params.genreId;
  if (params.publisherId) query.publisherId = params.publisherId;
  if (params.authorId) query.authorId = params.authorId;
  if (params.availability) query.availability = params.availability;
  if (params.sort) query.sort = params.sort;
  return unwrap<Paged<BookListItem>>(api.get('/books', { params: query }));
}

export function getBook(id: number): Promise<BookDetail> {
  return unwrap<BookDetail>(api.get(`/books/${id}`));
}

export interface BookPayload {
  title: string;
  isbn: string | null;
  description: string | null;
  price: string;
  stock: number;
  authorId: number;
  publisherId: number;
  genreId: number;
}

export function createBook(payload: BookPayload): Promise<BookDetail> {
  return unwrap<BookDetail>(api.post('/books', payload));
}

export function updateBook(id: number, payload: Partial<BookPayload>): Promise<BookDetail> {
  return unwrap<BookDetail>(api.patch(`/books/${id}`, payload));
}

export function deleteBook(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/books/${id}`));
}

export function uploadBookImage(id: number, file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap<{ imageUrl: string }>(
    api.post(`/books/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  );
}

export function deleteBookImage(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/books/${id}/image`));
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

/**
 * Downloads the CSV export honoring the active filters
 * (page/pageSize excluded so the whole result set is exported).
 */
export async function exportBooksCsv(params: BookListParams): Promise<ExportResult> {
  const { page: _page, pageSize: _pageSize, ...filters } = params;
  const query: Record<string, unknown> = {};
  if (filters.search) query.search = filters.search;
  if (filters.genreId) query.genreId = filters.genreId;
  if (filters.publisherId) query.publisherId = filters.publisherId;
  if (filters.authorId) query.authorId = filters.authorId;
  if (filters.availability) query.availability = filters.availability;
  if (filters.sort) query.sort = filters.sort;
  const { data, filename } = await requestBlob<Blob>('/books/export', { params: query });
  return { blob: data, filename: filename ?? `libros_${new Date().toISOString().slice(0, 10)}.csv` };
}

/** Triggers the browser download for a CSV export. */
export function triggerCsvDownload(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Catalogs ─────────────────────────────────────────────────────────────────

export interface CatalogBundle {
  genres: CatalogItem[];
  authors: CatalogItem[];
  publishers: CatalogItem[];
}

export async function getCatalogBundle(): Promise<CatalogBundle> {
  const [genres, authors, publishers] = await Promise.all([
    unwrap<CatalogItem[]>(api.get('/genres')),
    unwrap<CatalogItem[]>(api.get('/authors')),
    unwrap<CatalogItem[]>(api.get('/publishers')),
  ]);
  return { genres, authors, publishers };
}