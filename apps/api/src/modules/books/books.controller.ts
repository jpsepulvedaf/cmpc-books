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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BooksService } from './books.service';
import { bookImageUploadOptions } from './image-upload.config';

/**
 * Book management. Writes are ADMIN-only; reading a single book is allowed
 * for any authenticated role (per the product contract the catalog list is
 * consumed by the web app with a Bearer token).
 *
 * Responses/errors use the global envelope (`{ok:true,data}` / `{ok:false,...}`)
 * provided by ResponseInterceptor and HttpExceptionFilter.
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