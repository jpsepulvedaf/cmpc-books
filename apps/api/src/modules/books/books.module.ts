import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, PrismaService],
})
export class BooksModule {}