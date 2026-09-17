// ============================================================
// ROUTES
//
// One shell, one launcher, and one route per module — each
// wrapped in the permission its backend manifest declares. The
// route paths match the `route` field in those manifests.
//
// Note what is NOT here: there is no /admin, /doctor, /nurse
// route. Everyone signs in and lands on /app. What differs is
// which tiles and which sidebar entries the server says they can
// reach.
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequirePermission from './auth/RequirePermission';
import SignIn from './auth/SignIn';
import Shell from './app/Shell';
import Launcher from './app/Launcher';

import Patients from './modules/Patients';
import Beds from './modules/Beds';
import Admissions from './modules/Admissions';
import Wards from './modules/Wards';
import Records from './modules/Records';
import Billing from './modules/Billing';
import MyStay from './modules/MyStay';
import Roles from './modules/Roles';
import Users from './modules/Users';
import Activity from './modules/Activity';
import Account from './modules/Account';

function RequireSession({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="loading">Loading…</p>;
  if (!session) return <Navigate to="/sign-in" replace />;
  return children;
}

function SignInGate() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/app" replace />;
  return <SignIn />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInGate />} />

      <Route path="/app" element={<RequireSession><Shell /></RequireSession>}>
        <Route index element={<Launcher />} />
        <Route path="account" element={<Account />} />

        <Route path="my-stay" element={
          <RequirePermission permission="portal.view_own"><MyStay /></RequirePermission>
        } />
        <Route path="patients" element={
          <RequirePermission permission="patient.view"><Patients /></RequirePermission>
        } />
        <Route path="beds" element={
          <RequirePermission permission="bed.view"><Beds /></RequirePermission>
        } />
        <Route path="admissions" element={
          <RequirePermission permission="admission.view"><Admissions /></RequirePermission>
        } />
        <Route path="wards" element={
          <RequirePermission permission="ward.view"><Wards /></RequirePermission>
        } />
        <Route path="records" element={
          <RequirePermission permission="record.view"><Records /></RequirePermission>
        } />
        <Route path="billing" element={
          <RequirePermission permission="billing.view"><Billing /></RequirePermission>
        } />
        <Route path="roles" element={
          <RequirePermission permission="role.view"><Roles /></RequirePermission>
        } />
        <Route path="users" element={
          <RequirePermission permission="user.view"><Users /></RequirePermission>
        } />
        <Route path="activity" element={
          <RequirePermission permission="audit.view"><Activity /></RequirePermission>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
