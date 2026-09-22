import { ConfigService } from '@nestjs/config';

/**
 * Swagger enablement policy.
 * Defaults to ENABLED. Set `SWAGGER_ENABLED=false` in production so the
 * Swagger module is never registered (no /api/docs route exists at all).
 */
export function swaggerEnabled(config: ConfigService): boolean {
  const raw = config.get<string>('SWAGGER_ENABLED');
  if (raw === undefined || raw === null || raw === '') {
    return true;
  }
  return raw.trim().toLowerCase() === 'true';
}