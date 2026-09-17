// Clinical records. Pick a patient, read the chart, add to it.
// Reads are audited server-side, which is why this is a separate
// module rather than a panel bolted onto the patient list.

import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { Notice, Spinner, Empty, Field } from '../components/ui';

export default function Records() {
  const { can } = useAuth();
  const load = useCallback(() => api.get('/patients'), []);
  const { data: patients, loading, error } = useModuleData(load);

  const [selected, setSelected] = useState(null);
  const [chart, setChart] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [note, setNote] = useState('');
  const [remark, setRemark] = useState('');
  const [problem, setProblem] = useState(null);

  async function openChart(patient) {
    setSelected(patient);
    setChartLoading(true);
    setProblem(null);
    try {
      setChart(await api.get(`/records/patient/${patient.id}`));
    } catch (err) {
      setProblem(err);
    } finally {
      setChartLoading(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    try {
      await api.post(`/records/patient/${selected.id}/entries`, { content: note });
      setNote('');
      setChart(await api.get(`/records/patient/${selected.id}`));
    } catch (err) {
      setProblem(err);
    }
  }

  async function addRemark(event) {
    event.preventDefault();
    try {
      await api.post(`/records/patient/${selected.id}/remarks`, { remark });
      setRemark('');
      setChart(await api.get(`/records/patient/${selected.id}`));
    } catch (err) {
      setProblem(err);
    }
  }

  if (loading) return <Spinner label="Loading" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Clinical records</h1>
          <p className="page__sub">Opening a chart is recorded in the activity log.</p>
        </div>
      </header>

      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem.message}</Notice>}

      <div className="split split--narrow-first">
        <section>
          <h2>Patients</h2>
          <ul className="picker">
            {patients.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  className={`picker__item${selected?.id === patient.id ? ' picker__item--on' : ''}`}
                  onClick={() => openChart(patient)}
                >
                  <span className="table__strong">{patient.name}</span>
                  <span className="table__sub">{patient.admission_status}</span>
                </button>
              </li>
            ))}
          </ul>
          {patients.length === 0 && <Empty title="No patients" />}
        </section>

        <section>
          {!selected && <Empty title="Choose a patient">Their chart will open here.</Empty>}

          {selected && chartLoading && <Spinner label="Opening chart" />}

          {selected && chart && !chartLoading && (
            <>
              <h2>{selected.name}</h2>

              {can('record.create') && (
                <form className="editor editor--compact" onSubmit={addNote}>
                  <Field label="Add a record entry">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required />
                  </Field>
                  <button type="submit" className="btn btn--primary btn--small">Save entry</button>
                </form>
              )}

              <h3>Record</h3>
              {chart.records.length === 0 ? <Empty title="No entries yet" /> : (
                <ul className="notes">
                  {chart.records.map((entry) => (
                    <li key={entry.id}>
                      <p>{entry.content}</p>
                      <span className="notes__meta">
                        {entry.author_name || 'Unknown'} · {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {can('remark.create') && (
                <form className="editor editor--compact" onSubmit={addRemark}>
                  <Field label="Add a remark">
                    <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} required />
                  </Field>
                  <button type="submit" className="btn btn--primary btn--small">Save remark</button>
                </form>
              )}

              <h3>Remarks</h3>
              {chart.remarks.length === 0 ? <Empty title="No remarks yet" /> : (
                <ul className="notes">
                  {chart.remarks.map((entry) => (
                    <li key={entry.id}>
                      <p>{entry.remark}</p>
                      <span className="notes__meta">
                        {entry.author_name || 'Unknown'} · {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
