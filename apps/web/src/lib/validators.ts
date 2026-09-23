// Zod schemas for every form, bridged into react-hook-form `validate` options.
// Each rule carries its own Spanish message, surfaced reactively under fields.

import { z, type ZodType, type ZodError } from 'zod';

export type FieldValidator = (value: unknown, _formValues: unknown) => string | undefined;

/**
 * Adapts a zod schema to a react-hook-form validate callback. Returns the first
 * zod issue message (already written in Spanish) or undefined when valid.
 */
export function zodField<T>(schema: ZodType<T>): FieldValidator {
  return (value) => {
    const result = schema.safeParse(value);
    if (result.success) return undefined;
    const first = (result.error as ZodError).issues[0];
    return first?.message ?? 'Ha ocurrido un error inesperado';
  };
}

// ── Parsers ──────────────────────────────────────────────────────────────────

/** Normalizes a decimal string that may use ',' or '.' as separator. */
export function normalizeDecimal(value: string): string {
  return value.trim().replace(',', '.');
}

/** Accepts 10 or 13 digits; dashes and spaces are tolerated (e.g. "978-3-16-148410-0"). */
export function isValidIsbn(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  if (digits.length === 0) return true; // ISBN is optional
  return /^\d{10}$/.test(digits) || /^\d{13}$/.test(digits);
}

export function isValidPrice(value: string): boolean {
  const normalized = normalizeDecimal(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return false;
  return Number(normalized) > 0;
}

export function isValidStock(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  return Number(value) >= 0;
}

// ── Login ────────────────────────────────────────────────────────────────────

export interface LoginFormValues {
  email: string;
  password: string;
}

export const loginSchemas: Record<keyof LoginFormValues, ZodType> = {
  email: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
};

// ── Book form ────────────────────────────────────────────────────────────────

export interface BookFormValues {
  title: string;
  isbn: string;
  description: string;
  price: string;
  stock: string;
  authorId: string;
  publisherId: string;
  genreId: string;
}

export const EMPTY_BOOK_FORM: BookFormValues = {
  title: '',
  isbn: '',
  description: '',
  price: '',
  stock: '',
  authorId: '',
  publisherId: '',
  genreId: '',
};

export const bookSchemas: Record<keyof BookFormValues, ZodType> = {
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(255, 'El título no puede superar los 255 caracteres'),
  isbn: z.string().trim().refine(isValidIsbn, 'El ISBN debe tener 10 o 13 dígitos'),
  description: z.string().max(2000, 'La descripción no puede superar los 2000 caracteres'),
  price: z
    .string()
    .trim()
    .min(1, 'El precio es obligatorio')
    .refine(isValidPrice, 'Ingresa un precio mayor que 0 con hasta 2 decimales'),
  stock: z
    .string()
    .trim()
    .min(1, 'El stock es obligatorio')
    .refine(isValidStock, 'El stock debe ser un número entero mayor o igual a 0'),
  authorId: z.string().min(1, 'Selecciona un autor'),
  publisherId: z.string().min(1, 'Selecciona una editorial'),
  genreId: z.string().min(1, 'Selecciona un género'),
};

/** Builds the create/update payload converting form strings to API types. */
export function toBookPayload(values: BookFormValues): {
  title: string;
  isbn: string | null;
  description: string | null;
  price: string;
  stock: number;
  authorId: number;
  publisherId: number;
  genreId: number;
} {
  const isbn = values.isbn.trim();
  const description = values.description.trim();
  return {
    title: values.title.trim(),
    isbn: isbn.length > 0 ? isbn : null,
    description: description.length > 0 ? description : null,
    price: normalizeDecimal(values.price),
    stock: Number(values.stock),
    authorId: Number(values.authorId),
    publisherId: Number(values.publisherId),
    genreId: Number(values.genreId),
  };
}

// ── User form ────────────────────────────────────────────────────────────────

export interface UserFormValues {
  fullName: string;
  email: string;
  roleCode: string;
  password: string;
}

export const EMPTY_USER_FORM: UserFormValues = {
  fullName: '',
  email: '',
  roleCode: '',
  password: '',
};

export const userSchemas: Record<keyof UserFormValues, ZodType> = {
  fullName: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre no puede superar los 120 caracteres'),
  email: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .email('Ingresa un correo electrónico válido'),
  roleCode: z.string().min(1, 'Selecciona un rol'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/\d/, 'La contraseña debe contener al menos un número'),
};

export const PASSWORD_HINT = 'Mínimo 8 caracteres, una mayúscula y un número.';

/**
 * Password schema for EDITING a user: empty means "keep the current one", so
 * a blank value is valid; anything written must meet the strength rules.
 */
export const editUserPasswordSchema = z
  .string()
  .refine(
    (value) =>
      value === '' ||
      (value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value)),
    'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número',
  );

// ── Catalog form (authors / publishers / genres) ─────────────────────────────

export const catalogNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'El nombre no puede superar los 120 caracteres');

// ── Auth login payload ───────────────────────────────────────────────────────

export function toLoginPayload(values: LoginFormValues): { email: string; password: string } {
  return { email: values.email.trim(), password: values.password };
}