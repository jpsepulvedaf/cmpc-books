import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getSession } from './lib/session';
import { queryClient } from './lib/queryClient';
import type { RoleCode } from './lib/types';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { AuditPage } from './features/audit/AuditPage';
import { BookDetailPage } from './features/books/BookDetailPage';
import { BookFormPage } from './features/books/BookFormPage';
import { BooksPage } from './features/books/BooksPage';
import { UsersPage } from './features/users/UsersPage';
import { CatalogCrudPage } from './features/catalogs/CatalogCrudPage';
import './styles/global.css';

/** Route guard: requires an authenticated session, optionally restricted by role. */
function Guard({ roles, children }: { roles?: RoleCode[]; children: ReactNode }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && roles.length > 0 && !roles.includes(session.user.role)) {
    return <Navigate to="/libros" replace />;
  }
  return <>{children}</>;
}

/** Catch-all: send authenticated users to the catalog, others to login. */
function HomeRedirect() {
  return getSession() ? <Navigate to="/libros" replace /> : <Navigate to="/login" replace />;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <Guard>
        <AppLayout />
      </Guard>
    ),
    children: [
      { path: '/libros', element: <BooksPage /> },
      {
        path: '/libros/nuevo',
        element: (
          <Guard roles={['ADMIN']}>
            <BookFormPage mode="create" />
          </Guard>
        ),
      },
      { path: '/libros/:id', element: <BookDetailPage /> },
      {
        path: '/libros/:id/editar',
        element: (
          <Guard roles={['ADMIN']}>
            <BookFormPage mode="edit" />
          </Guard>
        ),
      },
      {
        path: '/usuarios',
        element: (
          <Guard roles={['ADMIN']}>
            <UsersPage />
          </Guard>
        ),
      },
      {
        path: '/autores',
        element: (
          <Guard roles={['ADMIN']}>
            <CatalogCrudPage kind="authors" />
          </Guard>
        ),
      },
      {
        path: '/editoriales',
        element: (
          <Guard roles={['ADMIN']}>
            <CatalogCrudPage kind="publishers" />
          </Guard>
        ),
      },
      {
        path: '/generos',
        element: (
          <Guard roles={['ADMIN']}>
            <CatalogCrudPage kind="genres" />
          </Guard>
        ),
      },
      {
        path: '/auditoria',
        element: (
          <Guard roles={['ADMIN']}>
            <AuditPage />
          </Guard>
        ),
      },
    ],
  },
  { path: '*', element: <HomeRedirect /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}