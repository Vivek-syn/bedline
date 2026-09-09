// ============================================================
// LOGIN PAGE
// This introduces the most common React pattern of all:
// "controlled inputs" — form fields whose value lives in React
// state, not in the DOM itself.
// ============================================================

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  // Two independent pieces of state, one per field. Every time
  // you type a character, onChange fires, setEmail runs, React
  // re-renders this component, and the <input>'s value prop
  // reflects the new state. This "React state -> input value"
  // loop is what "controlled input" means.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate(); // lets us redirect programmatically after login

  async function handleSubmit(e) {
    e.preventDefault(); // stop the browser's default "reload the page" form behavior
    setError('');
    setSubmitting(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, token } = response.data;

      login(user, token); // saves to context + localStorage

      // Send each role to a sensible landing page.
      const roleHome = {
        admin: '/admin',
        doctor: '/doctor',
        nurse: '/nurse',
        receptionist: '/reception',
        patient: '/patient',
      };
      navigate(roleHome[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Bedline</h1>
        <p className="auth-subtitle">Sign in to your hospital account</p>

        {/* Conditional rendering: `{error && <p>...}` only shows the
            paragraph if `error` is a truthy (non-empty) string. */}
        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link to="/register">Register here</Link>
        </p>

        <div className="demo-hint">
          <strong>Demo logins</strong> (password: <code>password123</code>)
          <ul>
            <li>admin@hospital.com</li>
            <li>doctor@hospital.com</li>
            <li>nurse@hospital.com</li>
            <li>reception@hospital.com</li>
            <li>patient@hospital.com</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
