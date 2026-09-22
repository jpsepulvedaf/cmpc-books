import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

/**
 * Audit module:
 *  - Registers the AuditInterceptor as a GLOBAL interceptor (APP_INTERCEPTOR,
 *    the same mechanism CommonModule uses for ResponseInterceptor), so every
 *    request is screened and matched write operations are persisted.
 *  - Provides the ADMIN-only query surface (list + stats /api/audit).
 *  - Owns its PrismaService instance, matching the other feature modules.
 */
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    PrismaService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AuditModule {}