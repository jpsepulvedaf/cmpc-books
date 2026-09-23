import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '../lib/api';
import { clearSession, getSession } from '../lib/session';
import { roleLabel } from '../lib/format';
import { Badge } from '../shared/Badge';
import { IconClose, IconMenu } from '../shared/Icons';

export function AppLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
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
            <NavLink to="/autores" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
              Autores
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/editoriales" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
              Editoriales
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/generos" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
              Géneros
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/auditoria" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
              Auditoría
            </NavLink>
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
            <NavLink to="/autores" className="nav-link" onClick={() => setMenuOpen(false)}>
              Autores
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/editoriales" className="nav-link" onClick={() => setMenuOpen(false)}>
              Editoriales
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/generos" className="nav-link" onClick={() => setMenuOpen(false)}>
              Géneros
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/auditoria" className="nav-link" onClick={() => setMenuOpen(false)}>
              Auditoría
            </NavLink>
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