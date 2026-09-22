import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'isPublic';

/**
 * Opts a route (or controller) out of the global `JwtAuthGuard`.
 * Use sparingly — only for genuinely public endpoints (login, health).
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);