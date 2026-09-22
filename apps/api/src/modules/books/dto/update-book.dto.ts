import { ApiPropertyOptional } from '@nestjs/swagger';
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
 * Payload for PATCH /api/books/:id (ADMIN only). Every field is optional:
 * the update only touches the fields that were sent. When `stock` changes,
 * `availability` is re-derived from the new value.
 */
export class UpdateBookDto {
  @ApiPropertyOptional({ example: '978-3-16-148410-0', description: 'ISBN del libro (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  isbn?: string;

  @ApiPropertyOptional({ example: 'El jardín de las mariposas', description: 'Título del libro (opcional)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
  example: 'Una novela sobre memoria y reconciliación familiar.',
  description: 'Descripción del libro (opcional)',
})
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 19.9, description: 'Precio mayor que 0, con un máximo de 2 decimales' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price?: number;

  @ApiPropertyOptional({
  example: 0,
  description: 'Copias físicas en stock; establecer el stock en 0 cambia la disponibilidad a OUT_OF_STOCK',
})
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 2, description: 'Id de un autor existente' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  authorId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Id de una editorial existente' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  publisherId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Id de un género existente' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  genreId?: number;
}