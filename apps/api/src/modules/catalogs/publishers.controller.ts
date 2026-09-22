import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';

@ApiTags('catalogs')
@ApiBearerAuth('JWT')
@Controller('publishers')
export class PublishersController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar editoriales (id + nombre), ordenadas por nombre' })
  list() {
    return this.catalogsService.listPublishers();
  }
}