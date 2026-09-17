// Admissions. The two gates (seniority, billing) live on the
// server; when one fires, its message is shown verbatim because
// it already explains exactly what to do next.

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { EVENTS } from '../lib/realtime';
import { Notice, Spinner, Empty, Field } from '../components/ui';

export default function Admissions() {
  const { can } = useAuth();

  const load = useCallback(async () => {
    const [active, beds, patients] = await Promise.all([
      api.get('/admissions/active'),
      can('bed.view') ? api.get('/beds?status=vacant') : Promise.resolve([]),
      can('patient.view') ? api.get('/patients?status=pending') : Promise.resolve([]),
    ]);
    return { active, beds, patients };
  }, [can]);

  const { data, loading, error, reload } = useModuleData(load, {
    events: [EVENTS.ADMISSION, EVENTS.BED, EVENTS.PATIENT],
  });

  const [draft, setDraft] = useState({ patientId: '', bedId: '' });
  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  async function assign(event) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const result = await api.post('/admissions/assign', {
        patientId: Number(draft.patientId),
        bedId: Number(draft.bedId),
      });
      setMessage(result.message);
      setDraft({ patientId: '', bedId: '' });
      await reload();
    } catch (err) {
      setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  async function discharge(admission) {
    setProblem(null);
    try {
      const result = await api.patch(`/admissions/${admission.id}/discharge`);
      setMessage(result.message);
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  if (loading) return <Spinner label="Loading admissions" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Admissions</h1>
          <p className="page__sub">Who is in a bed right now, and who is waiting for one.</p>
        </div>
      </header>

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem.message}</Notice>}

      {can('admission.assign') && (
        <form className="editor editor--inline" onSubmit={assign}>
          <h2>Admit a patient</h2>
          <div className="editor__row">
            <Field label="Patient">
              <select value={draft.patientId} onChange={(e) => setDraft({ ...draft, patientId: e.target.value })} required>
                <option value="">Waiting for a bed…</option>
                {data.patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Bed">
              <select value={draft.bedId} onChange={(e) => setDraft({ ...draft, bedId: e.target.value })} required>
                <option value="">Vacant beds…</option>
                {data.beds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.bed_number} — {bed.ward_name}
                  </option>
                ))}
              </select>
            </Field>

            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Admitting…' : 'Admit'}
            </button>
          </div>

          {data.patients.length === 0 && (
            <p className="editor__note">Nobody is waiting for a bed right now.</p>
          )}
        </form>
      )}

      <h2>Currently admitted</h2>

      {data.active.length === 0 ? (
        <Empty title="No active admissions">Every bed is free.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Patient</th><th>Where</th><th>Doctor</th><th>Admitted</th><th>Dues</th><th /></tr>
          </thead>
          <tbody>
            {data.active.map((admission) => (
              <tr key={admission.id}>
                <td>
                  <span className="table__strong">{admission.patient_name}</span>
                  <span className="table__sub">admitted by {admission.assigned_by_role_name}</span>
                </td>
                <td>{admission.ward_name} · {admission.bed_number}</td>
                <td>{admission.doctor_name || '—'}</td>
                <td>{new Date(admission.admitted_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  {admission.dues_cleared
                    ? <span className="pill pill--ok">cleared</span>
                    : <span className="pill pill--pending">outstanding</span>}
                </td>
                <td className="table__actions">
                  {can('admission.discharge') && (
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => discharge(admission)}>
                      Discharge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
