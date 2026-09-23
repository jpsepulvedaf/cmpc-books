import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthorsController } from './authors.controller';
import { GenresController } from './genres.controller';
import { PublishersController } from './publishers.controller';
import { CatalogsService } from './catalogs.service';

/**
 * Controller contract tests, parameterized over the three catalogs: every
 * write handler must delegate with the parsed id / body to CatalogsService and
 * be marked @Roles('ADMIN') + the right @HttpCode, while the read route stays
 * open to any authenticated role.
 */
interface ControllerCase {
  name: string;
  Controller: typeof AuthorsController | typeof PublishersController | typeof GenresController;
  list: 'listAuthors' | 'listPublishers' | 'listGenres';
  create: 'createAuthor' | 'createPublisher' | 'createGenre';
  update: 'updateAuthor' | 'updatePublisher' | 'updateGenre';
  remove: 'removeAuthor' | 'removePublisher' | 'removeGenre';
}

const CASES: ControllerCase[] = [
  { name: 'authors', Controller: AuthorsController, list: 'listAuthors', create: 'createAuthor', update: 'updateAuthor', remove: 'removeAuthor' },
  { name: 'publishers', Controller: PublishersController, list: 'listPublishers', create: 'createPublisher', update: 'updatePublisher', remove: 'removePublisher' },
  { name: 'genres', Controller: GenresController, list: 'listGenres', create: 'createGenre', update: 'updateGenre', remove: 'removeGenre' },
];

describe('Catalog controllers (unit)', () => {
  const service: Record<string, Mock> = {
    listAuthors: vi.fn(),
    listPublishers: vi.fn(),
    listGenres: vi.fn(),
    createAuthor: vi.fn(),
    createPublisher: vi.fn(),
    createGenre: vi.fn(),
    updateAuthor: vi.fn(),
    updatePublisher: vi.fn(),
    updateGenre: vi.fn(),
    removeAuthor: vi.fn(),
    removePublisher: vi.fn(),
    removeGenre: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CASES)(
    '$name: the write routes are ADMIN-only while the read route is not',
    ({ Controller }) => {
      expect(Reflect.getMetadata('roles', Controller.prototype.create)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', Controller.prototype.update)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', Controller.prototype.remove)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', Controller.prototype.list)).toBeUndefined();
    },
  );

  it.each(CASES)(
    '$name: POST returns 201 and delegates the body to the service',
    async ({ Controller, create }) => {
      const moduleRef = await Test.createTestingModule({
        controllers: [Controller],
        providers: [{ provide: CatalogsService, useValue: service }],
      }).compile();
      const controller = moduleRef.get(Controller) as unknown as {
        create: (dto: { name: string }) => Promise<unknown>;
      };
      service[create].mockResolvedValue({ id: 42, name: 'Autor Test' });

      const result = await controller.create({ name: 'Autor Test' });

      expect(Reflect.getMetadata('__httpCode__', Controller.prototype.create)).toBe(201);
      expect(service[create]).toHaveBeenCalledWith({ name: 'Autor Test' });
      expect(result).toEqual({ id: 42, name: 'Autor Test' });
    },
  );

  it.each(CASES)(
    '$name: PATCH delegates the parsed id and the body',
    async ({ Controller, update }) => {
      const moduleRef = await Test.createTestingModule({
        controllers: [Controller],
        providers: [{ provide: CatalogsService, useValue: service }],
      }).compile();
      const controller = moduleRef.get(Controller) as unknown as {
        update: (id: number, dto: { name?: string }) => Promise<unknown>;
      };
      service[update].mockResolvedValue({ id: 5, name: 'Nuevo' });

      const result = await controller.update(5, { name: 'Nuevo' });

      expect(service[update]).toHaveBeenCalledWith(5, { name: 'Nuevo' });
      expect(result).toEqual({ id: 5, name: 'Nuevo' });
    },
  );

  it.each(CASES)(
    '$name: DELETE returns 204, resolves to void and delegates the parsed id',
    async ({ Controller, remove }) => {
      const moduleRef = await Test.createTestingModule({
        controllers: [Controller],
        providers: [{ provide: CatalogsService, useValue: service }],
      }).compile();
      const controller = moduleRef.get(Controller) as unknown as {
        remove: (id: number) => Promise<void>;
      };
      service[remove].mockResolvedValue(undefined);

      const result = await controller.remove(8);

      expect(Reflect.getMetadata('__httpCode__', Controller.prototype.remove)).toBe(204);
      expect(service[remove]).toHaveBeenCalledWith(8);
      expect(result).toBeUndefined();
    },
  );
});