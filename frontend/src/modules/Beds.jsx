// Bed map. Status controls appear only for someone holding
// bed.update_status, and the server still re-checks — plus it
// refuses to free a bed that has a live admission, so the reason
// a control is disabled is explained in place.

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { EVENTS } from '../lib/realtime';
import { Notice, Spinner, Empty, Field } from '../components/ui';

const STATUSES = ['vacant', 'occupied', 'reserved', 'maintenance'];

export default function Beds() {
  const { can } = useAuth();
  const load = useCallback(() => api.get('/beds'), []);
  const { data: beds, loading, error, reload } = useModuleData(load, {
    events: [EVENTS.BED, EVENTS.ADMISSION],
  });

  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ roomId: '', bedNumber: '' });

  async function changeStatus(bed, status) {
    setProblem(null);
    try {
      await api.patch(`/beds/${bed.id}/status`, { status });
      setMessage(`Bed ${bed.bed_number} is now ${status}.`);
      await reload();
    } catch (err) {
      setProblem(err);
      await reload();
    }
  }

  async function addBed(event) {
    event.preventDefault();
    try {
      await api.post('/beds', { roomId: Number(draft.roomId), bedNumber: draft.bedNumber });
      setMessage(`Bed ${draft.bedNumber} added.`);
      setDraft({ roomId: '', bedNumber: '' });
      setAdding(false);
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  if (loading) return <Spinner label="Loading beds" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  const total = beds.length;
  const occupied = beds.filter((bed) => bed.status === 'occupied').length;
  const vacant = beds.filter((bed) => bed.status === 'vacant').length;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Beds</h1>
          <p className="page__sub">Every bed in the hospital and what state it’s in.</p>
        </div>
        {can('bed.create') && !adding && (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>Add bed</button>
        )}
      </header>

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem.message}</Notice>}

      <div className="stats">
        <div className="stat"><span className="stat__value">{total}</span><span className="stat__label">Total beds</span></div>
        <div className="stat"><span className="stat__value">{occupied}</span><span className="stat__label">Occupied</span></div>
        <div className="stat"><span className="stat__value">{vacant}</span><span className="stat__label">Vacant</span></div>
        <div className="stat">
          <span className="stat__value">{total ? Math.round((occupied / total) * 100) : 0}%</span>
          <span className="stat__label">Occupancy</span>
        </div>
      </div>

      {adding && (
        <form className="editor" onSubmit={addBed}>
          <h2>Add a bed</h2>
          <div className="editor__row">
            <Field label="Room id" hint="From Wards and rooms">
              <input value={draft.roomId} onChange={(e) => setDraft({ ...draft, roomId: e.target.value })} required />
            </Field>
            <Field label="Bed number">
              <input value={draft.bedNumber} onChange={(e) => setDraft({ ...draft, bedNumber: e.target.value })} required />
            </Field>
          </div>
          <div className="editor__actions">
            <button type="submit" className="btn btn--primary">Add bed</button>
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {beds.length === 0 ? (
        <Empty title="No beds yet">Add wards and rooms first, then put beds in them.</Empty>
      ) : (
        <div className="bedgrid">
          {beds.map((bed) => (
            <article key={bed.id} className={`bedcard bedcard--${bed.status}`}>
              <div className="bedcard__top">
                <span className="bedcard__number">{bed.bed_number}</span>
                <span className={`pill pill--${bed.status}`}>{bed.status}</span>
              </div>
              <p className="bedcard__where">{bed.ward_name} · room {bed.room_number}</p>

              {bed.patient_name && (
                <p className="bedcard__patient">
                  {bed.patient_name}
                  {bed.assigned_by_role_name && (
                    <span className="bedcard__by">admitted by {bed.assigned_by_role_name}</span>
                  )}
                </p>
              )}

              {can('bed.update_status') && (
                <select
                  className="bedcard__status"
                  value={bed.status}
                  disabled={Boolean(bed.admission_id)}
                  title={bed.admission_id ? 'A patient is in this bed — discharge them from Admissions first.' : undefined}
                  onChange={(event) => changeStatus(bed, event.target.value)}
                  aria-label={`Status for bed ${bed.bed_number}`}
                >
                  {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
