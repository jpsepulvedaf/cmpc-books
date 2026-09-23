import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { setUnauthorizedHandler, ApiError } from '../lib/api';
import { clearSession, getSession } from '../lib/session';
import { roleLabel } from '../lib/format';
import { exportBooksCsv, triggerCsvDownload } from '../features/books/api';
import { Badge } from '../shared/Badge';
import { IconDownload, IconMenu, IconClose } from '../shared/Icons';

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const session = getSession();
  const user = session?.user;
  const role = user?.role ?? 'CONSULTA';
  const isAdmin = role === 'ADMIN';
  const canExport = isAdmin || role === 'OPERADOR';
  // The catalog CSV export only makes sense while browsing the books section;
  // hide it anywhere else (users/audit views have nothing to do with it).
  const exportVisible = canExport && location.pathname.startsWith('/libros');

  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportBooksCsv({});
      triggerCsvDownload(result);
      toast.success(`Exportación completada: ${result.filename}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.userMessage : 'No se pudo exportar el catálogo.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="navbar">
        <NavLink to="/libros" className="navbar__brand" aria-label="CMPC Libros — inicio">
          <img src="/logo.png" alt="CMPC Libros" className="navbar__brand-logo" height={34} />
        </NavLink>

        <nav className="navbar__links" aria-label="Navegación principal">
          <NavLink to="/libros" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Libros
          </NavLink>
          {isAdmin ? (
            <NavLink to="/usuarios" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
              Usuarios
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/auditoria" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
              Auditoría
            </NavLink>
          ) : null}
          {exportVisible ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={exportAll}
              disabled={exporting}
              title="Exportar el catálogo completo en CSV"
            >
              <IconDownload /> {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          ) : null}
        </nav>

        <div className="navbar__user">
          <span className="navbar__user-name" title={user?.email ?? ''}>
            {user?.fullName ?? 'Usuario'}
          </span>
          <Badge tone={role === 'ADMIN' ? 'role' : role === 'OPERADOR' ? 'info' : 'neutral'}>
            {roleLabel(role)}
          </Badge>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={logout}
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>

        <button
          type="button"
          className="navbar__toggle"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {menuOpen ? (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Navegación móvil">
          <NavLink to="/libros" className="nav-link" onClick={() => setMenuOpen(false)}>
            Libros
          </NavLink>
          {isAdmin ? (
            <NavLink to="/usuarios" className="nav-link" onClick={() => setMenuOpen(false)}>
              Usuarios
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/auditoria" className="nav-link" onClick={() => setMenuOpen(false)}>
              Auditoría
            </NavLink>
          ) : null}
          {exportVisible ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--block"
              onClick={() => {
                setMenuOpen(false);
                void exportAll();
              }}
              disabled={exporting}
            >
              <IconDownload /> {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--block"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
          >
            Salir
          </button>
        </nav>
      ) : null}

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}