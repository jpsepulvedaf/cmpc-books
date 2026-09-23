import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { CatalogsService, type CatalogKind } from './catalogs.service';

async function outcome(promise: Promise<unknown>): Promise<{
  ok: boolean;
  error?: ApiException;
  value?: unknown;
}> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error as ApiException };
  }
}

/** Real Prisma error instance carrying the unique-constraint code (P2002). */
function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`name`)',
    { code: 'P2002', clientVersion: '7.10.0' },
  );
}

interface CatalogDelegateMock {
  findMany: Mock;
  findUnique: Mock;
  findFirst: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
  count: Mock;
}

function delegateMock(): CatalogDelegateMock {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

interface Case {
  kind: CatalogKind;
  create: 'createAuthor' | 'createPublisher' | 'createGenre';
  update: 'updateAuthor' | 'updatePublisher' | 'updateGenre';
  remove: 'removeAuthor' | 'removePublisher' | 'removeGenre';
  bookRef: 'authorId' | 'publisherId' | 'genreId';
  label: string;
}

// The three resources share the exact same shape and rules; the whole suite
// is parameterized over them so a behavior change applies to all three.
const CASES: Case[] = [
  { kind: 'author', create: 'createAuthor', update: 'updateAuthor', remove: 'removeAuthor', bookRef: 'authorId', label: 'author' },
  { kind: 'publisher', create: 'createPublisher', update: 'updatePublisher', remove: 'removePublisher', bookRef: 'publisherId', label: 'publisher' },
  { kind: 'genre', create: 'createGenre', update: 'updateGenre', remove: 'removeGenre', bookRef: 'genreId', label: 'genre' },
];

const SELECT = { id: true, name: true };

describe('CatalogsService (unit)', () => {
  const prisma: {
    client: {
      author: CatalogDelegateMock;
      publisher: CatalogDelegateMock;
      genre: CatalogDelegateMock;
      book: { count: Mock };
    };
  } = {
    client: {
      author: delegateMock(),
      publisher: delegateMock(),
      genre: delegateMock(),
      book: { count: vi.fn() },
    },
  };

  let service: CatalogsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [CatalogsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CatalogsService);
  });

  describe('create', () => {
    it.each(CASES)(
      '$kind: trims the name, checks availability case-insensitively and returns {id, name}',
      async ({ kind, create }) => {
        const delegate = prisma.client[kind];
        delegate.findFirst.mockResolvedValue(null);
        delegate.create.mockResolvedValue({ id: 42, name: 'Autor Test' });

        const result = await outcome(service[create]({ name: '  Autor Test  ' }));

        expect(result.ok).toBe(true);
        expect(result.value).toEqual({ id: 42, name: 'Autor Test' });
        expect(delegate.findFirst).toHaveBeenCalledWith({
          where: { name: { equals: 'Autor Test', mode: 'insensitive' } },
          select: { id: true },
        });
        expect(delegate.create).toHaveBeenCalledWith({
          data: { name: 'Autor Test' },
          select: SELECT,
        });
      },
    );

    it.each(CASES)(
      '$kind: rejects a case-insensitive duplicate with 409 NAME_EXISTS and does NOT create',
      async ({ kind, create, label }) => {
        const delegate = prisma.client[kind];
        delegate.findFirst.mockResolvedValue({ id: 7 });

        const result = await outcome(service[create]({ name: 'gabriel garcía márquez' }));

        expect(result.ok).toBe(false);
        expect(result.error!.getStatus()).toBe(409);
        expect(result.error!.code).toBe('NAME_EXISTS');
        expect(result.error!.message).toBe(
          `${label === 'author' ? 'An' : 'A'} ${label} with this name already exists`,
        );
        expect(delegate.create).not.toHaveBeenCalled();
      },
    );

    it.each(CASES)(
      '$kind: maps a Prisma unique-constraint error (P2002) to 409 NAME_EXISTS',
      async ({ kind, create }) => {
        const delegate = prisma.client[kind];
        delegate.findFirst.mockResolvedValue(null);
        delegate.create.mockRejectedValue(uniqueViolation());

        const result = await outcome(service[create]({ name: 'Autor Test' }));

        expect(result.ok).toBe(false);
        expect(result.error!.getStatus()).toBe(409);
        expect(result.error!.code).toBe('NAME_EXISTS');
      },
    );
  });

  describe('update', () => {
    it.each(CASES)(
      '$kind: returns 404 CATALOG_NOT_FOUND when the row does not exist',
      async ({ kind, update }) => {
        prisma.client[kind].findUnique.mockResolvedValue(null);

        const result = await outcome(service[update](99, { name: 'Nuevo' }));

        expect(result.ok).toBe(false);
        expect(result.error!.getStatus()).toBe(404);
        expect(result.error!.code).toBe('CATALOG_NOT_FOUND');
        expect(prisma.client[kind].update).not.toHaveBeenCalled();
      },
    );

    it.each(CASES)(
      '$kind: rejects a rename that collides with ANOTHER row (409 NAME_EXISTS)',
      async ({ kind, update, label }) => {
        const delegate = prisma.client[kind];
        delegate.findUnique.mockResolvedValue({ id: 5, name: 'Actual' });
        delegate.findFirst.mockResolvedValue({ id: 9 });

        const result = await outcome(service[update](5, { name: 'Tomado' }));

        expect(result.ok).toBe(false);
        expect(result.error!.getStatus()).toBe(409);
        expect(result.error!.code).toBe('NAME_EXISTS');
        expect(result.error!.message).toBe(
          `${label === 'author' ? 'An' : 'A'} ${label} with this name already exists`,
        );
        // The collision check must exclude the target row itself.
        expect(delegate.findFirst).toHaveBeenCalledWith({
          where: { name: { equals: 'Tomado', mode: 'insensitive' }, id: { not: 5 } },
          select: { id: true },
        });
        expect(delegate.update).not.toHaveBeenCalled();
      },
    );

    it.each(CASES)(
      '$kind: renames successfully and returns the updated {id, name}',
      async ({ kind, update }) => {
        const delegate = prisma.client[kind];
        delegate.findUnique.mockResolvedValue({ id: 5, name: 'Actual' });
        delegate.findFirst.mockResolvedValue(null);
        delegate.update.mockResolvedValue({ id: 5, name: 'Nuevo' });

        const result = await outcome(service[update](5, { name: 'Nuevo' }));

        expect(result.ok).toBe(true);
        expect(result.value).toEqual({ id: 5, name: 'Nuevo' });
        expect(delegate.update).toHaveBeenCalledWith({
          where: { id: 5 },
          data: { name: 'Nuevo' },
          select: SELECT,
        });
      },
    );

    it.each(CASES)(
      '$kind: trims the new name before persisting it',
      async ({ kind, update }) => {
        const delegate = prisma.client[kind];
        delegate.findUnique.mockResolvedValue({ id: 5, name: 'Actual' });
        delegate.findFirst.mockResolvedValue(null);
        delegate.update.mockResolvedValue({ id: 5, name: 'Nuevo' });

        const result = await outcome(service[update](5, { name: '  Nuevo  ' }));

        expect(result.ok).toBe(true);
        expect(delegate.findFirst).toHaveBeenCalledWith({
          where: { name: { equals: 'Nuevo', mode: 'insensitive' }, id: { not: 5 } },
          select: { id: true },
        });
        expect(delegate.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { name: 'Nuevo' } }),
        );
      },
    );

    it.each(CASES)(
      '$kind: an empty body is a no-op that returns the current row',
      async ({ kind, update }) => {
        const delegate = prisma.client[kind];
        delegate.findUnique.mockResolvedValue({ id: 5, name: 'Actual' });

        const result = await outcome(service[update](5, {}));

        expect(result.ok).toBe(true);
        expect(result.value).toEqual({ id: 5, name: 'Actual' });
        expect(delegate.findFirst).not.toHaveBeenCalled();
        expect(delegate.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('remove', () => {
    it.each(CASES)(
      '$kind: blocks deletion with 409 CATALOG_IN_USE when books reference it and does NOT delete',
      async ({ kind, remove, bookRef, label }) => {
        const delegate = prisma.client[kind];
        delegate.findUnique.mockResolvedValue({ id: 1, name: 'En uso' });
        prisma.client.book.count.mockResolvedValue(3);

        const result = await outcome(service[remove](1));

        expect(result.ok).toBe(false);
        expect(result.error!.getStatus()).toBe(409);
        expect(result.error!.code).toBe('CATALOG_IN_USE');
        expect(result.error!.message).toBe(
          `Cannot delete this ${label}: 3 book(s) reference it`,
        );
        expect(prisma.client.book.count).toHaveBeenCalledWith({
          where: { [bookRef]: 1 },
        });
        expect(delegate.delete).not.toHaveBeenCalled();
      },
    );

    it.each(CASES)(
      '$kind: deletes and resolves to void when no books reference it',
      async ({ kind, remove, bookRef }) => {
        const delegate = prisma.client[kind];
        delegate.findUnique.mockResolvedValue({ id: 1, name: 'Libre' });
        prisma.client.book.count.mockResolvedValue(0);
        delegate.delete.mockResolvedValue({ id: 1, name: 'Libre' });

        const result = await outcome(service[remove](1));

        expect(result.ok).toBe(true);
        expect(result.value).toBeUndefined();
        expect(prisma.client.book.count).toHaveBeenCalledWith({
          where: { [bookRef]: 1 },
        });
        expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      },
    );

    it.each(CASES)(
      '$kind: returns 404 CATALOG_NOT_FOUND for a missing row without counting books',
      async ({ kind, remove }) => {
        prisma.client[kind].findUnique.mockResolvedValue(null);

        const result = await outcome(service[remove](123));

        expect(result.ok).toBe(false);
        expect(result.error!.getStatus()).toBe(404);
        expect(result.error!.code).toBe('CATALOG_NOT_FOUND');
        expect(prisma.client.book.count).not.toHaveBeenCalled();
        expect(prisma.client[kind].delete).not.toHaveBeenCalled();
      },
    );
  });
});