import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Field, Notice, fieldErrors, firstError } from '../components/ui';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = await login(email, password);
      // A freshly created or reset account has to pick its own
      // password before it can do anything else.
      if (payload.user.mustChangePassword) {
        navigate('/app/account?first=1', { replace: true });
        return;
      }
      navigate(location.state?.from || '/app', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const errors = fieldErrors(error);

  return (
    <div className="signin">
      <div className="signin__panel">
        <h1 className="signin__brand">Bedline</h1>
        <p className="signin__tagline">Hospital bed and admission management</p>

        <form onSubmit={handleSubmit} noValidate>
          {error && <Notice tone="error">{error.message}</Notice>}

          <Field label="Email" error={firstError(errors, 'email')}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password" error={firstError(errors, 'password')}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* No "create an account" link. Accounts are issued by an
            administrator — a public sign-up form that accepts a
            role is a public form that hands out admin. */}
        <p className="signin__foot">
          Need an account? Your hospital administrator creates one for you.
        </p>
      </div>
    </div>
  );
}
