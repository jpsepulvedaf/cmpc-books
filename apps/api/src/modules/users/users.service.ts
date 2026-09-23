import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicUser } from '../auth/auth.service';
import { AuthUser } from '../../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;

export interface ListedUser {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  role: { code: string; name: string };
  createdAt: Date;
}

@Injectable()
export class UsersService {
  // Structured operational logging with a module context (Nest native Logger —
  // no extra dependency; key=value English lines with userId, never secrets).
  private readonly logger = new Logger('UsersService');

  constructor(private readonly prisma: PrismaService) {}

  /** Paginated, soft-delete-filtered user list with optional search. */
  async list(
    query: ListUsersQueryDto,
  ): Promise<{
    items: ListedUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, search } = query;
    const where = this.buildWhere(search);

    const [users, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        include: { role: true },
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      items: users.map((u) => this.toListedUser(u)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      // Unique email protects the integrity of the table, including soft-deleted rows.
      throw new ApiException(409, 'EMAIL_EXISTS', 'A user with this email already exists');
    }

    const role = await this.prisma.client.role.findUnique({ where: { code: dto.roleCode } });
    if (!role) {
      throw new ApiException(400, 'INVALID_ROLE', 'Role code is not valid');
    }

    const passwordHash = bcrypt.hashSync(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        isActive: true,
        roleId: role.id,
      },
      include: { role: true },
    });

    // Log the identifier only — never the password or hashes.
    this.logger.log(`User created — userId=${user.id} email=${user.email} role=${user.role.code}`);
    return this.toPublicUser(user);
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    actor: AuthUser,
  ): Promise<PublicUser> {
    const target = await this.findActive(id);
    if (dto.isActive === false && target.id === actor.sub) {
      throw new ApiException(
        409,
        'SELF_ACTION_FORBIDDEN',
        'You cannot deactivate your own account',
      );
    }

    // ── Critical operation: transactional integrity ─────────────────────────
    // Changing the profile (fullName/role) plus an optional password reset are
    // written together with the audit trail in ONE database transaction, so a
    // mid-flight failure cannot leave the user row updated without its audit
    // record (or worse, a password hash written but the profile not).
    return this.prisma.client.$transaction(async (tx) => {
      const data: { fullName?: string; isActive?: boolean; roleId?: number; passwordHash?: string } = {};
      if (dto.fullName !== undefined) data.fullName = dto.fullName;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.roleCode !== undefined) {
        const role = await tx.role.findUnique({ where: { code: dto.roleCode } });
        if (!role) {
          throw new ApiException(400, 'INVALID_ROLE', 'Role code is not valid');
        }
        data.roleId = role.id;
      }
      // Empty string means "keep the current password"; only rehash a real one.
      if (dto.password !== undefined && dto.password.trim().length > 0) {
        data.passwordHash = bcrypt.hashSync(dto.password, BCRYPT_ROUNDS);
      }

      const user = await tx.user.update({
        where: { id },
        data,
        include: { role: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'USER',
          entityId: String(id),
          user: { connect: { id: actor.sub } },
          userName: actor.email,
          userRole: actor.role,
          details: { changedFields: Object.keys(data) },
        },
      });

      this.logger.log(`User updated — userId=${id} by actorId=${actor.sub} (transactional audit)`);
      return this.toPublicUser(user);
    });
  }

  /** Soft delete: sets deletedAt so the row survives for audit purposes. */
  async softDelete(id: number, actorId: number): Promise<void> {
    const target = await this.findActive(id);
    if (target.id === actorId) {
      throw new ApiException(409, 'SELF_ACTION_FORBIDDEN', 'You cannot delete your own account');
    }
    await this.prisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`User soft-deleted — userId=${id} by actorId=${actorId}`);
  }

  private async findActive(id: number) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new ApiException(404, 'USER_NOT_FOUND', 'User not found');
    }
    return user;
  }

  private buildWhere(search?: string): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { fullName: { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private toListedUser(user: {
    id: number;
    email: string;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
    role: { code: string; name: string };
  }): ListedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      role: { code: user.role.code, name: user.role.name },
      createdAt: user.createdAt,
    };
  }

  private toPublicUser(user: {
    id: number;
    email: string;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
    role: { code: string };
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}