import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * Injects the authenticated principal (from the verified JWT, attached to the
 * request by `JwtAuthGuard`) into a controller method parameter.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    (ctx.switchToHttp().getRequest() as { user?: AuthUser }).user,
);