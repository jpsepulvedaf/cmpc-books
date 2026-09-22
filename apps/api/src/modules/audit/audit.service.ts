import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

/**
 * Shape accepted by `AuditService.record`. Every field is whitelisted and
 * built by the interceptor; raw request bodies are NEVER passed in.
 */
export interface AuditRecordInput {
  /** User id (JWT `sub`). Null for anonymous operations such as LOGIN. */
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string; // CREATE | UPDATE | DELETE | LOGIN | EXPORT | ...
  entityType: string; // BOOK | USER | AUTH | ...
  entityId?: string;
  method?: string;
  path?: string;
  /** Sanitized metadata only — never passwords, tokens or headers. */
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Persistence layer for the audit trail.
 *
 * FAIL-TOLERANT BY DESIGN (same criterion as docs/architecture.md §12.6 —
 * "Audit writes are best-effort, never block the business transaction"):
 * a failed audit write is logged under the `AUDIT` context and swallowed, so
 * it can NEVER break — or even delay — the operation it describes. Callers
 * are expected to fire-and-forget (see AuditInterceptor).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      const data: Prisma.AuditLogCreateInput = {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress,
        userName: input.userName,
        userRole: input.userRole,
      };
      if (input.userId !== undefined) {
        data.user = { connect: { id: input.userId } };
      }
      if (input.details !== undefined) {
        data.details = input.details as Prisma.InputJsonValue;
      }
      await this.prisma.client.auditLog.create({ data });
    } catch (error) {
      // Audit is best-effort: log and continue, never propagate.
      this.logger.warn(
        `Audit write failed (${input.action}/${input.entityType}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Paginated trail, newest first, with search + optional createdAt window. */
  async list(query: ListAuditQueryDto) {
    const { page, pageSize } = query;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Summary: total records, plus counts grouped by action and entityType. */
  async stats() {
    const [byAction, byEntityType, total] = await Promise.all([
      this.prisma.client.auditLog.groupBy({
        by: ['action'],
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      this.prisma.client.auditLog.groupBy({
        by: ['entityType'],
        _count: { _all: true },
        orderBy: { _count: { entityType: 'desc' } },
      }),
      this.prisma.client.auditLog.count(),
    ]);

    return {
      total,
      byAction: byAction.map((row) => ({ action: row.action, count: row._count._all })),
      byEntityType: byEntityType.map((row) => ({
        entityType: row.entityType,
        count: row._count._all,
      })),
    };
  }

  private buildWhere(query: ListAuditQueryDto): Prisma.AuditLogWhereInput {
    const filters: Prisma.AuditLogWhereInput[] = [];

    const term = query.search?.trim();
    if (term) {
      filters.push({
        OR: [
          { userName: { contains: term, mode: 'insensitive' } },
          { action: { contains: term, mode: 'insensitive' } },
          { entityType: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    if (query.from !== undefined) filters.push({ createdAt: { gte: query.from } });
    if (query.to !== undefined) filters.push({ createdAt: { lte: query.to } });

    return filters.length <= 1
      ? filters[0] ?? {}
      : { AND: filters };
  }
}