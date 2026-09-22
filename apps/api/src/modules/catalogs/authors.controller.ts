import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';

@ApiTags('catalogs')
@ApiBearerAuth('JWT')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'List authors (id + name), ordered by name' })
  list() {
    return this.catalogsService.listAuthors();
  }
}