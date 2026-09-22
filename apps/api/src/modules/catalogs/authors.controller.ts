import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';

@ApiTags('catalogs')
@ApiBearerAuth('JWT')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar autores (id + nombre), ordenados por nombre' })
  list() {
    return this.catalogsService.listAuthors();
  }
}