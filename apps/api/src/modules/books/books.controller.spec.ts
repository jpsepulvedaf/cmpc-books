import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

/**
 * Controller contract tests: delegation to BooksService plus the @Roles
 * metadata (books are readable by any role; writes and the CSV export are
 * role-restricted). The CSV handler is exercised with a stub @Res() Response,
 * since it writes the raw payload and bypasses the global envelope.
 */
describe('BooksController (unit)', () => {
  const service: {
    create: Mock;
    getById: Mock;
    list: Mock;
    exportCsv: Mock;
    update: Mock;
    softDelete: Mock;
    uploadImage: Mock;
    removeImage: Mock;
  } = {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    exportCsv: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
  };

  let controller: BooksController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: service }],
    }).compile();
    controller = moduleRef.get(BooksController);
  });

  describe('route metadata', () => {
    it('restricts create/PATCH/DELETE/image routes to ADMIN', () => {
      expect(Reflect.getMetadata('roles', BooksController.prototype.create)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', BooksController.prototype.update)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', BooksController.prototype.remove)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', BooksController.prototype.uploadImage)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata('roles', BooksController.prototype.removeImage)).toEqual(['ADMIN']);
    });

    it('restricts the CSV export to ADMIN and OPERADOR', () => {
      expect(Reflect.getMetadata('roles', BooksController.prototype.exportCsv)).toEqual([
        'ADMIN',
        'OPERADOR',
      ]);
    });

    it('leaves the read routes open to every authenticated role', () => {
      expect(Reflect.getMetadata('roles', BooksController.prototype.list)).toBeUndefined();
      expect(Reflect.getMetadata('roles', BooksController.prototype.getById)).toBeUndefined();
    });
  });

  describe('read handlers', () => {
    it('GET / delegates the transformed query DTO to BooksService.list', async () => {
      const query = { page: 1, pageSize: 20, genreId: 2 };
      service.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });

      const result = await controller.list(query);

      expect(service.list).toHaveBeenCalledWith(query);
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('GET /:id delegates the parsed id', async () => {
      service.getById.mockResolvedValue({ id: 12 });

      const result = await controller.getById(12);

      expect(service.getById).toHaveBeenCalledWith(12);
      expect(result).toEqual({ id: 12 });
    });
  });

  describe('GET /export (CSV via @Res)', () => {
    it('writes the raw CSV with content-type/disposition headers and returns nothing', async () => {
      service.exportCsv.mockResolvedValue('\uFEFFTítulo,ISBN\r\n"Libro",x\r\n');
      const res = { set: vi.fn(), send: vi.fn() };

      const result = await controller.exportCsv(
        { search: 'mar' },
        res as unknown as { set: unknown; send: unknown },
      );

      expect(service.exportCsv).toHaveBeenCalledWith({ search: 'mar' });
      expect(result).toBeUndefined();
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': expect.stringMatching(/^attachment; filename="libros_\d{4}-\d{2}-\d{2}\.csv"$/) as unknown as string,
      });
      expect(res.send).toHaveBeenCalledWith('\uFEFFTítulo,ISBN\r\n"Libro",x\r\n');
    });
  });

  describe('write handlers', () => {
    it('POST / delegates the CreateBookDto', async () => {
      const dto = { title: 'Nuevo libro', price: 9.9, stock: 1, authorId: 1, publisherId: 1, genreId: 1 };
      service.create.mockResolvedValue({ id: 10 });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 10 });
    });

    it('PATCH /:id delegates the parsed id and UpdateBookDto', async () => {
      const dto = { stock: 0 };
      service.update.mockResolvedValue({ id: 10 });

      await controller.update(10, dto);

      expect(service.update).toHaveBeenCalledWith(10, dto);
    });

    it('DELETE /:id delegates the parsed id to softDelete and resolves void', async () => {
      service.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove(10);

      expect(service.softDelete).toHaveBeenCalledWith(10);
      expect(result).toBeUndefined();
    });

    it('POST /:id/image delegates the file to uploadImage', async () => {
      const file = { mimetype: 'image/png', size: 100, path: '/tmp/x.png' };
      service.uploadImage.mockResolvedValue({ id: 10, imageUrl: '/uploads/books/x.png' });

      await controller.uploadImage(10, file as unknown as Express.Multer.File);

      expect(service.uploadImage).toHaveBeenCalledWith(10, file);
    });

    it('DELETE /:id/image delegates to removeImage and resolves void', async () => {
      service.removeImage.mockResolvedValue(undefined);

      const result = await controller.removeImage(10);

      expect(service.removeImage).toHaveBeenCalledWith(10);
      expect(result).toBeUndefined();
    });
  });
});