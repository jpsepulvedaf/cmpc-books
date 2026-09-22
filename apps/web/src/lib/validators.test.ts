import { describe, expect, it } from 'vitest';
import {
  isValidIsbn,
  isValidPrice,
  isValidStock,
  normalizeDecimal,
  toBookPayload,
  toLoginPayload,
  zodField,
  bookSchemas,
  loginSchemas,
  userSchemas,
  EMPTY_BOOK_FORM,
  EMPTY_USER_FORM,
  PASSWORD_HINT,
} from './validators';

describe('zodField (zod → react-hook-form bridge)', () => {
  it('returns the Spanish message for a required field left empty', () => {
    const validate = zodField(loginSchemas.email);
    expect(validate('', {})).toBe('El correo es obligatorio');
  });

  it('returns the pattern message for an invalid value', () => {
    const validate = zodField(loginSchemas.email);
    expect(validate('not-an-email', {})).toBe('Ingresa un correo electrónico válido');
  });

  it('returns the Spanish message for an empty title field', () => {
    const validate = zodField(bookSchemas.title);
    expect(validate('   ', {})).toBe('El título es obligatorio');
  });

  it('returns undefined for a valid value', () => {
    const validate = zodField(loginSchemas.password);
    expect(validate('secreto123', {})).toBeUndefined();
  });

  it('never crashes and returns a Spanish string for invalid value types', () => {
    const validate = zodField(userSchemas.email);
    const message = validate(42, {});
    expect(typeof message).toBe('string');
    expect(message!.length).toBeGreaterThan(0);
  });
});

describe('decimal/ISBN/price/stock parsers', () => {
  it('normalizeDecimal converts a comma decimal separator', () => {
    expect(normalizeDecimal(' 19,5 ')).toBe('19.5');
    expect(normalizeDecimal('19.5')).toBe('19.5');
    expect(normalizeDecimal('  0  ')).toBe('0');
  });

  it('isValidIsbn accepts 10/13 digits with dashes and spaces, empty is optional', () => {
    expect(isValidIsbn('978-3-16-148410-0')).toBe(true);
    expect(isValidIsbn('0306406152')).toBe(true);
    expect(isValidIsbn('')).toBe(true);
    expect(isValidIsbn('123')).toBe(false);
    expect(isValidIsbn('123456789012345')).toBe(false);
    expect(isValidIsbn('abcdefghij')).toBe(false);
  });

  it('isValidPrice requires a positive number with up to 2 decimals', () => {
    expect(isValidPrice('19900')).toBe(true);
    expect(isValidPrice('12,5')).toBe(true);
    expect(isValidPrice('0')).toBe(false);
    expect(isValidPrice('-5')).toBe(false);
    expect(isValidPrice('abc')).toBe(false);
    expect(isValidPrice('1.999')).toBe(false); // > 2 decimals
  });

  it('isValidStock requires a non-negative integer', () => {
    expect(isValidStock('0')).toBe(true);
    expect(isValidStock('12')).toBe(true);
    expect(isValidStock('-1')).toBe(false);
    expect(isValidStock('1.5')).toBe(false);
    expect(isValidStock('abc')).toBe(false);
  });
});

describe('book schemas', () => {
  it('caps the title at 255 characters', () => {
    const validate = zodField(bookSchemas.title);
    expect(validate('x'.repeat(256), {})).toBe('El título no puede superar los 255 caracteres');
  });

  it('validates ISBN format via refine', () => {
    const validate = zodField(bookSchemas.isbn);
    expect(validate('978-3-16-148410-0', {})).toBeUndefined();
    expect(validate('12345', {})).toBe('El ISBN debe tener 10 o 13 dígitos');
  });

  it('validates price and stock messages', () => {
    expect(zodField(bookSchemas.price)('0', {})).toBe(
      'Ingresa un precio mayor que 0 con hasta 2 decimales'
    );
    expect(zodField(bookSchemas.stock)('-1', {})).toBe(
      'El stock debe ser un número entero mayor o igual a 0'
    );
  });

  it('requires catalog selects to be chosen', () => {
    expect(zodField(bookSchemas.authorId)('', {})).toBe('Selecciona un autor');
    expect(zodField(bookSchemas.publisherId)('', {})).toBe('Selecciona una editorial');
    expect(zodField(bookSchemas.genreId)('', {})).toBe('Selecciona un género');
  });

  it('caps the optional description at 2000 characters', () => {
    const validate = zodField(bookSchemas.description);
    expect(validate('y'.repeat(2001), {})).toBe(
      'La descripción no puede superar los 2000 caracteres'
    );
    expect(validate('', {})).toBeUndefined();
  });
});

describe('toBookPayload', () => {
  it('converts form strings into API types without an availability field', () => {
    const payload = toBookPayload({
      title: '  El Aleph  ',
      isbn: '978-3-16-148410-0',
      description: '  Un cuento.  ',
      price: '19.900',
      stock: '12',
      authorId: '3',
      publisherId: '4',
      genreId: '5',
    });
    expect(payload).toEqual({
      title: 'El Aleph',
      isbn: '978-3-16-148410-0',
      description: 'Un cuento.',
      price: '19.900',
      stock: 12,
      authorId: 3,
      publisherId: 4,
      genreId: 5,
    });
    // The server derives availability; the client must not send it.
    expect(Object.keys(payload)).not.toContain('availability');
  });

  it('maps empty optional strings to null', () => {
    const payload = toBookPayload({
      ...EMPTY_BOOK_FORM,
      title: 'Libro',
      price: '1',
      stock: '0',
      authorId: '1',
      publisherId: '1',
      genreId: '1',
    });
    expect(payload.isbn).toBeNull();
    expect(payload.description).toBeNull();
  });
});

describe('login payload and user schemas', () => {
  it('trims whitespace from the email only', () => {
    expect(toLoginPayload({ email: '  a@b.cl  ', password: 'pw' })).toEqual({
      email: 'a@b.cl',
      password: 'pw',
    });
  });

  it('requires password length, uppercase and a digit for users', () => {
    expect(zodField(userSchemas.password)('1234567', {})).toBe(
      'La contraseña debe tener al menos 8 caracteres'
    );
    expect(zodField(userSchemas.password)('12345678', {})).toBe(
      'La contraseña debe contener al menos una mayúscula'
    );
    expect(zodField(userSchemas.password)('ABCDEFGH', {})).toBe(
      'La contraseña debe contener al menos un número'
    );
    expect(zodField(userSchemas.password)('Ab1cdefg', {})).toBeUndefined();
  });

  it('exposes the form constants and hint in Spanish', () => {
    expect(EMPTY_BOOK_FORM.title).toBe('');
    expect(EMPTY_USER_FORM.roleCode).toBe('');
    expect(PASSWORD_HINT).toBe('Mínimo 8 caracteres, una mayúscula y un número.');
  });
});