import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../types/auth-user';

const FORBIDDEN_MESSAGE = 'Insufficient permissions for this operation';

/**
 * RBAC guard. Reads `@Roles()` metadata (handler or class) and validates the
 * authenticated principal's `role` claim against it.
 *
 * Runs after `JwtAuthGuard` (registered first in the same module): if no
 * principal is present the request is treated as unauthenticated and denied.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() on the route → any authenticated user may proceed.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = (context.switchToHttp().getRequest() as Request & { user?: AuthUser }).user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }
    return true;
  }
}