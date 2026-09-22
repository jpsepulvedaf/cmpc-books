// Formatting helpers: Chilean-style currency, es-ES dates, labels in Spanish.

import type { Availability, RoleCode } from './types';
import { AVAILABILITY_LABELS, ROLE_LABELS } from './types';

/**
 * Formats a numeric string/decimal as Chilean-style currency using dot
 * thousands and comma decimals, e.g. 19900 -> "$19.900", 19.9 -> "$19,9".
 */
export function formatCLP(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '$0';
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) return '$0';
  const fixed = numeric.toFixed(2);
  const [integer, fraction] = fixed.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmedFraction = (fraction ?? '').replace(/0+$/, '');
  return `$ ${grouped}${trimmedFraction ? `,${trimmedFraction}` : ''}`.replace('$ ', '$');
}

const ES_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const ES_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats an ISO date as e.g. "22 sep 2026". */
export function formatDateEs(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? ES_DATE_FORMATTER.format(date) : '—';
}

/** Formats an ISO timestamp as e.g. "22 sep 2026, 17:30". */
export function formatDateTimeEs(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? ES_DATE_TIME_FORMATTER.format(date) : '—';
}

export function availabilityLabel(availability: Availability | undefined): string {
  return availability ? AVAILABILITY_LABELS[availability] : '—';
}

export function roleLabel(role: RoleCode): string {
  return ROLE_LABELS[role] ?? role;
}