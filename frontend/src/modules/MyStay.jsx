// The patient's own view. Every query behind it is scoped by the
// signed-in account, so there is no patient id in any URL here.

import { useCallback } from 'react';
import { api } from '../lib/api';
import useModuleData from '../lib/useModuleData';
import { EVENTS } from '../lib/realtime';
import { Notice, Spinner, Empty } from '../components/ui';

export default function MyStay() {
  const load = useCallback(async () => {
    const [stay, remarks] = await Promise.all([
      api.get('/my-stay'),
      api.get('/my-stay/remarks').catch(() => []),
    ]);
    return { stay, remarks };
  }, []);

  const { data, loading, error } = useModuleData(load, {
    events: [EVENTS.ADMISSION, EVENTS.PATIENT],
  });

  if (loading) return <Spinner label="Loading your details" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  const { stay, remarks } = data;

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <h1>Your stay</h1>
          <p className="page__sub">Hello {stay.name}. Here’s where things stand.</p>
        </div>
      </header>

      <div className="card">
        <div className="card__row">
          <span>Status</span>
          <span className={`pill pill--${stay.admission_status}`}>{stay.admission_status}</span>
        </div>
        <div className="card__row"><span>Ward</span><strong>{stay.ward_name || 'Not assigned yet'}</strong></div>
        <div className="card__row"><span>Room</span><strong>{stay.room_number || '—'}</strong></div>
        <div className="card__row"><span>Bed</span><strong>{stay.bed_number || '—'}</strong></div>
        <div className="card__row"><span>Your doctor</span><strong>{stay.doctor_name || 'Not assigned yet'}</strong></div>
        <div className="card__row">
          <span>Account</span>
          <strong>{stay.dues_cleared ? 'Settled' : 'Something outstanding'}</strong>
        </div>
        {stay.admitted_at && (
          <div className="card__row">
            <span>Admitted</span>
            <strong>{new Date(stay.admitted_at).toLocaleString()}</strong>
          </div>
        )}
      </div>

      <h2>Notes from your care team</h2>
      {remarks.length === 0 ? (
        <Empty title="No notes yet">Anything your team wants you to see will appear here.</Empty>
      ) : (
        <ul className="notes">
          {remarks.map((entry) => (
            <li key={entry.id}>
              <p>{entry.remark}</p>
              <span className="notes__meta">
                {entry.author_name || 'Care team'} · {new Date(entry.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
