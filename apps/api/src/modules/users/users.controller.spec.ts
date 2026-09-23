import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Controller contract tests: every handler must delegate to UsersService with
 * the parsed id / actor principal, and the controller must be marked
 * @Roles('ADMIN') (class-level) so RolesGuard denies non-admins.
 */
describe('UsersController (unit)', () => {
  const service: {
    list: Mock;
    create: Mock;
    update: Mock;
    softDelete: Mock;
  } = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };

  let controller: UsersController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('declares the whole controller as ADMIN-only', () => {
    expect(Reflect.getMetadata('roles', UsersController)).toEqual(['ADMIN']);
  });

  it('GET / delegates the query DTO to UsersService.list', async () => {
    const query = { page: 2, pageSize: 5, search: 'maria' };
    service.list.mockResolvedValue({ items: [], total: 0 });

    const result = await controller.list(query);

    expect(service.list).toHaveBeenCalledWith(query);
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('POST / delegates the body to UsersService.create', async () => {
    const dto = { email: 'a@cmpc.libros', fullName: 'A', roleCode: 'OPERADOR', password: 'Operador123' };
    service.create.mockResolvedValue({ id: 1 });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 1 });
  });

  it('PATCH /:id delegates id, body and the actor', async () => {
    const dto = { fullName: 'Maria R.' };
    service.update.mockResolvedValue({ id: 3 });
    const actor = { sub: 9, email: 'admin@cmpc.libros', role: 'ADMIN' };

    await controller.update(3, dto, actor);

    expect(service.update).toHaveBeenCalledWith(3, dto, actor);
  });

  it('DELETE /:id delegates the parsed id and the actor sub to softDelete', async () => {
    service.softDelete.mockResolvedValue(undefined);

    await controller.remove(4, { sub: 9, email: 'admin@cmpc.libros', role: 'ADMIN' });

    expect(service.softDelete).toHaveBeenCalledWith(4, 9);
  });

  it('DELETE /:id resolves to void (204 semantics)', async () => {
    service.softDelete.mockResolvedValue(undefined);

    const result = await controller.remove(4, { sub: 9, email: 'admin@cmpc.libros', role: 'ADMIN' });

    expect(result).toBeUndefined();
  });
});