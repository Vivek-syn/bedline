// The dues gate that stands in front of discharge.

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { EVENTS } from '../lib/realtime';
import { Notice, Spinner, Empty } from '../components/ui';

export default function Billing() {
  const { can } = useAuth();
  const load = useCallback(() => api.get('/billing?includeCleared=true'), []);
  const { data: rows, loading, error, reload } = useModuleData(load, {
    events: [EVENTS.PATIENT, EVENTS.ADMISSION],
  });

  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(null);

  async function clear(patient) {
    setProblem(null);
    try {
      const result = await api.patch(`/billing/patient/${patient.id}/clear`);
      setMessage(result.message);
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  async function reopen(patient) {
    const reason = window.prompt(`Why are you reopening dues for ${patient.name}?`);
    if (!reason) return;
    try {
      const result = await api.patch(`/billing/patient/${patient.id}/reopen`, { reason });
      setMessage(result.message);
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  if (loading) return <Spinner label="Loading billing" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  const outstanding = rows.filter((row) => !row.dues_cleared);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Billing</h1>
          <p className="page__sub">
            A patient can’t be discharged until their dues are cleared here.
          </p>
        </div>
      </header>

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem.message}</Notice>}

      <div className="stats">
        <div className="stat"><span className="stat__value">{outstanding.length}</span><span className="stat__label">Outstanding</span></div>
        <div className="stat"><span className="stat__value">{rows.length - outstanding.length}</span><span className="stat__label">Cleared</span></div>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing to bill" />
      ) : (
        <table className="table">
          <thead>
            <tr><th>Patient</th><th>Where</th><th>Dues</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><span className="table__strong">{row.name}</span></td>
                <td>{row.bed_number ? `${row.ward_name} · ${row.bed_number}` : '—'}</td>
                <td>
                  {row.dues_cleared
                    ? <span className="pill pill--ok">cleared</span>
                    : <span className="pill pill--pending">outstanding</span>}
                </td>
                <td className="table__actions">
                  {!row.dues_cleared && can('billing.clear_dues') && (
                    <button type="button" className="btn btn--small btn--primary" onClick={() => clear(row)}>
                      Clear dues
                    </button>
                  )}
                  {row.dues_cleared && can('billing.reopen') && (
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => reopen(row)}>
                      Reopen
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
