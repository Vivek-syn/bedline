import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { EVENTS } from '../lib/realtime';
import { Notice, Spinner, Empty, Field, fieldErrors, firstError } from '../components/ui';

const BLANK = { name: '', age: '', gender: '', contact: '' };

export default function Patients() {
  const { can } = useAuth();
  const load = useCallback(() => api.get('/patients'), []);
  const { data: patients, loading, error, reload } = useModuleData(load, {
    events: [EVENTS.PATIENT, EVENTS.ADMISSION],
  });

  const [draft, setDraft] = useState(BLANK);
  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(null);

  async function register(event) {
    event.preventDefault();
    setProblem(null);
    try {
      await api.post('/patients', {
        name: draft.name,
        age: draft.age === '' ? undefined : Number(draft.age),
        gender: draft.gender || undefined,
        contact: draft.contact || undefined,
      });
      setMessage(`${draft.name} is on the register.`);
      setDraft(BLANK);
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  if (loading) return <Spinner label="Loading patients" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  const errors = fieldErrors(problem);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Patients</h1>
          <p className="page__sub">Everyone on the register, and where they are.</p>
        </div>
      </header>

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem.message}</Notice>}

      <div className="split">
        {can('patient.create') && (
          <form className="editor" onSubmit={register}>
            <h2>Register an arrival</h2>
            <Field label="Full name" error={firstError(errors, 'name')}>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </Field>
            <Field label="Age" error={firstError(errors, 'age')}>
              <input type="number" min="0" max="130" value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} />
            </Field>
            <Field label="Gender" error={firstError(errors, 'gender')}>
              <input value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })} />
            </Field>
            <Field label="Contact number" error={firstError(errors, 'contact')}>
              <input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
            </Field>
            <button type="submit" className="btn btn--primary">Register patient</button>
          </form>
        )}

        <section>
          <h2>On the register</h2>
          {patients.length === 0 ? (
            <Empty title="Nobody registered yet" />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Status</th><th>Where</th><th>Doctor</th></tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <span className="table__strong">{patient.name}</span>
                      <span className="table__sub">
                        {[patient.age && `${patient.age}y`, patient.gender, patient.contact].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </td>
                    <td><span className={`pill pill--${patient.admission_status}`}>{patient.admission_status}</span></td>
                    <td>{patient.bed_number ? `${patient.ward_name} · ${patient.bed_number}` : '—'}</td>
                    <td>{patient.doctor_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
