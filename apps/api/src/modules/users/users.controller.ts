import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

/**
 * Admin-only user management. Every route requires JWT (global guard) and the
 * ADMIN role (@Roles). The full response envelope comes from the global
 * ResponseInterceptor / HttpExceptionFilter.
 */
@ApiTags('users')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar usuarios (paginado, con búsqueda opcional; se excluyen los eliminados de forma lógica)',
  })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Crear un usuario (correo único, contraseña validada y cifrada con bcrypt)',
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar campos del perfil de usuario (fullName, roleCode, isActive)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un usuario de forma lógica (establece deletedAt)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.usersService.softDelete(id, user.sub);
  }
}