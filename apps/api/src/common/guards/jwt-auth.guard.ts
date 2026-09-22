import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';

const UNAUTHORIZED_MESSAGE = 'Invalid or expired token';

/**
 * Global authentication guard. Every endpoint requires a valid `Bearer` JWT
 * by default; routes marked with `@Public()` are skipped.
 *
 * On success it verifies the JWT and attaches the AuthUser (sub/email/role)
 * to `request.user`, which `@CurrentUser()` and `RolesGuard` consume.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const token = header.slice(7).trim();
    let payload: Pick<AuthUser, 'sub' | 'email' | 'role'> | undefined;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const authUser: AuthUser = {
      sub: Number(payload.sub),
      email: payload.email,
      role: payload.role,
    };
    (request as Request & { user: AuthUser }).user = authUser;
    return true;
  }
}