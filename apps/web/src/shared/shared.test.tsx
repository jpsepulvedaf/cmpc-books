// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Badge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { PaginationControl } from './PaginationControl';
import { FieldError, FormAlert, FormHint, fieldErrorId, getFieldError } from './Form';
import { IconBooks, IconClose, IconDownload, IconEdit, IconMenu, IconPlus, IconSearch, IconTrash } from './Icons';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('applies the tone class and renders children', () => {
    render(<Badge tone="success">Disponible</Badge>);
    const badge = screen.getByText('Disponible');
    expect(badge).toHaveClass('badge badge--success');
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>Neutral</Badge>);
    expect(screen.getByText('Neutral')).toHaveClass('badge badge--neutral');
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(<EmptyState title="Vacío" description="Detalle" action={<button>Recargar</button>} />);
    expect(screen.getByText('Vacío')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });
});

describe('LoadingSpinner', () => {
  it('renders a status with the default Spanish label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('supports a custom label', () => {
    render(<LoadingSpinner label="Enviando…" />);
    expect(screen.getByText('Enviando…')).toBeInTheDocument();
  });
});

describe('PaginationControl', () => {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  const props = { page: 2, totalPages: 5, total: 42, pageSize: 10, onPageChange, onPageSizeChange };

  it('shows the Spanish summary and navigates', () => {
    render(<PaginationControl {...props} />);
    expect(screen.getByText('Página 2 de 5 · 42 resultados')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Anterior on the first page and Siguiente on the last', () => {
    render(<PaginationControl {...props} page={1} totalPages={1} total={3} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('notifies the page size change', () => {
    render(<PaginationControl {...props} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '20' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });
});

describe('ConfirmDialog', () => {
  it('returns nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="T" message="M" onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(container.firstChild).toMatchInlineSnapshot('null');
  });

  it('confirms and cancels with the provided callbacks', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Eliminar libro"
        message="¿Seguro?"
        confirmLabel="Eliminar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('¿Seguro?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Form helpers', () => {
  it('renders FieldError only when a message exists', () => {
    const withError = render(<FieldError name="email" message="El correo es obligatorio" />);
    expect(withError.getByText('El correo es obligatorio')).toHaveAttribute('id', 'error-email');
    cleanup();
    const withoutError = render(<FieldError name="email" message={undefined} />);
    expect(withoutError.container.firstChild).toMatchInlineSnapshot('null');
  });

  it('renders FormAlert only when a message exists', () => {
    render(<FormAlert message="Credenciales inválidas." />);
    expect(screen.getByText('Credenciales inválidas.')).toBeInTheDocument();
    cleanup();
    const empty = render(<FormAlert message={undefined} />);
    expect(empty.container.firstChild).toMatchInlineSnapshot('null');
  });

  it('renders FormHint with the given text', () => {
    render(<FormHint id="hint">Un consejo</FormHint>);
    expect(screen.getByText('Un consejo')).toHaveAttribute('id', 'hint');
  });

  it('getFieldError tolerates the RHF runtime shapes', () => {
    expect(fieldErrorId('title')).toBe('error-title');
    expect(getFieldError(undefined, 'title')).toBeUndefined();
    expect(getFieldError('nope', 'title')).toBeUndefined();
    expect(getFieldError({ title: 'Mensaje' }, 'title')).toBe('Mensaje');
    expect(getFieldError({ title: { message: 'Mensaje anidado' } }, 'title')).toBe('Mensaje anidado');
    expect(getFieldError({ title: { types: { a: 'Tipo A' } } }, 'title')).toBe('Tipo A');
    expect(getFieldError({ title: { types: {} } }, 'title')).toBeUndefined();
  });
});

describe('Icons', () => {
  it('render without crashing', () => {
    const { container } = render(
      <div>
        <IconSearch />
        <IconPlus />
        <IconDownload />
        <IconClose />
        <IconEdit />
        <IconMenu />
        <IconTrash />
        <IconBooks />
      </div>
    );
    // Icons are aria-hidden; assert they render as inline SVGs.
    expect(container.querySelectorAll('svg').length).toBe(8);
  });
});