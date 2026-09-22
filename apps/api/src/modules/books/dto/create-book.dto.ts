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
    description:
      'Optional ISBN. Must be unique across every book, including soft-deleted rows.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  isbn?: string;

  @ApiProperty({ example: 'El jardín de las mariposas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    example: 'Una novela sobre memoria y reconciliación familiar.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 19.9, description: 'Price must be greater than 0, max 2 decimals' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiProperty({ example: 12, description: 'Physical copies in stock, 0 or more' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 1, description: 'Existing author id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorId: number;

  @ApiProperty({ example: 1, description: 'Existing publisher id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  publisherId: number;

  @ApiProperty({ example: 1, description: 'Existing genre id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId: number;
}