import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query DTO for GET /api/audit (admin).
 * Mirrors the pagination style of the other list endpoints; adds an optional
 * free-text search (userName / action / entityType) and a createdAt window.
 */
export class ListAuditQueryDto {
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

  @ApiPropertyOptional({
    description: 'Case-insensitive match on userName, action or entityType',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Only rows with createdAt >= this date (ISO-8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'Only rows with createdAt <= this date (ISO-8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}