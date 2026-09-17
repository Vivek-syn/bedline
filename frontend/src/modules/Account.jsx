// Your own account: change your password, see and end your
// active sessions.

import { useCallback, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { Notice, Field, Spinner, fieldErrors, firstError } from '../components/ui';

export default function Account() {
  const { user, role, logout } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mustChange = params.get('first') === '1' || user?.mustChangePassword;

  const load = useCallback(() => api.get('/auth/sessions'), []);
  const { data: sessions, loading, reload } = useModuleData(load);

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(event) {
    event.preventDefault();
    setProblem(null);

    if (form.newPassword !== form.confirm) {
      setProblem({ message: 'The two new passwords don’t match.', details: { confirm: ['These don’t match.'] } });
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // The server ends every session on a password change, so
      // there is nothing to stay signed in to.
      await logout();
      navigate('/sign-in', { replace: true, state: { notice: 'Password changed. Sign in with your new one.' } });
    } catch (err) {
      setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    await api.post('/auth/logout-all').catch(() => {});
    await logout();
    navigate('/sign-in', { replace: true });
  }

  const errors = fieldErrors(problem);

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <h1>Your account</h1>
          <p className="page__sub">{user?.name} · {user?.email} · {role?.name}</p>
        </div>
      </header>

      {mustChange && (
        <Notice tone="info">
          This account is still using a password someone else issued. Choose your own to continue.
        </Notice>
      )}

      <form className="editor" onSubmit={changePassword}>
        <h2>Change your password</h2>

        {problem && <Notice tone="error">{problem.message}</Notice>}

        <Field label="Current password" error={firstError(errors, 'currentPassword')}>
          <input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            required
          />
        </Field>

        <Field
          label="New password"
          error={firstError(errors, 'newPassword')}
          hint="At least 12 characters. A memorable phrase beats a short scramble."
        >
          <input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            required
          />
        </Field>

        <Field label="Confirm new password" error={firstError(errors, 'confirm')}>
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
            required
          />
        </Field>

        <p className="editor__note">
          Changing your password signs you out everywhere, including this tab.
        </p>

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>

      <h2>Where you’re signed in</h2>
      {loading ? <Spinner /> : (
        <>
          <ul className="notes">
            {(sessions || []).map((session) => (
              <li key={session.id}>
                <p>{session.current ? 'This device' : 'Another device'}</p>
                <span className="notes__meta">
                  {session.ip_address || 'unknown address'} · started {new Date(session.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--danger btn--small" onClick={signOutEverywhere}>
            Sign out everywhere
          </button>
        </>
      )}
    </div>
  );
}
