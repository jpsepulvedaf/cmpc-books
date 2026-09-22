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
    summary: 'Crear un libro (solo administradores). La disponibilidad se deriva del stock.',
  })
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

@Get()
  @ApiOperation({
    summary:
      'Listar libros (cualquier rol autenticado) con paginación en servidor, búsqueda, ' +
      'filtros exactos y ordenamiento por varios campos',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Coincidencia parcial (sin distinguir mayúsculas) en título, ISBN o nombre del autor',
  })
  @ApiQuery({
    name: 'genreId',
    required: false,
    schema: { type: 'integer' },
    description: 'Filtrar por el id exacto del género',
  })
  @ApiQuery({
    name: 'publisherId',
    required: false,
    schema: { type: 'integer' },
    description: 'Filtrar por el id exacto de la editorial',
  })
  @ApiQuery({
    name: 'authorId',
    required: false,
    schema: { type: 'integer' },
    description: 'Filtrar por el id exacto del autor',
  })
  @ApiQuery({
    name: 'availability',
    required: false,
    schema: { type: 'string', enum: ['IN_STOCK', 'OUT_OF_STOCK'] },
    description: 'Filtrar por la disponibilidad exacta del stock',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description:
      'Lista de campos separados por comas con el formato campo:dir, por ejemplo title:asc,publisher.name:desc. ' +
      'Permitidos: title, price, stock, createdAt, availability, author.name, publisher.name, genre.name',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 }, description: 'Número de página (comienza en 1)' })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', default: 20 }, description: 'Filas por página, de 1 a 100' })
  list(@Query() query: ListBooksQueryDto) {
    return this.booksService.list(query);
  }

  @Get('export')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary:
      'Exportar libros a CSV (solo administradores y operadores): los mismos filtros, búsqueda y ordenamiento ' +
      'que el listado, sin paginar y con un máximo de 1000 filas. CSV sin procesar con BOM UTF-8; omite el envoltorio de respuesta.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Coincidencia parcial (sin distinguir mayúsculas) en título, ISBN o nombre del autor',
  })
  @ApiQuery({
    name: 'genreId',
    required: false,
    schema: { type: 'integer' },
    description: 'Filtrar por el id exacto del género',
  })
  @ApiQuery({
    name: 'publisherId',
    required: false,
    schema: { type: 'integer' },
    description: 'Filtrar por el id exacto de la editorial',
  })
  @ApiQuery({
    name: 'authorId',
    required: false,
    schema: { type: 'integer' },
    description: 'Filtrar por el id exacto del autor',
  })
  @ApiQuery({
    name: 'availability',
    required: false,
    schema: { type: 'string', enum: ['IN_STOCK', 'OUT_OF_STOCK'] },
    description: 'Filtrar por la disponibilidad exacta del stock',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Lista de campos separados por comas con el formato campo:dir, por ejemplo title:asc,publisher.name:desc',
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
    summary: 'Obtener un libro por id (cualquier rol autenticado), con autor, editorial y género',
  })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.getById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Actualizar un libro parcialmente (solo administradores). Cambiar el stock recalcula la disponibilidad.',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Eliminar un libro de forma lógica (solo administradores): establece deletedAt y conserva la fila para auditoría.',
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
      'Subir la imagen de portada de un libro (solo administradores). JPEG/PNG/WebP de hasta 2 MB; ' +
      'devuelve el libro con la nueva imageUrl.',
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
    summary: 'Eliminar la portada del libro (solo administradores): limpia imageUrl y borra el archivo almacenado.',
  })
  async removeImage(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.booksService.removeImage(id);
  }
}