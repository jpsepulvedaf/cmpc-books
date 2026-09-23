// Catalog CRUD endpoints (authors, publishers, genres).
// Reads are open to any authenticated role; writes require ADMIN (the backend
// enforces this via @Roles). Every response uses the global envelope
// `{ok:true,data}` / `{ok:false,error}` handled by `unwrap`.

import { api, unwrap } from '../../lib/api';
import type { CatalogItem } from '../../lib/types';

export type CatalogKind = 'authors' | 'publishers' | 'genres';

export function listAuthors(): Promise<CatalogItem[]> {
  return unwrap<CatalogItem[]>(api.get('/authors'));
}

export function createAuthor(name: string): Promise<CatalogItem> {
  return unwrap<CatalogItem>(api.post('/authors', { name }));
}

export function updateAuthor(id: number, name: string): Promise<CatalogItem> {
  return unwrap<CatalogItem>(api.patch(`/authors/${id}`, { name }));
}

export function deleteAuthor(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/authors/${id}`));
}

export function listPublishers(): Promise<CatalogItem[]> {
  return unwrap<CatalogItem[]>(api.get('/publishers'));
}

export function createPublisher(name: string): Promise<CatalogItem> {
  return unwrap<CatalogItem>(api.post('/publishers', { name }));
}

export function updatePublisher(id: number, name: string): Promise<CatalogItem> {
  return unwrap<CatalogItem>(api.patch(`/publishers/${id}`, { name }));
}

export function deletePublisher(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/publishers/${id}`));
}

export function listGenres(): Promise<CatalogItem[]> {
  return unwrap<CatalogItem[]>(api.get('/genres'));
}

export function createGenre(name: string): Promise<CatalogItem> {
  return unwrap<CatalogItem>(api.post('/genres', { name }));
}

export function updateGenre(id: number, name: string): Promise<CatalogItem> {
  return unwrap<CatalogItem>(api.patch(`/genres/${id}`, { name }));
}

export function deleteGenre(id: number): Promise<void> {
  return unwrap<void>(api.delete(`/genres/${id}`));
}

export interface CatalogGroup {
  list: () => Promise<CatalogItem[]>;
  create: (name: string) => Promise<CatalogItem>;
  update: (id: number, name: string) => Promise<CatalogItem>;
  delete: (id: number) => Promise<void>;
}

/** Groups the three catalog APIs under their endpoint key for generic pages. */
export const catalogGroups: Record<CatalogKind, CatalogGroup> = {
  authors: { list: listAuthors, create: createAuthor, update: updateAuthor, delete: deleteAuthor },
  publishers: {
    list: listPublishers,
    create: createPublisher,
    update: updatePublisher,
    delete: deletePublisher,
  },
  genres: { list: listGenres, create: createGenre, update: updateGenre, delete: deleteGenre },
};