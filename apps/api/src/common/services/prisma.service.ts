import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

// Local dev fallback, mirrors prisma/seed.ts and prisma.config.ts: the
// Dockerized PostgreSQL (compose `db`, host port 5433). Overridden by
// DATABASE_URL.
const LOCAL_DATABASE_URL =
  'postgresql://cmpc:cmpc@localhost:5433/cmpc_books?schema=public';

/**
 * Shared Prisma access point. A single PrismaClient instance (Prisma 7 driver
 * adapter pattern) is created per application lifetime and released on
 * shutdown. Services inject this instead of building their own clients.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL') ?? LOCAL_DATABASE_URL;
    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  onModuleDestroy(): Promise<void> {
    return this.client.$disconnect();
  }
}