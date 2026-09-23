import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import bcrypt from 'bcryptjs';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

async function outcome(promise: Promise<unknown>): Promise<{ ok: boolean; error?: ApiException; value?: unknown }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error as ApiException };
  }
}

describe('UsersService (unit)', () => {
  const prisma: {
    client: {
      user: {
        findMany: Mock;
        count: Mock;
        findUnique: Mock;
        findFirst: Mock;
        create: Mock;
        update: Mock;
      };
      role: { findUnique: Mock };
    };
  } = {
    client: {
      user: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      role: { findUnique: vi.fn() },
    },
  };

  // Spy over the REAL bcryptjs: hashSync still runs its actual implementation,
  // so the produced hash is a genuine 10-round bcrypt hash we verify below.
  const hashSpy = vi.spyOn(bcrypt, 'hashSync');

  const userRow = {
    id: 7,
    email: 'maria@cmpc.libros',
    passwordHash: '$hash',
    fullName: 'Maria Lopez',
    isActive: true,
    roleId: 2,
    role: { id: 2, code: 'OPERADOR', name: 'Operador' },
    createdAt: new Date('2025-02-01T00:00:00Z'),
  };

  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('list', () => {
    it('paginates and always filters out soft-deleted users', async () => {
      prisma.client.user.findMany.mockResolvedValue([userRow]);
      prisma.client.user.count.mockResolvedValue(12);

      const result = await outcome(service.list({ page: 1, pageSize: 10 }));

      expect(result.ok).toBe(true);
      const findManyArg = prisma.client.user.findMany.mock.calls[0][0];
      expect(findManyArg.where).toEqual({ deletedAt: null });
      expect(findManyArg.include).toEqual({ role: true });
      expect(findManyArg.orderBy).toEqual({ id: 'asc' });
      expect(findManyArg.skip).toBe(0);
      expect(findManyArg.take).toBe(10);

      const value = result.value as { total: number; totalPages: number; items: unknown[] };
      expect(value.total).toBe(12);
      expect(value.page).toBe(1);
      expect(value.pageSize).toBe(10);
      expect(value.totalPages).toBe(2);
      expect(value.items).toHaveLength(1);
      expect((value.items[0] as Record<string, unknown>).role).toEqual({ code: 'OPERADOR', name: 'Operador' });
    });

    it('builds a case-insensitive OR search over email and fullName', async () => {
      prisma.client.user.findMany.mockResolvedValue([]);
      prisma.client.user.count.mockResolvedValue(0);

      await outcome(service.list({ page: 1, pageSize: 10, search: '  Maria ' }));

      const findManyArg = prisma.client.user.findMany.mock.calls[0][0];
      expect(findManyArg.where).toEqual({
        deletedAt: null,
        OR: [
          { email: { contains: 'Maria', mode: 'insensitive' } },
          { fullName: { contains: 'Maria', mode: 'insensitive' } },
        ],
      });
    });

    it('drops blank search strings instead of building an OR', async () => {
      prisma.client.user.findMany.mockResolvedValue([]);
      prisma.client.user.count.mockResolvedValue(0);

      await outcome(service.list({ page: 1, pageSize: 10, search: '   ' }));

      expect(prisma.client.user.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    });
  });

  describe('create', () => {
    const dto = {
      email: 'maria@cmpc.libros',
      fullName: 'Maria Lopez',
      roleCode: 'OPERADOR',
      password: 'Operador123',
    };

    it('hashes the password with bcrypt (10 rounds) and creates the user', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      prisma.client.role.findUnique.mockResolvedValue({ id: 2, code: 'OPERADOR' });
      prisma.client.user.create.mockResolvedValue(userRow);

      const result = await outcome(service.create(dto));

      expect(result.ok).toBe(true);
      expect(hashSpy).toHaveBeenCalledWith('Operador123', 10);
      expect(prisma.client.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'maria@cmpc.libros',
            fullName: 'Maria Lopez',
            isActive: true,
            roleId: 2,
          }),
          include: { role: true },
        }),
      );
      // The persisted hash is a real 10-round bcrypt hash and it round-trips
      // against the plain password using real bcryptjs.
      const createArg = prisma.client.user.create.mock.calls[0][0];
      expect(createArg.data.passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(bcrypt.compareSync('Operador123', createArg.data.passwordHash)).toBe(true);
      expect(result.value).not.toHaveProperty('passwordHash');
    });

    it('rejects a duplicate email with 409 EMAIL_EXISTS (before checking the role)', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ id: 3, email: dto.email });

      const result = await outcome(service.create(dto));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(409);
      expect(result.error!.code).toBe('EMAIL_EXISTS');
      expect(prisma.client.role.findUnique).not.toHaveBeenCalled();
      expect(prisma.client.user.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown role code with 400 INVALID_ROLE', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      prisma.client.role.findUnique.mockResolvedValue(null);

      const result = await outcome(service.create(dto));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(400);
      expect(result.error!.code).toBe('INVALID_ROLE');
      expect(hashSpy).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns 404 USER_NOT_FOUND when the target does not exist or is deleted', async () => {
      prisma.client.user.findFirst.mockResolvedValue(null);

      const result = await outcome(service.update(99, { fullName: 'X' }, 1));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(404);
      expect(result.error!.code).toBe('USER_NOT_FOUND');
    });

    it('forbids deactivating your own account with 409 SELF_ACTION_FORBIDDEN', async () => {
      prisma.client.user.findFirst.mockResolvedValue({ ...userRow, id: 5 });

      const result = await outcome(service.update(5, { isActive: false }, 5));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(409);
      expect(result.error!.code).toBe('SELF_ACTION_FORBIDDEN');
      expect(prisma.client.user.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid new role with 400 INVALID_ROLE', async () => {
      prisma.client.user.findFirst.mockResolvedValue(userRow);
      prisma.client.role.findUnique.mockResolvedValue(null);

      const result = await outcome(service.update(7, { roleCode: 'SUPERUSER' }, 1));

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('INVALID_ROLE');
    });

    it('resolves the role id and updates only the provided fields', async () => {
      prisma.client.user.findFirst.mockResolvedValue(userRow);
      prisma.client.role.findUnique.mockResolvedValue({ id: 3, code: 'CONSULTA' });
      prisma.client.user.update.mockResolvedValue({ ...userRow, role: { id: 3, code: 'CONSULTA', name: 'Consulta' } });

      const result = await outcome(service.update(7, { fullName: 'Maria R.', roleCode: 'CONSULTA' }, 1));

      expect(result.ok).toBe(true);
      expect(prisma.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: expect.objectContaining({ fullName: 'Maria R.', roleId: 3 }),
        }),
      );
      const updateArg = prisma.client.user.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('isActive');
    });

    it('hashes a provided new password with bcrypt', async () => {
      prisma.client.user.findFirst.mockResolvedValue(userRow);
      prisma.client.user.update.mockResolvedValue({ ...userRow, role: { id: 1, code: 'ADMIN', name: 'Administrador' } });

      const result = await outcome(
        service.update(7, { fullName: 'Maria R.', password: 'NuevaClave123' }, 1),
      );

      expect(result.ok).toBe(true);
      const updateArg = prisma.client.user.update.mock.calls[0][0];
      expect(updateArg.data.passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(bcrypt.compareSync('NuevaClave123', updateArg.data.passwordHash)).toBe(true);
    });

    it('keeps the current password when an empty one is sent', async () => {
      prisma.client.user.findFirst.mockResolvedValue(userRow);
      prisma.client.user.update.mockResolvedValue({ ...userRow, role: { id: 1, code: 'ADMIN', name: 'Administrador' } });

      const result = await outcome(service.update(7, { fullName: 'Maria R.', password: '   ' }, 1));

      expect(result.ok).toBe(true);
      const updateArg = prisma.client.user.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('passwordHash');
    });
  });

  describe('softDelete', () => {
    it('soft-deletes by setting deletedAt', async () => {
      prisma.client.user.findFirst.mockResolvedValue(userRow);
      prisma.client.user.update.mockResolvedValue({ ...userRow, deletedAt: new Date() });

      const result = await outcome(service.softDelete(7, 1));

      expect(result.ok).toBe(true);
      const updateArg = prisma.client.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 7 });
      expect(updateArg.data).toEqual({ deletedAt: expect.any(Date) as unknown as Date });
    });

    it('forbids deleting your own account with 409 SELF_ACTION_FORBIDDEN', async () => {
      prisma.client.user.findFirst.mockResolvedValue({ ...userRow, id: 5 });

      const result = await outcome(service.softDelete(5, 5));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(409);
      expect(result.error!.code).toBe('SELF_ACTION_FORBIDDEN');
    });

    it('returns 404 USER_NOT_FOUND for a missing or already-deleted user', async () => {
      prisma.client.user.findFirst.mockResolvedValue(null);

      const result = await outcome(service.softDelete(99, 1));

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('CreateUserDto password validation (class-validator)', () => {
    it('rejects a weak password (shorter than 8, no uppercase, no digit)', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'maria@cmpc.libros',
        fullName: 'Maria Lopez',
        roleCode: 'OPERADOR',
        password: 'weak',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'password')).toBe(true);
    });

    it('accepts a strong password and a valid email', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'maria@cmpc.libros',
        fullName: 'Maria Lopez',
        roleCode: 'OPERADOR',
        password: 'Operador123',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid email even when the password is strong', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'not-an-email',
        fullName: 'Maria Lopez',
        roleCode: 'OPERADOR',
        password: 'Operador123',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'email')).toBe(true);
    });
  });

  describe('UpdateUserDto partial validation', () => {
    it('rejects isActive when it is not a boolean', async () => {
      const dto = plainToInstance(UpdateUserDto, { isActive: 'yes' });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'isActive')).toBe(true);
    });
  });
});