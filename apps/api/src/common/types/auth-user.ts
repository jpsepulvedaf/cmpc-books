/**
 * Authenticated principal extracted from the verified JWT and attached to the
 * request by `JwtAuthGuard`. Injected into handlers via `@CurrentUser()`.
 */
export interface AuthUser {
  /** User id (JWT `sub` claim). */
  sub: number;
  email: string;
  /** Role code (JWT `role` claim), e.g. ADMIN | OPERADOR | CONSULTA. */
  role: string;
}