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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateBookDto } from './dto/create-book.dto';
import { ExportBooksQueryDto } from './dto/export-books-query.dto';
import { ListBooksQueryDto } from './dto/list-books-query.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BooksService } from './books.service';
import { bookImageUploadOptions } from './image-upload.config';

/**
 * Book management. Writes are ADMIN-only; reading books (list / detail /
 * CSV export) is allowed for any authenticated role — except the CSV export,
 * which is restricted to ADMIN and OPERADOR (@Roles below), since it
 * extracts the whole catalog.
 *
 * Responses/errors use the global envelope (`{ok:true,data}` / `{ok:false,...}`)
 * provided by ResponseInterceptor and HttpExceptionFilter. The CSV export is
 * the exception: it writes the raw file through @Res() and returns nothing,
 * so the interceptor (which passes null/undefined through untouched) never
 * wraps it in `{ok:...}`.
 *
 * Route-order note: `@Get('export')` is declared BEFORE `@Get(':id')` so the
 * literal segment "export" is matched by the export handler and never by the
 * numeric-id detail route.
 */
@ApiTags('books')
@ApiBearerAuth('JWT')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a book (ADMIN). availability is derived from stock.',
  })
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

@Get()
  @ApiOperation({
    summary:
      'List books (any authenticated role) with server-side pagination, ' +
      'full-text-ish search, exact filters and multi-field sort',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Partial, case-insensitive match on title, ISBN or author name',
  })
  @ApiQuery({ name: 'genreId', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'publisherId', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'authorId', required: false, schema: { type: 'integer' } })
  @ApiQuery({
    name: 'availability',
    required: false,
    schema: { type: 'string', enum: ['IN_STOCK', 'OUT_OF_STOCK'] },
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description:
      'Comma-separated field:dir list, e.g. title:asc,publisher.name:desc. ' +
      'Allowed: title, price, stock, createdAt, availability, author.name, publisher.name, genre.name',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', default: 20 } })
  list(@Query() query: ListBooksQueryDto) {
    return this.booksService.list(query);
  }

  @Get('export')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary:
      'Export books to CSV (ADMIN/OPERADOR): same filters/search/sort as the ' +
      'list, unpaginated, capped at 1000 rows. Raw CSV with UTF-8 BOM, bypasses the envelope.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Partial, case-insensitive match on title, ISBN or author name',
  })
  @ApiQuery({ name: 'genreId', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'publisherId', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'authorId', required: false, schema: { type: 'integer' } })
  @ApiQuery({
    name: 'availability',
    required: false,
    schema: { type: 'string', enum: ['IN_STOCK', 'OUT_OF_STOCK'] },
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description:
      'Comma-separated field:dir list, e.g. title:asc,publisher.name:desc',
  })
  async exportCsv(
    @Query() query: ExportBooksQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.booksService.exportCsv(query);

    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="libros_${date}.csv"`,
    });
    // Write the raw file and return nothing: the ResponseInterceptor passes
    // null/undefined through untouched, so the CSV is NOT wrapped in {ok:...}.
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a book by id (any authenticated role), with author/publisher/genre',
  })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.getById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Partially update a book (ADMIN). Changing stock re-derives availability.',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Soft delete a book (ADMIN): sets deletedAt, keeps the row for audit.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.booksService.softDelete(id);
  }

  @Post(':id/image')
  @Roles('ADMIN')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', bookImageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Upload a book cover image (ADMIN). JPEG/PNG/WebP up to 2MB; ' +
      'returns the book with the new imageUrl.',
  })
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.booksService.uploadImage(id, file);
  }

  @Delete(':id/image')
  @Roles('ADMIN')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Remove the book cover (ADMIN): clears imageUrl and deletes the stored file.',
  })
  async removeImage(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.booksService.removeImage(id);
  }
}