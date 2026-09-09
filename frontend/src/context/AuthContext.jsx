// ============================================================
// AUTH CONTEXT — this is the "global state" for who is logged in.
//
// React's "Context" API solves one specific problem: normally,
// data in React only flows DOWN, from parent component to child,
// via "props". If your Login page needs to tell your Navbar
// (a totally different branch of the component tree) "hey, a
// user just logged in", passing props down through every single
// component in between would be a nightmare. That's called
// "prop drilling".
//
// Context lets us skip that: we create one "box" of shared data
// (the user + their token + login/logout functions), wrap the
// whole app in a "Provider" that owns that box, and any component
// anywhere can reach into the box directly with `useAuth()`.
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

// 1. Create the context "box" itself. It starts empty — the
//    actual value gets filled in by AuthProvider below.
const AuthContext = createContext(null);

// 2. The Provider component. It wraps <App /> in main.jsx.
//    Anything rendered INSIDE it can access the state below.
export function AuthProvider({ children }) {
  // useState gives us a piece of state (`user`) and a function
  // to update it (`setUser`). Whenever setUser is called, React
  // automatically re-renders any component that reads `user`.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // useEffect runs side-effects — code that isn't purely about
  // rendering, like reading localStorage or calling an API.
  // The empty array `[]` at the end means "run this ONCE, right
  // after the component first mounts" (similar to onload).
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Called by the Login page after a successful API call.
  function login(userData, token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  // Whatever we put in `value` here is what components will get
  // back when they call useAuth().
  const value = { user, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 3. A tiny custom hook so other files can just write:
//      const { user, login, logout } = useAuth();
//    instead of importing useContext + AuthContext everywhere.
export function useAuth() {
  return useContext(AuthContext);
}
