import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Payload for POST /api/books (ADMIN only).
 *
 * `availability` is intentionally NOT part of the DTO: it is derived
 * server-side from `stock` (IN_STOCK when stock > 0, otherwise OUT_OF_STOCK).
 */
export class CreateBookDto {
  @ApiPropertyOptional({
    example: '978-3-16-148410-0',
    description: 'ISBN opcional. Debe ser único en todos los libros, incluidos los eliminados de forma lógica.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  isbn?: string;

  @ApiProperty({ example: 'El jardín de las mariposas', description: 'Título del libro (obligatorio)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    example: 'Una novela sobre memoria y reconciliación familiar.',
    description: 'Descripción del libro (opcional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 19.9, description: 'Precio mayor que 0, con un máximo de 2 decimales' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiProperty({ example: 12, description: 'Copias físicas en stock, 0 o más' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 1, description: 'Id de un autor existente' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorId: number;

  @ApiProperty({ example: 1, description: 'Id de una editorial existente' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  publisherId: number;

  @ApiProperty({ example: 1, description: 'Id de un género existente' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId: number;
}