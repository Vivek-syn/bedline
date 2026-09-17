// ============================================================
// LAUNCHER — the common landing page
//
// Everybody lands here after signing in, whatever their role.
// The tiles are whatever the server said this account can reach,
// so the page is identical in code and different in content for
// every user. A patient sees one tile; an administrator sees ten.
// ============================================================

import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { Empty } from '../components/ui';

export default function Launcher() {
  const { user, role, modules } = useAuth();
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="launcher">
      <header className="launcher__head">
        <h1>Good to see you, {firstName}</h1>
        <p className="launcher__sub">
          Signed in as <strong>{role?.name}</strong>. These are the services your role can reach.
        </p>
      </header>

      {modules.length === 0 ? (
        <Empty title="Nothing is available to you yet">
          Your role doesn’t grant access to any service. An administrator can add permissions to it.
        </Empty>
      ) : (
        <div className="tiles">
          {modules.map((module) => (
            <Link key={module.key} to={module.route} className="tile">
              <span className="tile__icon"><Icon name={module.icon} size={22} /></span>
              <span className="tile__name">{module.name}</span>
              <span className="tile__desc">{module.description}</span>
              <span className="tile__count">
                {module.permissions.length} permission{module.permissions.length === 1 ? '' : 's'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
