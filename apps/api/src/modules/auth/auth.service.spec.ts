import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';

// REAL bcryptjs: hash a known password once so `compareSync` is exercised
// against a genuine bcrypt hash instead of a stub implementation.
const PASSWORD_HASH = bcrypt.hashSync('Admin123!', 10);

/** Resolves a promise into a tagged result so error contracts can be asserted. */
async function outcome(promise: Promise<unknown>): Promise<{ ok: boolean; error?: ApiException; value?: unknown }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error as ApiException };
  }
}

describe('AuthService (unit)', () => {
  const prisma: {
    client: {
      user: {
        findUnique: Mock;
        findFirst: Mock;
      };
    };
  } = {
    client: {
      user: { findUnique: vi.fn(), findFirst: vi.fn() },
    },
  };
  const jwt: { signAsync: Mock } = { signAsync: vi.fn() };

  // Spy over the REAL bcryptjs: calls still run through the actual compareSync
  // implementation, so the password is genuinely verified against the hash.
  const compareSpy = vi.spyOn(bcrypt, 'compareSync');

  const activeUser = {
    id: 1,
    email: 'admin@cmpc.libros',
    passwordHash: PASSWORD_HASH,
    fullName: 'Administrador del Sistema',
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    role: { code: 'ADMIN' },
  };

  const credentials: LoginRequestDto = {
    email: 'admin@cmpc.libros',
    password: 'Admin123!',
  };

  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('returns a JWT signed with the correct payload and a public user without the hash', async () => {
      prisma.client.user.findUnique.mockResolvedValue(activeUser);
      jwt.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await outcome(service.login(credentials));

      expect(result.ok).toBe(true);
      // Real bcrypt verified the password against its own hash.
      expect(compareSpy).toHaveBeenCalledWith('Admin123!', PASSWORD_HASH);
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 1, email: 'admin@cmpc.libros', role: 'ADMIN' });
      const value = result.value as { token: string; user: Record<string, unknown> };
      expect(value.token).toBe('signed.jwt.token');
      expect(value.user).toEqual({
        id: 1,
        email: 'admin@cmpc.libros',
        fullName: 'Administrador del Sistema',
        role: 'ADMIN',
        isActive: true,
        createdAt: activeUser.createdAt,
      });
      expect(value.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
      prisma.client.user.findUnique.mockResolvedValue(activeUser);

      const result = await outcome(service.login({ ...credentials, password: 'WrongPass123!' }));

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(ApiException);
      expect(result.error!.getStatus()).toBe(401);
      expect(result.error!.code).toBe('INVALID_CREDENTIALS');
      expect(result.error!.message).toBe('Invalid email or password');
    });

    it('returns the SAME error for an unknown email (no user enumeration)', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);

      const result = await outcome(service.login(credentials));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(401);
      expect(result.error!.code).toBe('INVALID_CREDENTIALS');
      expect(result.error!.message).toBe('Invalid email or password');
      // The password must not even be checked when the user does not exist.
      expect(compareSpy).not.toHaveBeenCalled();
    });

    it('returns the SAME error for a soft-deleted user', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ ...activeUser, deletedAt: new Date() });

      const result = await outcome(service.login(credentials));

      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe('INVALID_CREDENTIALS');
    });

    it('blocks an inactive user with 403 USER_INACTIVE', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });

      const result = await outcome(service.login(credentials));

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(ApiException);
      expect(result.error!.getStatus()).toBe(403);
      expect(result.error!.code).toBe('USER_INACTIVE');
      expect(result.error!.message).toBe('User account is inactive');
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('returns the current profile without the password hash', async () => {
      prisma.client.user.findFirst.mockResolvedValue(activeUser);

      const result = await outcome(service.me(1));

      expect(result.ok).toBe(true);
      expect(prisma.client.user.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: { role: true },
      });
      expect(result.value).not.toHaveProperty('passwordHash');
      expect((result.value as { id: number }).id).toBe(1);
    });

    it('throws 404 USER_NOT_FOUND when the user does not exist', async () => {
      prisma.client.user.findFirst.mockResolvedValue(null);

      const result = await outcome(service.me(99));

      expect(result.ok).toBe(false);
      expect(result.error!.getStatus()).toBe(404);
      expect(result.error!.code).toBe('USER_NOT_FOUND');
    });
  });
});