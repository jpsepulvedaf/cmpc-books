import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
// Mock the filesystem used by BooksService for image signature sniffing and
// best-effort file sweeping, so no real files are touched during the tests.
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));
import { readFile, unlink } from 'node:fs/promises';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { BooksService } from './books.service';

async function outcome(promise: Promise<unknown>): Promise<{ ok: boolean; error?: ApiException; value?: unknown }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error as ApiException };
  }
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

/** RIFF/WEBP headers for every WebP sub-format (lossy VP8, lossless VP8L, extended VP8X). */
const WEBP_HEADERS = {
  'lossy VP8': Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x14, 0x00, 0x00, 0x00]), Buffer.from('WEBPVP8 '), Buffer.from([0x00, 0x00, 0x00, 0x00])]),
  'lossless VP8L': Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x14, 0x00, 0x00, 0x00]), Buffer.from('WEBPVP8L'), Buffer.from([0x00, 0x00, 0x00, 0x00])]),
  'extended VP8X': Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x14, 0x00, 0x00, 0x00]), Buffer.from('WEBPVP8X'), Buffer.from([0x00, 0x00, 0x00, 0x00])]),
} as const;

describe('BooksService (unit)', () => {
  const prisma: {
    client: {
      book: {
        create: Mock;
        findFirst: Mock;
        findMany: Mock;
        count: Mock;
        findUnique: Mock;
        update: Mock;
      };
      author: { findUnique: Mock };
      publisher: { findUnique: Mock };
      genre: { findUnique: Mock };
    };
  } = {
    client: {
      book: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      author: { findUnique: vi.fn() },
      publisher: { findUnique: vi.fn() },
      genre: { findUnique: vi.fn() },
    },
  };

  const bookRow = {
    id: 1,
    isbn: '978-3-16-148410-0',
    title: 'El jardín de las mariposas',
    description: 'Una novela.',
    price: '19.9',
    stock: 12,
    availability: 'IN_STOCK',
    imageUrl: null,
    authorId: 1,
    author: { id: 1, name: 'Gabriel García Márquez' },
    publisher: { id: 1, name: 'Editorial Austral' },
    genre: { id: 1, name: 'Ficción' },
  };

  const relationsOk = (): void => {
    prisma.client.author.findUnique.mockResolvedValue({ id: 1 });
    prisma.client.publisher.findUnique.mockResolvedValue({ id: 1 });
    prisma.client.genre.findUnique.mockResolvedValue({ id: 1 });
  };

  let service: BooksService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // fs/promises functions return promises in production; make the mocks
    // behave likewise so `await unlink(...).catch(...)` keeps working.
    (unlink as Mock).mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [BooksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BooksService);
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    const baseDto = {
      title: 'Nuevo libro',
      price: 9.9,
      stock: 5,
      authorId: 1,
      publisherId: 1,
      genreId: 1,
    };

    it('derives availability IN_STOCK from a positive stock', async () => {
      relationsOk();
      prisma.client.book.findUnique.mockResolvedValue(null);
      prisma.client.book.create.mockResolvedValue(bookRow);

      const result = await outcome(service.create(baseDto));

      expect(result.ok).toBe(true);
      const createArg = prisma.client.book.create.mock.calls[0][0];
      expect(createArg.data.availability).toBe('IN_STOCK');
      expect(createArg.data.stock).toBe(5);
    });

    it('derives availability OUT_OF_STOCK from zero stock', async () => {
      relationsOk();
      prisma.client.book.findUnique.mockResolvedValue(null);
      prisma.client.book.create.mockResolvedValue(bookRow);

      await outcome(service.create({ ...baseDto, stock: 0 }));

      expect(prisma.client.book.create.mock.calls[0][0].data.availability).toBe('OUT_OF_STOCK');
    });

    it('rejects a duplicated ISBN with 409 DUPLICATE_ISBN', async () => {
      relationsOk();
      prisma.client.book.findUnique.mockResolvedValue({ id: 99 });

      const result = await outcome(service.create({ ...baseDto, isbn: '978-9999999999' }));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(409);
      expect(result.error!.code).toBe('DUPLICATE_ISBN');
      expect(prisma.client.book.create).not.toHaveBeenCalled();
    });

    it('validates that author/publisher/genre exist (404 each)', async () => {
      prisma.client.author.findUnique.mockResolvedValue(null);
      prisma.client.publisher.findUnique.mockResolvedValue({ id: 1 });
      prisma.client.genre.findUnique.mockResolvedValue({ id: 1 });

      const missingAuthor = await outcome(service.create(baseDto));
      expect(missingAuthor.error!.getStatus()).toBe(404);
      expect(missingAuthor.error!.code).toBe('AUTHOR_NOT_FOUND');
      expect(prisma.client.publisher.findUnique).not.toHaveBeenCalled();

      prisma.client.author.findUnique.mockResolvedValue({ id: 1 });
      prisma.client.publisher.findUnique.mockResolvedValue(null);
      const missingPublisher = await outcome(service.create(baseDto));
      expect(missingPublisher.error!.code).toBe('PUBLISHER_NOT_FOUND');

      prisma.client.publisher.findUnique.mockResolvedValue({ id: 1 });
      prisma.client.genre.findUnique.mockResolvedValue(null);
      const missingGenre = await outcome(service.create(baseDto));
      expect(missingGenre.error!.code).toBe('GENRE_NOT_FOUND');
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns the book with relations when it exists', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);

      const result = await outcome(service.getById(1));

      expect(result.ok).toBe(true);
      expect(prisma.client.book.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { author: true, publisher: true, genre: true },
      });
    });

    it('throws 404 BOOK_NOT_FOUND for unknown or soft-deleted books', async () => {
      prisma.client.book.findFirst.mockResolvedValue(null);

      const result = await outcome(service.getById(42));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(404);
      expect(result.error!.code).toBe('BOOK_NOT_FOUND');
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('applies pagination via skip/take and computes totalPages', async () => {
      prisma.client.book.findMany.mockResolvedValue([bookRow]);
      prisma.client.book.count.mockResolvedValue(12);

      const result = await outcome(service.list({ page: 2, pageSize: 5 }));

      const findManyArg = prisma.client.book.findMany.mock.calls[0][0];
      expect(findManyArg.skip).toBe(5);
      expect(findManyArg.take).toBe(5);
      expect(findManyArg.orderBy).toEqual([]);

      const value = result.value as { total: number; totalPages: number; items: unknown[] };
      expect(value.total).toBe(12);
      expect(value.totalPages).toBe(3);
      expect((value.items[0] as Record<string, unknown>).price).toBe('19.9');
      expect((value.items[0] as Record<string, unknown>).author).toEqual({ id: 1, name: 'Gabriel García Márquez' });
    });

    it('combines exact filters with a case-insensitive OR search', async () => {
      prisma.client.book.findMany.mockResolvedValue([]);
      prisma.client.book.count.mockResolvedValue(0);

      await outcome(
        service.list({ search: 'jardín', genreId: 2, availability: 'IN_STOCK', page: 1, pageSize: 20 }),
      );

      const where = prisma.client.book.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        AND: [
          { deletedAt: null },
          { genreId: 2 },
          { availability: 'IN_STOCK' },
          {
            OR: [
              { title: { contains: 'jardín', mode: 'insensitive' } },
              { isbn: { contains: 'jardín', mode: 'insensitive' } },
              { author: { is: { name: { contains: 'jardín', mode: 'insensitive' } } } },
            ],
          },
        ],
      });
    });

    it('does not add a search clause when search is blank', async () => {
      prisma.client.book.findMany.mockResolvedValue([]);
      prisma.client.book.count.mockResolvedValue(0);

      await outcome(service.list({ search: '   ', page: 1, pageSize: 20 }));

      expect(prisma.client.book.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    });

    it('builds a multi-field orderBy from the sort param', async () => {
      prisma.client.book.findMany.mockResolvedValue([]);
      prisma.client.book.count.mockResolvedValue(0);

      await outcome(
        service.list({ sort: 'title:asc,publisher.name:desc', page: 1, pageSize: 20 }),
      );

      expect(prisma.client.book.findMany.mock.calls[0][0].orderBy).toEqual([
        { title: 'asc' },
        { publisher: { name: 'desc' } },
      ]);
    });

    it('rejects unknown sort fields/directions with 400 INVALID_SORT_FIELD', async () => {
      const result = await outcome(service.list({ sort: 'foo:up,title:sideways', page: 1, pageSize: 20 }));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(400);
      expect(result.error!.code).toBe('INVALID_SORT_FIELD');
      expect(result.error!.details).toEqual(['foo:up', 'title:sideways']);
      expect(prisma.client.book.findMany).not.toHaveBeenCalled();
    });
  });

  // ── exportCsv ─────────────────────────────────────────────────────────────
  describe('exportCsv', () => {
    it('returns raw CSV with a UTF-8 BOM, Spanish headers, capped at 1000 rows', async () => {
      prisma.client.book.findMany.mockResolvedValue([bookRow]);

      const result = await outcome(service.exportCsv({}));

      expect(result.ok).toBe(true);
      const csv = result.value as string;
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Título');
      expect(csv).toContain('Disponibilidad');
      expect(csv).toContain(bookRow.title);
      expect(csv).toContain('IN_STOCK');
      expect(prisma.client.book.findMany.mock.calls[0][0].take).toBe(1000);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('re-derives availability IN_STOCK when stock changes', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      prisma.client.book.update.mockResolvedValue(bookRow);

      await outcome(service.update(1, { stock: 3 }));

      const updateArg = prisma.client.book.update.mock.calls[0][0];
      expect(updateArg.data.stock).toBe(3);
      expect(updateArg.data.availability).toBe('IN_STOCK');
    });

    it('re-derives availability OUT_OF_STOCK when stock reaches 0', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      prisma.client.book.update.mockResolvedValue(bookRow);

      await outcome(service.update(1, { stock: 0 }));

      const updateArg = prisma.client.book.update.mock.calls[0][0];
      expect(updateArg.data.availability).toBe('OUT_OF_STOCK');
    });

    it('does not touch availability when the stock is unchanged', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      prisma.client.book.update.mockResolvedValue(bookRow);

      await outcome(service.update(1, { title: 'Nuevo título' }));

      const updateArg = prisma.client.book.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('availability');
      // No relation changed → the existence checks must not run.
      expect(prisma.client.author.findUnique).not.toHaveBeenCalled();
    });

    it('validates relations when an id changes', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      prisma.client.author.findUnique.mockResolvedValue({ id: 2 });
      prisma.client.publisher.findUnique.mockResolvedValue({ id: 2 });
      prisma.client.genre.findUnique.mockResolvedValue({ id: 2 });
      prisma.client.book.update.mockResolvedValue(bookRow);

      await outcome(service.update(1, { authorId: 2 }));

      expect(prisma.client.author.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(prisma.client.book.update.mock.calls[0][0].data.authorId).toBe(2);
    });

    it('rejects an ISBN already used by another book with 409 DUPLICATE_ISBN', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      prisma.client.book.findUnique.mockResolvedValue({ id: 42 });

      const result = await outcome(service.update(1, { isbn: '978-0000000000' }));

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('DUPLICATE_ISBN');
    });

    it('returns 404 BOOK_NOT_FOUND for unknown books', async () => {
      prisma.client.book.findFirst.mockResolvedValue(null);

      const result = await outcome(service.update(99, { title: 'x' }));

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('BOOK_NOT_FOUND');
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('sets deletedAt and keeps the row', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      prisma.client.book.update.mockResolvedValue({ ...bookRow, deletedAt: new Date() });

      const result = await outcome(service.softDelete(1));

      expect(result.ok).toBe(true);
      const updateArg = prisma.client.book.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 1 });
      expect(updateArg.data).toEqual({ deletedAt: expect.any(Date) as unknown as Date });
    });

    it('is idempotent by contract: deleting a missing book is a 404', async () => {
      prisma.client.book.findFirst.mockResolvedValue(null);

      const result = await outcome(service.softDelete(99));

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('BOOK_NOT_FOUND');
      expect(prisma.client.book.update).not.toHaveBeenCalled();
    });
  });

  // ── uploadImage ───────────────────────────────────────────────────────────
  describe('uploadImage', () => {
    it('rejects a missing file with 400 INVALID_IMAGE', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);

      const result = await outcome(service.uploadImage(1, undefined));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(400);
      expect(result.error!.code).toBe('INVALID_IMAGE');
    });

    it('rejects a non-allowed mimetype with 400 INVALID_IMAGE and keeps the file', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);

      const result = await outcome(
        service.uploadImage(1, { mimetype: 'text/plain', size: 10, path: '/tmp/fake.txt' }),
      );

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('INVALID_IMAGE');
      expect(unlink).not.toHaveBeenCalled();
    });

    it('rejects forged magic bytes, deletes the uploaded file and returns 400', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);
      (readFile as Mock).mockResolvedValue(Buffer.from('this is not an image at all'));

      const result = await outcome(
        service.uploadImage(1, { mimetype: 'image/png', size: 30, path: '/tmp/uploads/forged.png' }),
      );

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('INVALID_IMAGE');
      expect(result.error!.message).toBe('The uploaded file is not a valid JPEG, PNG or WebP image');
      expect(unlink).toHaveBeenCalledWith('/tmp/uploads/forged.png');
    });

    it('accepts a valid PNG, stores the URL and sweeps the previous cover', async () => {
      prisma.client.book.findFirst.mockResolvedValue({
        ...bookRow,
        imageUrl: '/uploads/books/old-cover.png',
      });
      (readFile as Mock).mockResolvedValue(PNG_HEADER);
      prisma.client.book.update.mockResolvedValue({ ...bookRow, imageUrl: '/uploads/books/new-cover.png' });

      const result = await outcome(
        service.uploadImage(1, { mimetype: 'image/png', size: 512, path: '/tmp/uploads/new-cover.png' }),
      );

      expect(result.ok).toBe(true);
      expect(prisma.client.book.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { imageUrl: '/uploads/books/new-cover.png' },
        }),
      );
      // Replace semantics: the previous cover file is unlinked (best effort).
      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('old-cover.png') as unknown as string);
    });

    it.each(Object.entries(WEBP_HEADERS))(
      'accepts a real WebP signature (%s) and stores the URL',
      async (_label, header) => {
        prisma.client.book.findFirst.mockResolvedValue(bookRow);
        (readFile as Mock).mockResolvedValue(header);
        prisma.client.book.update.mockResolvedValue({ ...bookRow, imageUrl: '/uploads/books/new.webp' });

        const result = await outcome(
          service.uploadImage(1, { mimetype: 'image/webp', size: 512, path: '/tmp/uploads/new.webp' }),
        );

        expect(result.ok).toBe(true);
        expect(prisma.client.book.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            data: { imageUrl: '/uploads/books/new.webp' },
          }),
        );
      },
    );
  });

  // ── removeImage ───────────────────────────────────────────────────────────
  describe('removeImage', () => {
    it('throws 404 BOOK_IMAGE_NOT_FOUND when the book has no cover', async () => {
      prisma.client.book.findFirst.mockResolvedValue(bookRow);

      const result = await outcome(service.removeImage(1));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(404);
      expect(result.error!.code).toBe('BOOK_IMAGE_NOT_FOUND');
    });

    it('clears imageUrl and deletes the stored file', async () => {
      prisma.client.book.findFirst.mockResolvedValue({ ...bookRow, imageUrl: '/uploads/books/old-cover.png' });
      prisma.client.book.update.mockResolvedValue({ ...bookRow, imageUrl: null });

      const result = await outcome(service.removeImage(1));

      expect(result.ok).toBe(true);
      expect(prisma.client.book.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { imageUrl: null } }),
      );
      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('old-cover.png') as unknown as string);
    });
  });
});