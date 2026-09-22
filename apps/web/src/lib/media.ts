// Resolves backend-relative media URLs to fetchable absolute URLs.
//
// The API returns imageUrl values relative to its own origin
// (e.g. "/uploads/books/<uuid>.png"). The web server only proxies /api, so in
// development we resolve media against the API origin (default localhost:3000;
// override with VITE_MEDIA_ORIGIN). In production, point VITE_MEDIA_ORIGIN at
// the API origin or a CDN serving /uploads.

const MEDIA_ORIGIN =
  typeof import.meta.env !== 'undefined' && import.meta.env.VITE_MEDIA_ORIGIN
    ? String(import.meta.env.VITE_MEDIA_ORIGIN)
    : 'http://localhost:3000';

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${MEDIA_ORIGIN}${url}`;
  return url;
}