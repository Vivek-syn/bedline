// Route guard. Renders its children only when the signed-in user
// holds the permission; otherwise shows a plain explanation
// rather than bouncing them somewhere confusing.
//
// A user who types a URL for a module they cannot reach should
// learn what is missing, not silently land back on the launcher
// wondering whether they clicked wrong.

import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequirePermission({ permission, anyOf, children }) {
  const { session, loading, can, canAny } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to="/sign-in" replace />;

  const allowed = anyOf ? canAny(anyOf) : can(permission);

  if (!allowed) {
    return (
      <div className="notice notice--blocked">
        <h2>You don’t have access to this</h2>
        <p>
          This page needs the <code>{anyOf ? anyOf.join(' or ') : permission}</code> permission,
          which the <strong>{session.role.name}</strong> role doesn’t currently hold.
        </p>
        <p className="notice__aside">An administrator can grant it in Roles and permissions.</p>
      </div>
    );
  }

  return children;
}
