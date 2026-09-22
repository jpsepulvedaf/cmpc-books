import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';

@ApiTags('catalogs')
@ApiBearerAuth('JWT')
@Controller('genres')
export class GenresController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar géneros (id + nombre), ordenados por nombre' })
  list() {
    return this.catalogsService.listGenres();
  }
}