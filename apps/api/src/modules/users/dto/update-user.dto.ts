import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

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

  @ApiPropertyOptional({
    example: 'NuevaContrasena123',
    description: 'Nueva contraseña opcional (mín. 8 caracteres, una mayúscula y un número). Si se omite, la actual se mantiene.',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((_obj, value) => value !== undefined && value !== null && value !== '')
  @Matches(PASSWORD_PATTERN, {
    message:
      'Password must be at least 8 characters long and contain one uppercase letter and one number',
  })
  password?: string;
}