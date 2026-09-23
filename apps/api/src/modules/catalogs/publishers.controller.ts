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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { CatalogsService } from './catalogs.service';

/**
 * Publisher catalog. Reads are open to any authenticated role; the write
 * routes (create / rename / delete) are ADMIN-only. The response envelope
 * (`{ok:true,data}` / `{ok:false,...}`) comes from the global
 * ResponseInterceptor / HttpExceptionFilter.
 */
@ApiTags('publishers')
@ApiBearerAuth('JWT')
@Controller('publishers')
export class PublishersController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar editoriales (id + nombre), ordenadas por nombre' })
  list() {
    return this.catalogsService.listPublishers();
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Crear una editorial (solo administradores); el nombre debe ser único, por lo que un duplicado devuelve 409',
  })
  create(@Body() dto: CreateCatalogDto) {
    return this.catalogsService.createPublisher(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Renombrar una editorial (solo administradores); 404 si no existe y 409 si el nuevo nombre ya lo usa otra editorial',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Id de la editorial' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCatalogDto) {
    return this.catalogsService.updatePublisher(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Eliminar una editorial (solo administradores); 409 si tiene libros asociados, 204 en caso contrario',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Id de la editorial' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.catalogsService.removePublisher(id);
  }
}