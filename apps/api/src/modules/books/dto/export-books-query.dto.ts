import { BookFiltersQueryDto } from './book-filters-query.dto';

/**
 * Query DTO for GET /api/books/export — identical filters to the list, with
 * NO pagination: the CSV always covers every matching row (capped at
 * MAX_EXPORT_ROWS in BooksService).
 */
export class ExportBooksQueryDto extends BookFiltersQueryDto {}