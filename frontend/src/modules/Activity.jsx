// The audit trail, read-only. Denials are shown alongside
// successes — a run of them is usually the interesting part.

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import useModuleData from '../lib/useModuleData';
import { Notice, Spinner, Empty } from '../components/ui';

const OUTCOMES = ['', 'success', 'denied', 'failure'];

export default function Activity() {
  const [outcome, setOutcome] = useState('');

  const load = useCallback(
    () => api.get(`/activity?limit=100${outcome ? `&outcome=${outcome}` : ''}`),
    [outcome]
  );

  const { data, loading, error } = useModuleData(load);

  if (loading) return <Spinner label="Loading activity" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Activity log</h1>
          <p className="page__sub">
            Every action taken, including the ones that were refused. This record can’t be edited.
          </p>
        </div>
        <label className="filter">
          <span>Showing</span>
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>{value || 'everything'}</option>
            ))}
          </select>
        </label>
      </header>

      {data.entries.length === 0 ? <Empty title="Nothing recorded yet" /> : (
        <table className="table table--dense">
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>Module</th><th>Outcome</th></tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => (
              <tr key={entry.id}>
                <td className="table__sub">{new Date(entry.created_at).toLocaleString()}</td>
                <td>
                  <span className="table__strong">{entry.user_name || 'Unknown'}</span>
                  <span className="table__sub">{entry.actor_role || '—'}</span>
                </td>
                <td>
                  <code>{entry.action}</code>
                  {entry.entity && <span className="table__sub">{entry.entity} #{entry.entity_id}</span>}
                </td>
                <td className="table__sub">{entry.module_key || '—'}</td>
                <td><span className={`pill pill--${entry.outcome}`}>{entry.outcome}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
