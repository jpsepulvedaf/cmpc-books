import { describe, expect, it } from 'vitest';
import { formatCLP, formatDateEs, formatDateTimeEs, availabilityLabel, roleLabel } from './format';

describe('formatCLP', () => {
  it('formats integers with dot thousands separator', () => {
    expect(formatCLP(19900)).toBe('$19.900');
    expect(formatCLP('19900')).toBe('$19.900');
  });

  it('formats decimals with comma decimals', () => {
    expect(formatCLP('19.9')).toBe('$19,9');
    expect(formatCLP('12,5')).toBe('$12,5');
  });

  it('keeps up to two decimals and trims trailing zeros', () => {
    expect(formatCLP('19900.50')).toBe('$19.900,5');
  });

  it('handles empty, null and NaN values', () => {
    expect(formatCLP(null)).toBe('$0');
    expect(formatCLP(undefined)).toBe('$0');
    expect(formatCLP('')).toBe('$0');
    expect(formatCLP('abc')).toBe('$0');
  });
});

describe('date formatting', () => {
  it('formats an ISO date in Spanish', () => {
    expect(formatDateEs('2026-09-22T00:00:00.000Z')).toMatch(/sep\w* 2026/);
  });

  it('returns an em dash for missing or invalid dates', () => {
    expect(formatDateEs(null)).toBe('—');
    expect(formatDateEs('not-a-date')).toBe('—');
  });

  it('formats an ISO timestamp with time', () => {
    expect(formatDateTimeEs('2026-09-22T17:30:00.000Z')).toMatch(/2026/);
    expect(formatDateTimeEs(new Date('2026-01-02T03:04:05Z'))).toMatch(/ene 2026/);
  });
});

describe('label helpers', () => {
  it('maps availability to Spanish labels', () => {
    expect(availabilityLabel('IN_STOCK')).toBe('Disponible');
    expect(availabilityLabel('OUT_OF_STOCK')).toBe('Agotado');
    expect(availabilityLabel(undefined)).toBe('—');
  });

  it('maps roles to Spanish labels', () => {
    expect(roleLabel('ADMIN')).toBe('Administrador');
    expect(roleLabel('OPERADOR')).toBe('Operador');
  });
});