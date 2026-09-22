import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Maria Lopez', description: 'Nombre completo del usuario' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @ApiPropertyOptional({
  example: 'CONSULTA',
  enum: ['ADMIN', 'OPERADOR', 'CONSULTA'],
  description: 'Nuevo código de rol del usuario',
})
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roleCode?: string;

  @ApiPropertyOptional({ example: true, description: 'Indica si la cuenta del usuario está activa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}