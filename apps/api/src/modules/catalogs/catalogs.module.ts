import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthorsController } from './authors.controller';
import { GenresController } from './genres.controller';
import { PublishersController } from './publishers.controller';
import { CatalogsService } from './catalogs.service';

/**
 * Light catalogs (authors, publishers, genres): reads for any authenticated
 * role, ADMIN-only create/rename/delete. A single module keeps the three
 * trivial resources together without ceremony.
 */
@Module({
  controllers: [AuthorsController, PublishersController, GenresController],
  providers: [CatalogsService, PrismaService],
})
export class CatalogsModule {}