// ============================================================
// PATIENT RECORDS PANEL
// A reusable panel for viewing a patient's medical records and
// doctor remarks. `canWrite` toggles whether the "add new entry"
// forms are shown at all — a nurse gets read-only, a doctor gets
// both. This is the same "one component, different props"
// pattern you saw in BedCard: the component doesn't know or
// care WHO is looking at it, the parent page decides that.
// ============================================================

import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function PatientRecordsPanel({ patientId, canWrite, onClose }) {
  const [records, setRecords] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [newRecord, setNewRecord] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [patientId]);

  async function load() {
    setLoading(true);
    try {
      const [recordsRes, remarksRes] = await Promise.all([
        api.get(`/patients/${patientId}/medical-records`),
        api.get(`/patients/${patientId}/remarks`),
      ]);
      setRecords(recordsRes.data);
      setRemarks(remarksRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load records.');
    } finally {
      setLoading(false);
    }
  }

  async function submitRecord(e) {
    e.preventDefault();
    if (!newRecord.trim()) return;
    await api.post(`/patients/${patientId}/medical-records`, { content: newRecord });
    setNewRecord('');
    load();
  }

  async function submitRemark(e) {
    e.preventDefault();
    if (!newRemark.trim()) return;
    await api.post(`/patients/${patientId}/remarks`, { remark: newRemark });
    setNewRemark('');
    load();
  }

  return (
    <div className="records-panel">
      <div className="records-panel__header">
        <h3>Patient records</h3>
        <button className="btn btn--ghost" onClick={onClose}>Close</button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && (
        <div className="records-panel__columns">
          <div>
            <h4>Medical records</h4>
            {canWrite && (
              <form onSubmit={submitRecord} className="inline-form">
                <textarea
                  value={newRecord}
                  onChange={(e) => setNewRecord(e.target.value)}
                  placeholder="Diagnosis, treatment plan, admission notes…"
                  rows={2}
                />
                <button type="submit" className="btn btn--small">Add record</button>
              </form>
            )}
            <ul className="records-list">
              {records.map((r) => (
                <li key={r.id}>
                  <p>{r.content}</p>
                  <span className="records-list__meta">
                    Dr. {r.doctor_name} · {new Date(r.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
              {records.length === 0 && <li className="empty-state">No medical records yet.</li>}
            </ul>
          </div>

          <div>
            <h4>Remarks</h4>
            {canWrite && (
              <form onSubmit={submitRemark} className="inline-form">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Quick note on the patient's condition…"
                  rows={2}
                />
                <button type="submit" className="btn btn--small">Add remark</button>
              </form>
            )}
            <ul className="records-list">
              {remarks.map((r) => (
                <li key={r.id}>
                  <p>{r.remark}</p>
                  <span className="records-list__meta">
                    Dr. {r.doctor_name} · {new Date(r.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
              {remarks.length === 0 && <li className="empty-state">No remarks yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
