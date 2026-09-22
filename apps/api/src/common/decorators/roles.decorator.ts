import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Declares the role codes allowed to reach a route (or controller).
 * `RolesGuard` compares them against the JWT `role` claim.
 * Example: `@Roles('ADMIN')` or `@Roles('ADMIN', 'OPERADOR')`.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);