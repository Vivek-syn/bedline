// ============================================================
// AUTH CONTEXT
//
// Holds the signed-in user, their role, their permission set and
// the modules they can reach — all of it straight from
// /api/auth/me, never hard-coded in the client.
//
// The `can()` helper is what the rest of the UI uses to decide
// whether to render a button. It is a convenience for the user,
// not a security boundary: the server checks the same permission
// on every request, so hiding a control only saves someone from
// clicking something that would have been refused.
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setSessionLostHandler } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((payload) => {
    setSession({
      user: payload.user,
      role: payload.role,
      permissions: new Set(payload.permissions),
      modules: payload.modules,
    });
  }, []);

  // On first load, try to restore from the httpOnly refresh
  // cookie. This is why a page refresh does not sign you out even
  // though the access token only ever lived in memory.
  useEffect(() => {
    let cancelled = false;

    api
      .restore()
      .then((payload) => { if (!cancelled) applySession(payload); })
      .catch(() => { if (!cancelled) setSession(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [applySession]);

  useEffect(() => {
    setSessionLostHandler(() => setSession(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const payload = await api.login(email, password);
    applySession(payload);
    return payload;
  }, [applySession]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setSession(null);
  }, []);

  /** Re-read permissions — used after an admin edits their own role. */
  const reload = useCallback(async () => {
    const payload = await api.get('/auth/me');
    applySession(payload);
  }, [applySession]);

  const value = useMemo(() => ({
    session,
    loading,
    login,
    logout,
    reload,
    user: session?.user || null,
    role: session?.role || null,
    modules: session?.modules || [],
    can: (permission) => Boolean(session?.permissions.has(permission)),
    canAny: (permissions) => permissions.some((p) => session?.permissions.has(p)),
  }), [session, loading, login, logout, reload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
