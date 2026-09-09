// ============================================================
// NURSE DASHBOARD
// Nurses can: assign a vacant bed, de-assign/discharge, and flip
// a bed's status (vacant/occupied/reserved/maintenance) — EXCEPT
// on any bed whose active admission was locked in by a doctor or
// admin. Those actions are grayed out client-side (see
// ActiveAdmissionsTable's `locked` check) but the real
// enforcement is server-side; if a nurse tries anyway, the
// server's 403 message is what's shown.
// ============================================================

import { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import RoomGrid from '../components/RoomGrid';
import ActiveAdmissionsTable from '../components/ActiveAdmissionsTable';
import PatientRecordsPanel from '../components/PatientRecordsPanel';

export default function NurseDashboard() {
  const [beds, setBeds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [recordsForPatient, setRecordsForPatient] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [bedsRes, patientsRes, admissionsRes] = await Promise.all([
      api.get('/beds'),
      api.get('/patients'),
      api.get('/admissions/active'),
    ]);
    setBeds(bedsRes.data);
    setPatients(patientsRes.data.filter((p) => p.admission_status === 'pending'));
    setAdmissions(admissionsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAssignFor(bed) {
    setSelectedBed(bed);
    setSelectedPatientId('');
    setMessage('');
  }

  async function confirmAssign() {
    if (!selectedPatientId) return;
    try {
      await api.post('/admissions/assign', {
        patientId: Number(selectedPatientId),
        bedId: selectedBed.id,
      });
      setMessage(`Assigned bed ${selectedBed.bed_number} successfully.`);
      setSelectedBed(null);
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not assign bed.');
    }
  }

  async function handleDeassign(admissionId) {
    setMessage('');
    try {
      await api.patch(`/admissions/${admissionId}/discharge`);
      setMessage('Patient de-assigned and bed freed.');
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not de-assign.');
    }
  }

  async function handleStatusChange(bedId, newStatus) {
    setMessage('');
    try {
      await api.patch(`/beds/${bedId}/status`, { status: newStatus });
      setBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, status: newStatus } : b)));
    } catch (err) {
      // The supersede-rule 403 lands here — e.g. trying to change a
      // bed that's locked by a doctor's assignment.
      setMessage(err.response?.data?.message || 'Could not update bed status.');
      loadData(); // re-sync in case our optimistic guess was wrong
    }
  }

  return (
    <div className="page">
      <Navbar title="Nurse Dashboard" />
      <div className="page-content">
        {message && <p className="form-note">{message}</p>}

        {selectedBed && (
          <div className="inline-panel">
            <h3>Assign bed {selectedBed.bed_number}</h3>
            {patients.length === 0 ? (
              <p>No pending patients waiting for a bed.</p>
            ) : (
              <>
                <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
                  <option value="">Select a patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button className="btn btn--primary" onClick={confirmAssign}>Confirm</button>
              </>
            )}
            <button className="btn btn--ghost" onClick={() => setSelectedBed(null)}>Cancel</button>
          </div>
        )}

        {recordsForPatient && (
          <PatientRecordsPanel
            patientId={recordsForPatient}
            canWrite={false}
            onClose={() => setRecordsForPatient(null)}
          />
        )}

        <h2>Bed status</h2>
        {loading ? <p>Loading beds…</p> : (
          <RoomGrid beds={beds} onAssign={openAssignFor} onStatusChange={handleStatusChange} />
        )}

        <h2>Active admissions</h2>
        <ActiveAdmissionsTable
          admissions={admissions}
          actorRole="nurse"
          onDeassign={handleDeassign}
          onRecords={setRecordsForPatient}
        />
      </div>
    </div>
  );
}
