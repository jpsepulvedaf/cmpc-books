import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthorsController } from './authors.controller';
import { GenresController } from './genres.controller';
import { PublishersController } from './publishers.controller';
import { CatalogsService } from './catalogs.service';

/**
 * Read-only light catalogs (authors, publishers, genres). A single module
 * keeps the three trivial read-only resources together without ceremony.
 */
@Module({
  controllers: [AuthorsController, PublishersController, GenresController],
  providers: [CatalogsService, PrismaService],
})
export class CatalogsModule {}