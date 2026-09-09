// ============================================================
// APP — the root component. Its job is purely to declare
// ROUTES: which URL path renders which page component.
// React Router reads the current browser URL and picks a match.
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import NurseDashboard from './pages/NurseDashboard';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import PatientPortal from './pages/PatientPortal';
import ProtectedRoute from './routes/ProtectedRoute';

// A tiny helper component: when someone lands on "/", send them
// straight to their role's dashboard (or to /login if signed out).
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const roleHome = {
    admin: '/admin',
    doctor: '/doctor',
    nurse: '/nurse',
    receptionist: '/reception',
    patient: '/patient',
  };
  return <Navigate to={roleHome[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Each dashboard is wrapped in ProtectedRoute with the ONE
          role allowed to see it. Try logging in as a patient and
          typing /admin in the address bar — you'll get bounced. */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/doctor" element={
        <ProtectedRoute allowedRoles={['doctor']}><DoctorDashboard /></ProtectedRoute>
      } />
      <Route path="/nurse" element={
        <ProtectedRoute allowedRoles={['nurse']}><NurseDashboard /></ProtectedRoute>
      } />
      <Route path="/reception" element={
        <ProtectedRoute allowedRoles={['receptionist']}><ReceptionistDashboard /></ProtectedRoute>
      } />
      <Route path="/patient" element={
        <ProtectedRoute allowedRoles={['patient']}><PatientPortal /></ProtectedRoute>
      } />

      {/* Catch-all for any unknown URL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
