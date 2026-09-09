import { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';

export default function ReceptionistDashboard() {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ name: '', age: '', gender: '', contact: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const res = await api.get('/patients');
    setPatients(res.data);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/patients', form);
      setMessage(`Registered ${form.name}.`);
      setForm({ name: '', age: '', gender: '', contact: '' });
      loadPatients(); // refresh the list below
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not register patient.');
    }
  }

  // This is the gate a doctor/nurse's discharge attempt checks
  // against — a patient can't be discharged until this is true.
  async function handleClearDues(patientId) {
    await api.patch(`/patients/${patientId}/clear-dues`);
    loadPatients();
  }

  return (
    <div className="page">
      <Navbar title="Front Desk" />
      <div className="page-content page-content--split">
        <section>
          <h2>Register a new patient</h2>
          {message && <p className="form-note">{message}</p>}
          <form onSubmit={handleSubmit} className="stacked-form">
            <label>
              Full name
              <input name="name" value={form.name} onChange={handleChange} required />
            </label>
            <label>
              Age
              <input type="number" name="age" value={form.age} onChange={handleChange} />
            </label>
            <label>
              Gender
              <input name="gender" value={form.gender} onChange={handleChange} />
            </label>
            <label>
              Contact number
              <input name="contact" value={form.contact} onChange={handleChange} />
            </label>
            <button type="submit" className="btn btn--primary">Register patient</button>
          </form>
        </section>

        <section>
          <h2>All patients</h2>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Status</th><th>Doctor</th><th>Dues</th><th></th></tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><StatusBadge status={p.admission_status} /></td>
                  <td>{p.doctor_name || '—'}</td>
                  <td><StatusBadge status={p.dues_cleared ? 'admitted' : 'pending'} /></td>
                  <td>
                    {!p.dues_cleared && (
                      <button className="btn btn--small" onClick={() => handleClearDues(p.id)}>
                        Clear dues
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
