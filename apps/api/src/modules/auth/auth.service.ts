import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { LoginRequestDto } from './dto/login-request.dto';

export interface AuthUserPayload {
  sub: number;
  email: string;
  role: string;
}

export interface PublicUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates credentials with a single, non-revealing error message
   * (never discloses whether the email or the password was wrong).
   */
  async login(dto: LoginRequestDto): Promise<{ token: string; user: PublicUser }> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (
      !user ||
      user.deletedAt !== null ||
      !bcrypt.compareSync(dto.password, user.passwordHash)
    ) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);
    }

    if (!user.isActive) {
      throw new ApiException(403, 'USER_INACTIVE', 'User account is inactive');
    }

    const payload: AuthUserPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
    };
    const token = await this.jwtService.signAsync(payload);

    return { token, user: this.toPublicUser(user) };
  }

  /** Loads the authenticated user's complete, current profile from the DB. */
  async me(userId: number): Promise<PublicUser> {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: true },
    });
    if (!user) {
      throw new ApiException(404, 'USER_NOT_FOUND', 'User not found');
    }
    return this.toPublicUser(user);
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