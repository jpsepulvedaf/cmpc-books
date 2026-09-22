import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Shared query filters for the books catalog (list + CSV export).
 *
 * Subclasses ListBooksQueryDto adds pagination, ExportBooksQueryDto does not;
 * the WHERE clause is built ONCE in BooksService.buildWhere from these fields,
 * so both endpoints behave identically.
 *
 * `sort` is NOT validated here: fields are whitelisted in
 * BooksService.buildOrderBy, which answers INVALID_SORT_FIELD (400) with the
 * offending field in `details` — the parameter grammar lives next to Prisma.
 */
export class BookFiltersQueryDto {
  @ApiPropertyOptional({
    description:
      'Coincidencia parcial (sin distinguir mayúsculas) en título, ISBN o nombre del autor. ' +
      'Los libros eliminados de forma lógica nunca se devuelven.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ description: 'Id exacto del género' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId?: number;

  @ApiPropertyOptional({ description: 'Id exacto de la editorial' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  publisherId?: number;

  @ApiPropertyOptional({ description: 'Id exacto del autor' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorId?: number;

  @ApiPropertyOptional({
    enum: ['IN_STOCK', 'OUT_OF_STOCK'],
    description: 'Disponibilidad exacta del stock',
  })
  @IsOptional()
  @IsString()
  @IsIn(['IN_STOCK', 'OUT_OF_STOCK'])
  availability?: string;

  @ApiPropertyOptional({
    example: 'title:asc,publisher.name:desc',
    description:
      'Lista de campos separados por comas con el formato campo:dir (dir por defecto asc). Campos permitidos: ' +
      'title, price, stock, createdAt, availability, author.name, publisher.name, genre.name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sort?: string;
}