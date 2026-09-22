import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from './audit.service';

async function outcome(promise: Promise<unknown>): Promise<{ ok: boolean; error?: unknown; value?: unknown }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

describe('AuditService (unit)', () => {
  const prisma: {
    client: {
      auditLog: {
        create: Mock;
        findMany: Mock;
        count: Mock;
        groupBy: Mock;
      };
    };
  } = {
    client: {
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    },
  };

  let service: AuditService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  describe('record', () => {
    it('persists only whitelisted fields — stray values like passwords never reach the DB', async () => {
      prisma.client.auditLog.create.mockResolvedValue({ id: 1 });

      await outcome(
        service.record({
          action: 'LOGIN',
          entityType: 'AUTH',
          userName: 'admin@cmpc.libros',
          userRole: '-',
          method: 'POST',
          path: '/api/auth/login',
          ipAddress: '::1',
          password: 'S3cr3t-Value', // must be dropped by the whitelist
          details: { success: true },
        }),
      );

      const data = prisma.client.auditLog.create.mock.calls[0][0].data;
      expect(data.action).toBe('LOGIN');
      expect(data.entityType).toBe('AUTH');
      expect(data.path).toBe('/api/auth/login');
      expect(data.details).toEqual({ success: true });
      expect(data).not.toHaveProperty('password');
      expect(JSON.stringify(data)).not.toContain('S3cr3t-Value');
    });

    it('connects the user relation when a userId is provided', async () => {
      prisma.client.auditLog.create.mockResolvedValue({ id: 1 });

      await outcome(
        service.record({
          userId: 7,
          userName: 'maria@cmpc.libros',
          userRole: 'OPERADOR',
          action: 'CREATE',
          entityType: 'BOOK',
          details: { success: true },
        }),
      );

      const data = prisma.client.auditLog.create.mock.calls[0][0].data;
      expect(data.user).toEqual({ connect: { id: 7 } });
    });

    it('is fail-tolerant: a throwing auditLog.create never propagates', async () => {
      prisma.client.auditLog.create.mockRejectedValue(new Error('database is down'));

      const result = await outcome(
        service.record({ action: 'CREATE', entityType: 'BOOK', details: { success: true } }),
      );

      // The audit write failed internally, but the caller must not see it.
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
      expect(prisma.client.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    const row = { id: 1, action: 'CREATE', entityType: 'BOOK', userName: 'admin', createdAt: new Date() };

    it('paginates newest first with search (userName/action/entityType)', async () => {
      prisma.client.auditLog.findMany.mockResolvedValue([row]);
      prisma.client.auditLog.count.mockResolvedValue(25);

      const result = await outcome(service.list({ page: 2, pageSize: 10, search: 'book' }));

      const findManyArg = prisma.client.auditLog.findMany.mock.calls[0][0];
      expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
      expect(findManyArg.skip).toBe(10);
      expect(findManyArg.take).toBe(10);
      expect(findManyArg.where).toEqual({
        OR: [
          { userName: { contains: 'book', mode: 'insensitive' } },
          { action: { contains: 'book', mode: 'insensitive' } },
          { entityType: { contains: 'book', mode: 'insensitive' } },
        ],
      });

      const value = result.value as { total: number; totalPages: number };
      expect(value.total).toBe(25);
      expect(value.totalPages).toBe(3);
    });

    it('applies the createdAt window when from/to are provided', async () => {
      prisma.client.auditLog.findMany.mockResolvedValue([]);
      prisma.client.auditLog.count.mockResolvedValue(0);
      const from = new Date('2025-01-01T00:00:00Z');
      const to = new Date('2025-01-31T23:59:59Z');

      await outcome(service.list({ page: 1, pageSize: 20, from, to }));

      expect(prisma.client.auditLog.findMany.mock.calls[0][0].where).toEqual({
        AND: [{ createdAt: { gte: from } }, { createdAt: { lte: to } }],
      });
    });
  });

  describe('stats', () => {
    it('returns total plus counts grouped by action and entityType', async () => {
      prisma.client.auditLog.groupBy
        .mockResolvedValueOnce([{ action: 'CREATE', _count: { _all: 5 } }])
        .mockResolvedValueOnce([{ entityType: 'BOOK', _count: { _all: 4 } }]);
      prisma.client.auditLog.count.mockResolvedValue(9);

      const result = await outcome(service.stats());

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({
        total: 9,
        byAction: [{ action: 'CREATE', count: 5 }],
        byEntityType: [{ entityType: 'BOOK', count: 4 }],
      });
    });
  });
});