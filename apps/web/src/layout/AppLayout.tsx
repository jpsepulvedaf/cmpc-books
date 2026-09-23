import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '../lib/api';
import { clearSession, getSession } from '../lib/session';
import { roleLabel } from '../lib/format';
import { Badge } from '../shared/Badge';
import { IconClose, IconMenu } from '../shared/Icons';

export function AppLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!adminOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setAdminOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [adminOpen]);

  const session = getSession();
  const user = session?.user;
  const role = user?.role ?? 'CONSULTA';
  const isAdmin = role === 'ADMIN';
  const adminRoutes = [
    { to: '/autores', label: 'Autores' },
    { to: '/editoriales', label: 'Editoriales' },
    { to: '/generos', label: 'Géneros' },
  ];

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
            <div ref={adminMenuRef} className="nav-dropdown">
              <button
                type="button"
                className="nav-link nav-link--dropdown"
                aria-haspopup="menu"
                aria-expanded={adminOpen}
                onClick={() => setAdminOpen((open) => !open)}
              >
                Administración ▾
              </button>
              {adminOpen ? (
                <ul className="nav-dropdown__menu" role="menu" aria-label="Administración">
                  {adminRoutes.map((route) => (
                    <li key={route.to} role="none">
                      <NavLink
                        to={route.to}
                        className="nav-link nav-link--dropdown-item"
                        role="menuitem"
                        onClick={() => setAdminOpen(false)}
                      >
                        {route.label}
                      </NavLink>
                    </li>
                  ))}
                  <li role="none" className="nav-dropdown__separator" />
                  <li role="none">
                    <NavLink
                      to="/auditoria"
                      className="nav-link nav-link--dropdown-item"
                      role="menuitem"
                      onClick={() => setAdminOpen(false)}
                    >
                      Auditoría
                    </NavLink>
                  </li>
                </ul>
              ) : null}
            </div>
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
            <span className="mobile-menu__section">Administración</span>
          ) : null}
          {isAdmin ? (
            adminRoutes.map((route) => (
              <NavLink
                key={route.to}
                to={route.to}
                className="nav-link mobile-menu__sub"
                onClick={() => setMenuOpen(false)}
              >
                {route.label}
              </NavLink>
            ))
          ) : null}
          {isAdmin ? (
            <NavLink to="/auditoria" className="nav-link mobile-menu__sub" onClick={() => setMenuOpen(false)}>
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