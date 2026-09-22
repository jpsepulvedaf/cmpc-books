import { Injectable } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { BookFiltersQueryDto } from './dto/book-filters-query.dto';
import { BookListItemDto } from './dto/book-list-item.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ExportBooksQueryDto } from './dto/export-books-query.dto';
import { ListBooksQueryDto } from './dto/list-books-query.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import {
  BOOKS_UPLOAD_DIR,
  IMAGE_URL_PREFIX,
  isAllowedImageMime,
} from './image-upload.config';

/**
 * Server-owned availability. It mirrors the sign of `stock` and is NEVER
 * accepted from the client: IN_STOCK while stock > 0, OUT_OF_STOCK at 0.
 */
export const AVAILABILITY = {
  IN_STOCK: 'IN_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

const deriveAvailability = (stock: number): string =>
  stock > 0 ? AVAILABILITY.IN_STOCK : AVAILABILITY.OUT_OF_STOCK;

/** Shape of the multer file injected by @UploadedFile(). */
export interface UploadedBookImage {
  mimetype: string;
  size: number;
  path?: string;
  originalname?: string;
}

/**
 * Minimal Book row shape consumed by the list/CSV mappers. `price` is the
 * Prisma Decimal value; it is rendered as a STRING (see BookListItemDto) so
 * the list matches the existing GET /api/books/:id contract.
 */
interface ListableBook {
  id: number;
  isbn: string | null;
  title: string;
  price: unknown;
  stock: number;
  availability: string;
  imageUrl: string | null;
  author: { id: number; name: string };
  publisher: { id: number; name: string };
  genre: { id: number; name: string };
}

/**
 * Sort whitelist: allowed `field` → Prisma orderBy fragment builder.
 * Anything outside this map is rejected with INVALID_SORT_FIELD so the
 * orderBy object can never be driven by client-controlled keys.
 */
const SORT_ORDER: Record<
  string,
  (dir: Prisma.SortOrder) => Prisma.BookOrderByWithRelationInput
> = {
  title: (dir) => ({ title: dir }),
  price: (dir) => ({ price: dir }),
  stock: (dir) => ({ stock: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
  availability: (dir) => ({ availability: dir }),
  'author.name': (dir) => ({ author: { name: dir } }),
  'publisher.name': (dir) => ({ publisher: { name: dir } }),
  'genre.name': (dir) => ({ genre: { name: dir } }),
};

/** Safety cap for the unpaginated CSV export (documented in the endpoint). */
const MAX_EXPORT_ROWS = 1000;

// Product-facing CSV data is neutral Spanish — the BOM (\uFEFF) is what lets
// Excel render the accents/ñ correctly. Availability keeps the server enum
// code (IN_STOCK / OUT_OF_STOCK) so the export is machine-greppable and
// unambiguous, matching the API filter contract.
const CSV_HEADERS = [
  'Título',
  'ISBN',
  'Autor',
  'Editorial',
  'Género',
  'Precio',
  'Stock',
  'Disponibilidad',
];

/** CSV cell: double quotes around every field, embedded quotes doubled (RFC 4180). */
const csvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const csvRow = (book: ListableBook): string =>
  [
    book.title ?? '',
    book.isbn ?? '',
    book.author.name,
    book.publisher.name,
    book.genre.name,
    Number(book.price).toFixed(2),
    String(book.stock),
    book.availability,
  ]
    .map(csvCell)
    .join(',');

/**
 * Book domain service. Every write touches exactly ONE Book row, so single
 * Prisma calls are already atomic and no $transaction is required today.
 *
 * ─── Transaction policy (M5 audit log) ──────────────────────────────
 * When M5 starts writing an AuditLog row next to each BOOK write (create /
 * update / soft-delete / image change), BOTH writes MUST be wrapped in a
 * single `prisma.$transaction(async (tx) => { ... })` so the audit and the
 * domain write commit — or roll back — together. That is the exact spot the
 * transaction is used; adding it before M5 would be speculative.
 */
@Injectable()
export class BooksService {
  /** Relations populated on every book payload for the detail view. */
  private readonly include: Prisma.BookInclude = {
    author: true,
    publisher: true,
    genre: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookDto) {
    await this.validateRelations(dto.authorId, dto.publisherId, dto.genreId);
    await this.assertIsbnAvailable(dto.isbn);

    return this.prisma.client.book.create({
      data: {
        isbn: dto.isbn,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        availability: deriveAvailability(dto.stock),
        authorId: dto.authorId,
        publisherId: dto.publisherId,
        genreId: dto.genreId,
      },
      include: this.include,
    });
  }

  async getById(id: number) {
    const book = await this.prisma.client.book.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!book) {
      throw new ApiException(404, 'BOOK_NOT_FOUND', 'Book not found');
    }
    return book;
  }

  /**
   * Server-side paginated list. Filters/sort are shared with the CSV export
   * (same buildWhere/buildOrderBy), so both endpoints stay in sync by
   * construction. Uses a separate count + findMany (skip/take).
   */
  async list(query: ListBooksQueryDto) {
    const { page, pageSize } = query;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.client.book.findMany({
        where,
        include: this.include,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.book.count({ where }),
    ]);

    return {
      items: items.map((book) => this.toListItem(book)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Unpaginated CSV export matching the same filters/sort as `list`
   * (ADMIN/OPERADOR only — enforced by @Roles on the route). Capped at
   * MAX_EXPORT_ROWS rows: the CSV is a deliberate product export, not a
   * full-table dump. The raw CSV string (with BOM) is returned and the
   * controller writes it via @Res() so the global envelope is bypassed.
   */
  async exportCsv(query: ExportBooksQueryDto): Promise<string> {
    const books = await this.prisma.client.book.findMany({
      where: this.buildWhere(query),
      include: this.include,
      orderBy: this.buildOrderBy(query.sort),
      take: MAX_EXPORT_ROWS,
    });

    const rows = [CSV_HEADERS.join(','), ...books.map(csvRow)];
    return `\uFEFF${rows.join('\r\n')}\r\n`;
  }

  async update(id: number, dto: UpdateBookDto) {
    const current = await this.findActive(id);

    if (
      dto.authorId !== undefined ||
      dto.publisherId !== undefined ||
      dto.genreId !== undefined
    ) {
      await this.validateRelations(
        dto.authorId ?? current.authorId,
        dto.publisherId ?? current.publisherId,
        dto.genreId ?? current.genreId,
      );
    }

    if (dto.isbn !== undefined && dto.isbn !== current.isbn) {
      await this.assertIsbnAvailable(dto.isbn, id);
    }

    const data: Prisma.BookUncheckedUpdateInput = {};
    if (dto.isbn !== undefined) data.isbn = dto.isbn;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.stock !== undefined) {
      data.stock = dto.stock;
      // availability is derived: any stock change re-derives it atomically.
      data.availability = deriveAvailability(dto.stock);
    }
    if (dto.authorId !== undefined) data.authorId = dto.authorId;
    if (dto.publisherId !== undefined) data.publisherId = dto.publisherId;
    if (dto.genreId !== undefined) data.genreId = dto.genreId;

    return this.prisma.client.book.update({
      where: { id },
      data,
      include: this.include,
    });
  }

  /**
   * Soft delete: sets deletedAt so the row survives for audit purposes.
   * Idempotent by contract — deleting an already-deleted book is a 404.
   */
  async softDelete(id: number): Promise<void> {
    const book = await this.findActive(id);
    await this.prisma.client.book.update({
      where: { id: book.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Stores a cover for an existing book and returns the refreshed record. */
  async uploadImage(id: number, file: UploadedBookImage | undefined) {
    const book = await this.findActive(id);

    if (!file || !isAllowedImageMime(file.mimetype)) {
      throw new ApiException(
        400,
        'INVALID_IMAGE',
        'Only JPEG, PNG or WebP images are allowed (max 2MB)',
      );
    }

    // The file itself was already persisted by multer under a uuid name; we
    // only persist the public relative URL. Only the stored basename is used,
    // never the client-supplied original name.
    const imageUrl = `${IMAGE_URL_PREFIX}/${basename(file.path ?? '')}`;
    const updated = await this.prisma.client.book.update({
      where: { id: book.id },
      data: { imageUrl },
      include: this.include,
    });

    // Replace semantics: the previous cover is no longer referenced — sweep it.
    if (book.imageUrl) {
      this.tryRemoveStoredFile(book.imageUrl);
    }

    return updated;
  }

  /** Clears Book.imageUrl and deletes the stored file (best effort). */
  async removeImage(id: number): Promise<void> {
    const book = await this.findActive(id);
    if (!book.imageUrl) {
      throw new ApiException(404, 'BOOK_IMAGE_NOT_FOUND', 'Book has no image to remove');
    }
    await this.prisma.client.book.update({
      where: { id: book.id },
      data: { imageUrl: null },
    });
    this.tryRemoveStoredFile(book.imageUrl);
  }

  /**
   * Shared WHERE builder for list + export. `deletedAt: null` is ALWAYS part
   * of the filter; search is an OR over title / isbn / author name while the
   * exact filters (genreId, publisherId, authorId, availability) join with AND.
   */
  private buildWhere(query: BookFiltersQueryDto): Prisma.BookWhereInput {
    const filters: Prisma.BookWhereInput[] = [{ deletedAt: null }];

    if (query.genreId !== undefined) filters.push({ genreId: query.genreId });
    if (query.publisherId !== undefined) filters.push({ publisherId: query.publisherId });
    if (query.authorId !== undefined) filters.push({ authorId: query.authorId });
    if (query.availability !== undefined) filters.push({ availability: query.availability });

    const search = query.search?.trim();
    if (search) {
      // Partial, case-insensitive match on title, ISBN and author name. The
      // to-one relation filter uses `is:` to target the related Author row.
      filters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
          { author: { is: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  /**
   * Multi-field sort, e.g. `sort=title:asc,publisher.name:desc`. Strict
   * whitelist: unknown fields or directions are rejected with
   * INVALID_SORT_FIELD (400) instead of silently ignoring them.
   */
  private buildOrderBy(sort: string | undefined): Prisma.BookOrderByWithRelationInput[] {
    if (!sort || sort.trim().length === 0) {
      return [];
    }

    const orderBy: Prisma.BookOrderByWithRelationInput[] = [];
    const invalid: string[] = [];

    for (const rawItem of sort.split(',')) {
      const item = rawItem.trim();
      if (!item) continue;

      const parts = item.split(':');
      if (parts.length > 2) {
        invalid.push(item);
        continue;
      }

      const field = parts[0].trim();
      const dir = (parts.length === 2 ? parts[1] : 'asc').trim().toLowerCase();
      const build = SORT_ORDER[field];

      if (!build || (dir !== 'asc' && dir !== 'desc')) {
        invalid.push(item);
        continue;
      }
      orderBy.push(build(dir as Prisma.SortOrder));
    }

    if (invalid.length > 0) {
      throw new ApiException(
        400,
        'INVALID_SORT_FIELD',
        'Sort must reference allowed fields with asc|desc direction',
        invalid,
      );
    }
    return orderBy;
  }

  /** Reduces a full Book row to the small catalog-grid payload. */
  private toListItem(book: ListableBook): BookListItemDto {
    return {
      id: book.id,
      isbn: book.isbn,
      title: book.title,
      price: String(book.price),
      stock: book.stock,
      availability: book.availability,
      imageUrl: book.imageUrl,
      author: { id: book.author.id, name: book.author.name },
      publisher: { id: book.publisher.id, name: book.publisher.name },
      genre: { id: book.genre.id, name: book.genre.name },
    };
  }

  private async findActive(id: number) {
    const book = await this.prisma.client.book.findFirst({
      where: { id, deletedAt: null },
    });
    if (!book) {
      throw new ApiException(404, 'BOOK_NOT_FOUND', 'Book not found');
    }
    return book;
  }

  /**
   * ISBN uniqueness is enforced by the unique index, which covers rows even
   * after they are soft-deleted — so a deleted book's ISBN stays taken.
   */
  private async assertIsbnAvailable(isbn: string | undefined, exceptId?: number): Promise<void> {
    if (!isbn) return;
    const existing = await this.prisma.client.book.findUnique({ where: { isbn } });
    if (existing && existing.id !== exceptId) {
      throw new ApiException(
        409,
        'DUPLICATE_ISBN',
        `A book with ISBN "${isbn}" already exists`,
      );
    }
  }

  private async validateRelations(authorId: number, publisherId: number, genreId: number) {
    if (!(await this.prisma.client.author.findUnique({ where: { id: authorId } }))) {
      throw new ApiException(404, 'AUTHOR_NOT_FOUND', 'Author does not exist');
    }
    if (!(await this.prisma.client.publisher.findUnique({ where: { id: publisherId } }))) {
      throw new ApiException(404, 'PUBLISHER_NOT_FOUND', 'Publisher does not exist');
    }
    if (!(await this.prisma.client.genre.findUnique({ where: { id: genreId } }))) {
      throw new ApiException(404, 'GENRE_NOT_FOUND', 'Genre does not exist');
    }
  }

  /**
   * Best-effort removal of an uploaded file. A missing or orphaned file must
   * never fail the request (the DB is the source of truth for the cover URL).
   */
  private async tryRemoveStoredFile(imageUrl: string): Promise<void> {
    const fileName = basename(imageUrl);
    if (!fileName || fileName === '.' || fileName === '/') return;
    const fullPath = join(BOOKS_UPLOAD_DIR, fileName);
    if (!fullPath.startsWith(BOOKS_UPLOAD_DIR)) return; // defensive: stay in our folder
    try {
      await unlink(fullPath);
    } catch {
      // ignore — nothing to clean up or already gone
    }
  }
}