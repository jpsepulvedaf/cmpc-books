import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const DEFAULT_JWT_SECRET = 'insecure-dev-secret-change-me';
const DEFAULT_JWT_EXPIRES_IN: SignOptions['expiresIn'] = '12h';

/**
 * Authentication + global security registration:
 *  - `JwtAuthGuard` and `RolesGuard` are registered as GLOBAL guards, so every
 *    endpoint requires a valid JWT by default (`@Public()` opts out).
 *  - `JwtService` is built from runtime configuration (secret/expiry come from
 *    env via ConfigService, which loads the .env files before DI resolution).
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    {
      provide: JwtService,
      useFactory: (config: ConfigService): JwtService => {
        const secret = config.get<string>('JWT_SECRET') ?? DEFAULT_JWT_SECRET;
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ??
          DEFAULT_JWT_EXPIRES_IN) as SignOptions['expiresIn'];
        return new JwtService({ secret, signOptions: { expiresIn } });
      },
      inject: [ConfigService],
    },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}