import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { BookFiltersQueryDto } from './book-filters-query.dto';

/**
 * Query DTO for GET /api/books (server-side pagination).
 *
 * page/pageSize are transformed with @Type(Number) so `?page=2&pageSize=5`
 * (always strings on the wire) are validated as integers.
 */
export class ListBooksQueryDto extends BookFiltersQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: '1-based page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, description: 'Rows per page, 1..100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}