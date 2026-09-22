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
  @ApiPropertyOptional({ example: '978-3-16-148410-0' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  isbn?: string;

  @ApiPropertyOptional({ example: 'El jardín de las mariposas' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Una novela sobre memoria y reconciliación familiar.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 19.9 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price?: number;

  @ApiPropertyOptional({ example: 0, description: 'Setting stock to 0 flips availability' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 2 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  authorId?: number;

  @ApiPropertyOptional({ example: 2 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  publisherId?: number;

  @ApiPropertyOptional({ example: 2 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  genreId?: number;
}