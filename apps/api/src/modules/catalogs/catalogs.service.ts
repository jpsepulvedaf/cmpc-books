import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';

export interface CatalogItem {
  id: number;
  name: string;
}

/** The three light catalog resources (authors / publishers / genres). */
export type CatalogKind = 'author' | 'publisher' | 'genre';

/**
 * Light catalogs (authors / publishers / genres) powering the frontend
 * selectors and forms. Read routes expose only `id + name` ordered by name;
 * write routes are ADMIN-only and protect referential integrity by blocking
 * deletes of catalog rows that still have books attached. Every route
 * requires a valid JWT through the global JwtAuthGuard.
 */
@Injectable()
export class CatalogsService {
  // Structured operational logging with a module context (Nest native Logger —
  // simple key=value English lines with id/kind, never secrets).
  private readonly logger = new Logger('CatalogsService');

  constructor(private readonly prisma: PrismaService) {}

  // ── Reads (kept id+name, ordered by name) ─────────────────────────────

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

  // ── Creates (ADMIN) ───────────────────────────────────────────────────

  createAuthor(dto: CreateCatalogDto): Promise<CatalogItem> {
    return this.create('author', dto);
  }

  createPublisher(dto: CreateCatalogDto): Promise<CatalogItem> {
    return this.create('publisher', dto);
  }

  createGenre(dto: CreateCatalogDto): Promise<CatalogItem> {
    return this.create('genre', dto);
  }

  // ── Updates / rename (ADMIN) ──────────────────────────────────────────

  updateAuthor(id: number, dto: UpdateCatalogDto): Promise<CatalogItem> {
    return this.update('author', id, dto);
  }

  updatePublisher(id: number, dto: UpdateCatalogDto): Promise<CatalogItem> {
    return this.update('publisher', id, dto);
  }

  updateGenre(id: number, dto: UpdateCatalogDto): Promise<CatalogItem> {
    return this.update('genre', id, dto);
  }

  // ── Deletes (ADMIN) ───────────────────────────────────────────────────

  removeAuthor(id: number): Promise<void> {
    return this.remove('author', id);
  }

  removePublisher(id: number): Promise<void> {
    return this.remove('publisher', id);
  }

  removeGenre(id: number): Promise<void> {
    return this.remove('genre', id);
  }

  // ── Shared write core ─────────────────────────────────────────────────

  private async create(kind: CatalogKind, dto: CreateCatalogDto): Promise<CatalogItem> {
    const name = dto.name.trim();
    await this.assertNameAvailable(kind, name);

    try {
      const row = await this.createRow(kind, name);
      this.logger.log(`Catalog created — kind=${kind} id=${row.id} name=${row.name}`);
      return row;
    } catch (error) {
      // Safety net: the DB unique index (P2002) also maps to NAME_EXISTS.
      if (this.isUniqueConstraintViolation(error)) {
        throw new ApiException(409, 'NAME_EXISTS', this.nameExistsMessage(kind));
      }
      throw error;
    }
  }

  private async update(kind: CatalogKind, id: number, dto: UpdateCatalogDto): Promise<CatalogItem> {
    const target = await this.findExisting(kind, id);
    // PATCH with an empty body is a legal no-op: return the current row.
    if (dto.name === undefined) {
      return { id: target.id, name: target.name };
    }

    const name = dto.name.trim();
    await this.assertNameAvailable(kind, name, target.id);

    try {
      const row = await this.updateRow(kind, id, name);
      this.logger.log(`Catalog updated — kind=${kind} id=${row.id} name=${row.name}`);
      return row;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ApiException(409, 'NAME_EXISTS', this.nameExistsMessage(kind));
      }
      throw error;
    }
  }

  private async remove(kind: CatalogKind, id: number): Promise<void> {
    const target = await this.findExisting(kind, id);

    const where: Prisma.BookWhereInput =
      kind === 'author'
        ? { authorId: id }
        : kind === 'publisher'
          ? { publisherId: id }
          : { genreId: id };
    const references = await this.prisma.client.book.count({ where });
    if (references > 0) {
      throw new ApiException(409, 'CATALOG_IN_USE', this.inUseMessage(kind, references));
    }

    await this.deleteRow(kind, target.id);
    this.logger.log(`Catalog deleted — kind=${kind} id=${target.id}`);
  }

  // ── Row helpers (typed per resource) ──────────────────────────────────

  private async findExisting(kind: CatalogKind, id: number): Promise<CatalogItem> {
    const row = await this.findUniqueRow(kind, id);
    if (!row) {
      throw new ApiException(404, 'CATALOG_NOT_FOUND', this.notFoundMessage(kind));
    }
    return row;
  }

  /**
   * Case-insensitive duplicate check (better DX than the raw unique-index
   * error). With `exceptId` the target row itself is excluded, so renaming a
   * row to its own current name stays legal.
   */
  private assertNameAvailable(
    kind: CatalogKind,
    name: string,
    exceptId?: number,
  ): Promise<void> {
    const where: { name: { equals: string; mode: 'insensitive' }; id?: { not: number } } = {
      name: { equals: name, mode: 'insensitive' },
    };
    if (exceptId !== undefined) {
      where.id = { not: exceptId };
    }
    return this.findByName(kind, where).then((existing) => {
      if (existing) {
        throw new ApiException(409, 'NAME_EXISTS', this.nameExistsMessage(kind));
      }
    });
  }

  private createRow(kind: CatalogKind, name: string): Promise<CatalogItem> {
    const select = { id: true, name: true } as const;
    switch (kind) {
      case 'author':
        return this.prisma.client.author.create({ data: { name }, select });
      case 'publisher':
        return this.prisma.client.publisher.create({ data: { name }, select });
      case 'genre':
        return this.prisma.client.genre.create({ data: { name }, select });
    }
  }

  private updateRow(kind: CatalogKind, id: number, name: string): Promise<CatalogItem> {
    const select = { id: true, name: true } as const;
    switch (kind) {
      case 'author':
        return this.prisma.client.author.update({ where: { id }, data: { name }, select });
      case 'publisher':
        return this.prisma.client.publisher.update({ where: { id }, data: { name }, select });
      case 'genre':
        return this.prisma.client.genre.update({ where: { id }, data: { name }, select });
    }
  }

  private findUniqueRow(kind: CatalogKind, id: number): Promise<CatalogItem | null> {
    const select = { id: true, name: true } as const;
    switch (kind) {
      case 'author':
        return this.prisma.client.author.findUnique({ where: { id }, select });
      case 'publisher':
        return this.prisma.client.publisher.findUnique({ where: { id }, select });
      case 'genre':
        return this.prisma.client.genre.findUnique({ where: { id }, select });
    }
  }

  private findByName(
    kind: CatalogKind,
    where: { name: { equals: string; mode: 'insensitive' }; id?: { not: number } },
  ): Promise<{ id: number } | null> {
    switch (kind) {
      case 'author':
        return this.prisma.client.author.findFirst({ where, select: { id: true } });
      case 'publisher':
        return this.prisma.client.publisher.findFirst({ where, select: { id: true } });
      case 'genre':
        return this.prisma.client.genre.findFirst({ where, select: { id: true } });
    }
  }

  private deleteRow(kind: CatalogKind, id: number): Promise<unknown> {
    switch (kind) {
      case 'author':
        return this.prisma.client.author.delete({ where: { id } });
      case 'publisher':
        return this.prisma.client.publisher.delete({ where: { id } });
      case 'genre':
        return this.prisma.client.genre.delete({ where: { id } });
    }
  }

  // ── Messages ──────────────────────────────────────────────────────────

  private resourceLabel(kind: CatalogKind): string {
    switch (kind) {
      case 'author':
        return 'author';
      case 'publisher':
        return 'publisher';
      case 'genre':
        return 'genre';
    }
  }

  private nameExistsMessage(kind: CatalogKind): string {
    const article = kind === 'author' ? 'An' : 'A';
    return `${article} ${this.resourceLabel(kind)} with this name already exists`;
  }

  private notFoundMessage(kind: CatalogKind): string {
    const label = this.resourceLabel(kind);
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} not found`;
  }

  private inUseMessage(kind: CatalogKind, count: number): string {
    return `Cannot delete this ${this.resourceLabel(kind)}: ${count} book(s) reference it`;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}