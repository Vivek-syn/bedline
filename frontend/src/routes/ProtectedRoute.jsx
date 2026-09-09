// ============================================================
// PROTECTED ROUTE
//
// This is a "wrapper component" — a component whose entire job
// is to decide WHETHER to render its children, based on some
// condition. Here: are you logged in, and if `allowedRoles` is
// given, is your role in that list?
//
// We'll use it in App.jsx like this:
//
//   <Route path="/doctor" element={
//     <ProtectedRoute allowedRoles={['doctor']}>
//       <DoctorDashboard />
//     </ProtectedRoute>
//   } />
//
// If the check fails, <Navigate> redirects the browser
// elsewhere — this is React Router's way of doing
// `window.location = '/login'` but without a full page reload.
// ============================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  // While we're still checking localStorage on first load,
  // render nothing rather than flashing a redirect.
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in, but wrong role for this page (e.g. a patient
    // trying to type /doctor into the address bar directly).
    return <Navigate to="/" replace />;
  }

  return children;
}
