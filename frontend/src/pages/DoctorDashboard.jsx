// ============================================================
// DOCTOR DASHBOARD
// Three jobs now: assign a vacant bed to a waiting patient,
// de-assign/discharge an active admission (subject to the dues
// gate), and manage a patient's medical records/remarks.
// ============================================================

import { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import RoomGrid from '../components/RoomGrid';
import ActiveAdmissionsTable from '../components/ActiveAdmissionsTable';
import PatientRecordsPanel from '../components/PatientRecordsPanel';

export default function DoctorDashboard() {
  const [beds, setBeds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [recordsForPatient, setRecordsForPatient] = useState(null); // patientId or null
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
      // This is where the dues-gate / supersede errors surface —
      // the backend message is shown verbatim so it's actionable.
      setMessage(err.response?.data?.message || 'Could not de-assign.');
    }
  }

  return (
    <div className="page">
      <Navbar title="Doctor Dashboard" />
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
            canWrite={true}
            onClose={() => setRecordsForPatient(null)}
          />
        )}

        <h2>Bed availability</h2>
        {loading ? <p>Loading beds…</p> : <RoomGrid beds={beds} onAssign={openAssignFor} />}

        <h2>Active admissions</h2>
        <ActiveAdmissionsTable
          admissions={admissions}
          actorRole="doctor"
          onDeassign={handleDeassign}
          onRecords={setRecordsForPatient}
        />
      </div>
    </div>
  );
}
