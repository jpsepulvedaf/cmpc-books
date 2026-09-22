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
      'Partial, case-insensitive match on title, ISBN, or author name. ' +
      'Soft-deleted books are never returned.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ description: 'Exact Genre id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId?: number;

  @ApiPropertyOptional({ description: 'Exact Publisher id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  publisherId?: number;

  @ApiPropertyOptional({ description: 'Exact Author id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorId?: number;

  @ApiPropertyOptional({
    enum: ['IN_STOCK', 'OUT_OF_STOCK'],
    description: 'Exact stock availability',
  })
  @IsOptional()
  @IsString()
  @IsIn(['IN_STOCK', 'OUT_OF_STOCK'])
  availability?: string;

  @ApiPropertyOptional({
    example: 'title:asc,publisher.name:desc',
    description:
      'Comma-separated list of `field:dir` (dir defaults to asc). Allowed fields: ' +
      'title, price, stock, createdAt, availability, author.name, publisher.name, genre.name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sort?: string;
}