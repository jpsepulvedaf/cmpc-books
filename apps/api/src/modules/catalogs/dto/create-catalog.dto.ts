import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Shared create payload for the three light catalogs (authors, publishers,
 * genres). The name is trimmed at the boundary so validation runs on the exact
 * value that gets persisted.
 */
export class CreateCatalogDto {
  @ApiProperty({
    example: 'Gabriel García Márquez',
    description:
      'Nombre (entre 1 y 120 caracteres; se recortan los espacios al inicio y al final)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}