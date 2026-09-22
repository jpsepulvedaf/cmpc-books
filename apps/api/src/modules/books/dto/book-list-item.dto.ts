/**
 * Row shape returned by GET /api/books (one per book, relations reduced to
 * { id, name } so the payload stays small with only the fields the web
 * catalog grid renders).
 *
 * `price` is intentionally the Prisma Decimal rendered as a string (e.g.
 * "19.9"), IDENTICAL to GET /api/books/:id — the client already parses that
 * format on the detail view, so the list must not diverge.
 */
export interface BookListItemDto {
  id: number;
  isbn: string | null;
  title: string;
  price: string;
  stock: number;
  availability: string;
  imageUrl: string | null;
  author: { id: number; name: string };
  publisher: { id: number; name: string };
  genre: { id: number; name: string };
}