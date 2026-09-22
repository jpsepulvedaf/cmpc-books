import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class CreateUserDto {
  @ApiProperty({ example: 'operator@cmpc.libros' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Maria Lopez' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'OPERADOR', enum: ['ADMIN', 'OPERADOR', 'CONSULTA'] })
  @IsString()
  @IsNotEmpty()
  roleCode: string;

  @ApiProperty({ example: 'Operador123' })
  @IsString()
  @IsNotEmpty()
  @Matches(PASSWORD_PATTERN, {
    message: 'Password must be at least 8 characters long and contain one uppercase letter and one number',
  })
  password: string;
}