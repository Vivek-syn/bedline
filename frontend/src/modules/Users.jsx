// ============================================================
// PEOPLE AND ACCOUNTS
//
// Creating a login, moving someone to a different role,
// deactivating, and issuing a temporary password.
//
// The one-time password the server returns is shown once, in a
// panel that has to be dismissed deliberately. It is never
// emailed, never logged, and not recoverable — so the UI makes
// copying it the obvious next action rather than something the
// admin might scroll past.
// ============================================================

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { Notice, Field, Spinner, Empty, CopyValue, fieldErrors, firstError } from '../components/ui';

const BLANK = { name: '', email: '', roleId: '', createPatientRecord: false };

export default function Users() {
  const { can, user: me } = useAuth();

  const load = useCallback(async () => {
    const [users, roles] = await Promise.all([
      api.get('/users?includeInactive=true'),
      can('role.view') ? api.get('/roles') : Promise.resolve([]),
    ]);
    return { users, roles };
  }, [can]);

  const { data, loading, error, reload } = useModuleData(load);

  const [draft, setDraft] = useState(BLANK);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState(null); // { name, password }
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function createUser(event) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);

    try {
      const result = await api.post('/users', {
        name: draft.name,
        email: draft.email,
        roleId: Number(draft.roleId),
        createPatientRecord: draft.createPatientRecord,
      });

      if (result.temporaryPassword) {
        setIssued({ name: draft.name, password: result.temporaryPassword });
      } else {
        setMessage(result.message);
      }

      setDraft(BLANK);
      setCreating(false);
      await reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(user, roleId) {
    try {
      const result = await api.patch(`/users/${user.id}`, { roleId: Number(roleId) });
      setMessage(result.message);
      await reload();
    } catch (err) {
      setFormError(err);
    }
  }

  async function toggleActive(user) {
    try {
      const result = await api.patch(`/users/${user.id}/active`, { isActive: !user.is_active });
      setMessage(result.message);
      await reload();
    } catch (err) {
      setFormError(err);
    }
  }

  async function resetPassword(user) {
    if (!window.confirm(`Issue a new temporary password for ${user.name}? Their current one stops working and they’ll be signed out.`)) return;
    try {
      const result = await api.post(`/users/${user.id}/reset-password`);
      setIssued({ name: user.name, password: result.temporaryPassword });
      await reload();
    } catch (err) {
      setFormError(err);
    }
  }

  if (loading) return <Spinner label="Loading accounts" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  const errors = fieldErrors(formError);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>People and accounts</h1>
          <p className="page__sub">Every login in Bedline, and the role it holds.</p>
        </div>
        {can('user.create') && !creating && (
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            Add account
          </button>
        )}
      </header>

      {issued && (
        <div className="handover">
          <h2>Temporary password for {issued.name}</h2>
          <p>
            Copy this now and give it to them directly. It is shown once and cannot be recovered —
            issue a new one if it is lost. They’ll choose their own password when they first sign in.
          </p>
          <CopyValue value={issued.password} />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setIssued(null)}>
            I’ve saved it
          </button>
        </div>
      )}

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {formError && <Notice tone="error" onDismiss={() => setFormError(null)}>{formError.message}</Notice>}

      {creating && (
        <form className="editor" onSubmit={createUser}>
          <h2>New account</h2>

          <div className="editor__row">
            <Field label="Full name" error={firstError(errors, 'name')}>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </Field>

            <Field label="Email" error={firstError(errors, 'email')}>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                required
              />
            </Field>

            <Field label="Role" error={firstError(errors, 'roleId')}>
              <select
                value={draft.roleId}
                onChange={(event) => setDraft({ ...draft, roleId: event.target.value })}
                required
              >
                <option value="">Choose a role…</option>
                {data.roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <label className="checkline">
            <input
              type="checkbox"
              checked={draft.createPatientRecord}
              onChange={(event) => setDraft({ ...draft, createPatientRecord: event.target.checked })}
            />
            <span>Also create a patient record linked to this login</span>
          </label>

          <p className="editor__note">
            A temporary password is generated and shown once. They’ll be asked to replace it at first sign-in.
          </p>

          <div className="editor__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => { setCreating(false); setDraft(BLANK); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Last signed in</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {data.users.map((user) => (
            <tr key={user.id} className={user.is_active ? '' : 'table__row--muted'}>
              <td>
                <span className="table__strong">{user.name}</span>
                {user.id === me?.id && <span className="tag">you</span>}
                <span className="table__sub">{user.email}</span>
              </td>
              <td>
                {can('user.update') && user.id !== me?.id ? (
                  <select
                    value={user.role_id}
                    onChange={(event) => changeRole(user, event.target.value)}
                    aria-label={`Role for ${user.name}`}
                  >
                    {data.roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                ) : (
                  user.role_name
                )}
              </td>
              <td>
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                  : <span className="table__sub">never</span>}
              </td>
              <td>
                {user.is_active
                  ? <span className="pill pill--ok">active</span>
                  : <span className="pill pill--off">deactivated</span>}
                {user.must_change_password && <span className="tag">password pending</span>}
                {user.locked_until && new Date(user.locked_until) > new Date() && (
                  <span className="tag tag--danger">locked</span>
                )}
              </td>
              <td className="table__actions">
                {can('user.reset_password') && user.is_active && (
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => resetPassword(user)}>
                    Reset password
                  </button>
                )}
                {can('user.deactivate') && user.id !== me?.id && (
                  <button
                    type="button"
                    className={`btn btn--small ${user.is_active ? 'btn--danger' : 'btn--ghost'}`}
                    onClick={() => toggleActive(user)}
                  >
                    {user.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.users.length === 0 && <Empty title="No accounts yet" />}
    </div>
  );
}
