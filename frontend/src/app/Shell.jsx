// ============================================================
// SHELL
//
// The frame every signed-in page renders inside. Its navigation
// is built from `modules`, which the server computed from the
// user's permissions — so an admin, a nurse and a patient all
// land on the same route and simply see different things.
//
// There are no role names anywhere in this file. Adding a module
// on the backend makes it appear here with no frontend change.
// ============================================================

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';

export default function Shell() {
  const { user, role, modules, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await logout();
    navigate('/sign-in', { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="topbar__menu"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <Icon name="menu" />
        </button>

        <NavLink to="/app" className="topbar__brand">Bedline</NavLink>

        <div className="topbar__account">
          <span className="topbar__name">{user?.name}</span>
          <span className="topbar__role">{role?.name}</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell__body">
        <nav className={`sidebar${menuOpen ? ' sidebar--open' : ''}`} aria-label="Modules">
          <NavLink
            to="/app"
            end
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="grid" />
            <span>All services</span>
          </NavLink>

          <hr className="sidebar__rule" />

          {modules.map((module) => (
            <NavLink
              key={module.key}
              to={module.route}
              className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={module.icon} />
              <span>{module.name}</span>
            </NavLink>
          ))}

          <hr className="sidebar__rule" />

          <NavLink
            to="/app/account"
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="user" />
            <span>Your account</span>
          </NavLink>
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
