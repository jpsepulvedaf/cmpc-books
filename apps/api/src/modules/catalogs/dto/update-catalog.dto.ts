import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Partial update payload for the three light catalogs: an empty body is
 * allowed (no-op that returns the current row), and any provided name must
 * pass the same rules as the create DTO.
 */
export class UpdateCatalogDto {
  @ApiPropertyOptional({
    example: 'Gabriel García Márquez',
    description:
      'Nuevo nombre (entre 1 y 120 caracteres; se recortan los espacios al inicio y al final)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
}