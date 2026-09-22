import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';

/**
 * Uploaded files live in the application working dir (apps/api in dev).
 * They are served back read-only by the static route registered in main.ts.
 * The folder is git-ignored (runtime artifact) and must be a persistent
 * volume in production containers.
 */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

/** Book covers folder, mirrored publicly under /uploads/books/<file>. */
export const BOOKS_UPLOAD_DIR = join(UPLOADS_ROOT, 'books');

/** Public URL prefix stored in Book.imageUrl. */
export const IMAGE_URL_PREFIX = '/uploads/books';

/** Allowed cover formats (product requirement). */
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Max cover size in bytes — 2MB per the product requirement. */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** Canonical extension per allowed MIME; the client filename is never trusted. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function isAllowedImageMime(mime: string | undefined): boolean {
  return typeof mime === 'string' && ALLOWED_IMAGE_MIMES.has(mime);
}

/** Creates the upload folder tree. Called once at bootstrap; idempotent. */
export async function ensureUploadDirs(): Promise<void> {
  await mkdir(BOOKS_UPLOAD_DIR, { recursive: true });
}

/**
 * Multer options for POST /api/books/:id/image:
 *  - diskStorage writes into uploads/books under a uuid + MIME-derived
 *    extension, so file names are unique and never come from the client.
 *  - fileFilter silently skips non-allowed types; the controller answers
 *    400 INVALID_IMAGE in that case.
 *  - limits.fileSize aborts oversize uploads (mapped by Nest to 413
 *    PAYLOAD_TOO_LARGE before reaching the controller).
 */
export const bookImageUploadOptions: MulterOptions = {
  storage: multer.diskStorage({
    destination: BOOKS_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${EXTENSION_BY_MIME[file.mimetype] ?? '.bin'}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => cb(null, isAllowedImageMime(file.mimetype)),
};