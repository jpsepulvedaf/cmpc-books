import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

export interface CatalogItem {
  id: number;
  name: string;
}

/**
 * Read-only light catalogs (authors / publishers / genres) that power the
 * frontend selectors and forms. Only `id + name` are exposed, ordered by name.
 * Every route requires a valid JWT through the global JwtAuthGuard — the web
 * app sends the Bearer token it obtained at login.
 */
@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  listAuthors(): Promise<CatalogItem[]> {
    return this.prisma.client.author.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listPublishers(): Promise<CatalogItem[]> {
    return this.prisma.client.publisher.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listGenres(): Promise<CatalogItem[]> {
    return this.prisma.client.genre.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}