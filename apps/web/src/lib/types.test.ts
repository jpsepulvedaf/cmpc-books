import { describe, expect, it } from 'vitest';
import {
  ACTION_LABELS,
  AVAILABILITY_LABELS,
  BOOK_SORT_FIELDS,
  ENTITY_LABELS,
  ROLE_LABELS,
  ROLE_OPTIONS,
  translateAction,
  translateEntityType,
} from './types';

describe('label maps', () => {
  it('exposes Spanish role labels and options', () => {
    expect(ROLE_LABELS.ADMIN).toBe('Administrador');
    expect(ROLE_OPTIONS.map((option) => option.value)).toEqual(['ADMIN', 'OPERADOR', 'CONSULTA']);
  });

  it('exposes Spanish availability labels', () => {
    expect(AVAILABILITY_LABELS.IN_STOCK).toBe('Disponible');
    expect(AVAILABILITY_LABELS.OUT_OF_STOCK).toBe('Agotado');
  });

  it('exposes Spanish sort field labels', () => {
    expect(BOOK_SORT_FIELDS.title).toBe('Título');
    expect(BOOK_SORT_FIELDS['author.name']).toBe('Autor');
  });
});

describe('translateAction / translateEntityType', () => {
  it('translates known actions and falls back to the raw value', () => {
    expect(translateAction('LOGIN')).toBe('Inicio de sesión');
    expect(translateAction('PURGE')).toBe('PURGE');
    expect(ACTION_LABELS.CREATE).toBe('Creación');
  });

  it('translates known entity types and falls back to the raw value', () => {
    expect(translateEntityType('BOOK')).toBe('Libro');
    expect(translateEntityType('PAYMENT')).toBe('PAYMENT');
    expect(ENTITY_LABELS.USER).toBe('Usuario');
  });
});