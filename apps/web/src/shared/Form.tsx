import type { ReactNode } from 'react';

/** Stable DOM id for a field error, used with aria-describedby. */
export function fieldErrorId(name: string): string {
  return `error-${name}`;
}

export function FieldError({ name, message }: { name: string; message: string | undefined }): ReactNode {
  if (!message) return null;
  return (
    <p id={fieldErrorId(name)} className="field-error" role="alert">
      {message}
    </p>
  );
}

/** Form-level error box (API errors not tied to a single field). */
export function FormAlert({ message }: { message: string | undefined }): ReactNode {
  if (!message) return null;
  return (
    <div className="form-alert" role="alert">
      <p>{message}</p>
    </div>
  );
}

/**
 * Extracts the Spanish message from a react-hook-form FieldErrors object for a
 * given field, tolerating the { message } / { types } runtime shapes.
 */
export function getFieldError(errors: unknown, name: string): string | undefined {
  if (!errors || typeof errors !== 'object') return undefined;
  const entry = (errors as Record<string, unknown>)[name];
  if (!entry) return undefined;
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object' || entry === null) return undefined;
  const message = (entry as { message?: unknown }).message;
  if (typeof message === 'string' && message.length > 0) return message;
  const types = (entry as { types?: unknown }).types;
  if (types && typeof types === 'object') {
    for (const value of Object.values(types as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }
  return undefined;
}

export function FormHint({ children, id }: { children: ReactNode; id?: string }): ReactNode {
  return <p id={id} className="field-hint">{children}</p>;
}