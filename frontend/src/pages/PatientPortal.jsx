// ============================================================
// PATIENT PORTAL
// This introduces the "fetch data on mount" pattern, which is
// probably the single most common thing you'll write in React:
// as soon as the page loads, call an API, store the result in
// state, and render it.
// ============================================================

import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import Navbar from '../components/Navbar';

export default function PatientPortal() {
  const [status, setStatus] = useState(null); // null = "haven't loaded yet"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // We define an async function INSIDE useEffect and call it
    // immediately, because useEffect itself can't be async.
    async function fetchStatus() {
      try {
        const response = await api.get('/patients/me');
        setStatus(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load your status.');
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []); // [] = run once when the page first loads

  return (
    <div className="page">
      <Navbar title="My Care" />
      <div className="page-content">
        {loading && <p>Loading your status…</p>}
        {error && <p className="form-error">{error}</p>}

        {status && (
          <div className="status-card">
            <h2>Hello, {status.name}</h2>
            <StatusBadge status={status.admission_status} />

            {status.admission_status === 'admitted' ? (
              <div className="status-details">
                <div className="status-row">
                  <span>Ward</span>
                  <strong>{status.ward_name}</strong>
                </div>
                <div className="status-row">
                  <span>Room</span>
                  <strong>{status.room_number}</strong>
                </div>
                <div className="status-row">
                  <span>Bed</span>
                  <strong>{status.bed_number}</strong>
                </div>
                <div className="status-row">
                  <span>Attending doctor</span>
                  <strong>{status.doctor_name || 'Not yet assigned'}</strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                You haven't been assigned a bed yet. Please check with the front desk.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
