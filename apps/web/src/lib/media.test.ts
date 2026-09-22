import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from './media';

describe('resolveImageUrl', () => {
  it('returns undefined for empty values', () => {
    expect(resolveImageUrl(null)).toBeUndefined();
    expect(resolveImageUrl(undefined)).toBeUndefined();
    expect(resolveImageUrl('')).toBeUndefined();
  });

  it('passes absolute http(s) URLs through untouched', () => {
    expect(resolveImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(resolveImageUrl('http://cdn.example.com/a.png')).toBe('http://cdn.example.com/a.png');
  });

  it('resolves backend-relative paths against the media origin', () => {
    expect(resolveImageUrl('/uploads/books/uuid.png')).toBe('http://localhost:3000/uploads/books/uuid.png');
  });

  it('returns relative, non-slash paths as-is', () => {
    expect(resolveImageUrl('cover.png')).toBe('cover.png');
  });
});