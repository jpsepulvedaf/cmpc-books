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
 * Genre catalog. Reads are open to any authenticated role; the write routes
 * (create / rename / delete) are ADMIN-only. The response envelope
 * (`{ok:true,data}` / `{ok:false,...}`) comes from the global
 * ResponseInterceptor / HttpExceptionFilter.
 */
@ApiTags('genres')
@ApiBearerAuth('JWT')
@Controller('genres')
export class GenresController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar géneros (id + nombre), ordenados por nombre' })
  list() {
    return this.catalogsService.listGenres();
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Crear un género (solo administradores); el nombre debe ser único, por lo que un duplicado devuelve 409',
  })
  create(@Body() dto: CreateCatalogDto) {
    return this.catalogsService.createGenre(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Renombrar un género (solo administradores); 404 si no existe y 409 si el nuevo nombre ya lo usa otro género',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Id del género' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCatalogDto) {
    return this.catalogsService.updateGenre(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Eliminar un género (solo administradores); 409 si tiene libros asociados, 204 en caso contrario',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Id del género' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.catalogsService.removeGenre(id);
  }
}