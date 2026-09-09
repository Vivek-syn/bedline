// ============================================================
// ADMIN DASHBOARD
// Admin outranks everyone: the discharge/de-assign call here
// bypasses BOTH the supersede rule and the dues-clearance gate
// (see admissionController.dischargePatient on the backend —
// it explicitly checks `actorRole !== 'admin'` before applying
// either restriction). This page also exposes the one thing
// no other role can do: building out new wards/rooms/beds.
// ============================================================

import { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import ActiveAdmissionsTable from '../components/ActiveAdmissionsTable';

export default function AdminDashboard() {
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [wards, setWards] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [wardForm, setWardForm] = useState({ name: '', floor: '', type: '' });
  const [roomForm, setRoomForm] = useState({ wardId: '', roomNumber: '', capacity: 1 });
  const [bedForm, setBedForm] = useState({ roomId: '', bedNumber: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [bedsRes, admissionsRes, wardsRes] = await Promise.all([
      api.get('/beds'),
      api.get('/admissions/active'),
      api.get('/wards'),
    ]);
    setBeds(bedsRes.data);
    setAdmissions(admissionsRes.data);
    setWards(wardsRes.data);
    setLoading(false);
  }

  // Whenever the admin picks a ward in the "add room" form, fetch
  // that ward's rooms so the "add bed" form's dropdown can use them.
  async function handleWardSelectForRoom(wardId) {
    setRoomForm((prev) => ({ ...prev, wardId }));
  }

  async function loadRoomsForBedForm(wardId) {
    if (!wardId) { setRooms([]); return; }
    const res = await api.get(`/wards/${wardId}/rooms`);
    setRooms(res.data);
  }

  const total = beds.length;
  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const vacant = beds.filter((b) => b.status === 'vacant').length;

  async function handleDischarge(admissionId) {
    setMessage('');
    try {
      await api.patch(`/admissions/${admissionId}/discharge`);
      setMessage('Discharged — bed freed.');
      loadAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not discharge.');
    }
  }

  async function submitWard(e) {
    e.preventDefault();
    await api.post('/wards', wardForm);
    setMessage(`Ward "${wardForm.name}" created.`);
    setWardForm({ name: '', floor: '', type: '' });
    loadAll();
  }

  async function submitRoom(e) {
    e.preventDefault();
    await api.post(`/wards/${roomForm.wardId}/rooms`, {
      roomNumber: roomForm.roomNumber,
      capacity: Number(roomForm.capacity) || 1,
    });
    setMessage(`Room "${roomForm.roomNumber}" created.`);
    setRoomForm({ wardId: '', roomNumber: '', capacity: 1 });
  }

  async function submitBed(e) {
    e.preventDefault();
    await api.post('/beds', { roomId: bedForm.roomId, bedNumber: bedForm.bedNumber });
    setMessage(`Bed "${bedForm.bedNumber}" created.`);
    setBedForm({ roomId: '', bedNumber: '' });
    loadAll();
  }

  if (loading) return <p className="page-content">Loading…</p>;

  return (
    <div className="page">
      <Navbar title="Admin Overview" />
      <div className="page-content">
        {message && <p className="form-note">{message}</p>}

        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-card__value">{total}</span>
            <span className="stat-card__label">Total beds</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{occupied}</span>
            <span className="stat-card__label">Occupied</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{vacant}</span>
            <span className="stat-card__label">Vacant</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">
              {total ? Math.round((occupied / total) * 100) : 0}%
            </span>
            <span className="stat-card__label">Occupancy rate</span>
          </div>
        </div>

        <h2>Active admissions</h2>
        <p className="empty-state">
          Admin bypasses both the supersede rule and the dues-clearance gate — discharge always works here.
        </p>
        <ActiveAdmissionsTable admissions={admissions} actorRole="admin" onDeassign={handleDischarge} />

        <h2>Hospital layout</h2>
        <div className="layout-forms">
          <form onSubmit={submitWard} className="stacked-form">
            <h4>Add ward</h4>
            <label>Name
              <input value={wardForm.name} onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })} required />
            </label>
            <label>Floor
              <input type="number" value={wardForm.floor} onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })} />
            </label>
            <label>Type
              <input value={wardForm.type} onChange={(e) => setWardForm({ ...wardForm, type: e.target.value })} placeholder="ICU, General…" />
            </label>
            <button className="btn btn--primary" type="submit">Add ward</button>
          </form>

          <form onSubmit={submitRoom} className="stacked-form">
            <h4>Add room</h4>
            <label>Ward
              <select value={roomForm.wardId} onChange={(e) => handleWardSelectForRoom(e.target.value)} required>
                <option value="">Select ward…</option>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label>Room number
              <input value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} required />
            </label>
            <label>Capacity
              <input type="number" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
            </label>
            <button className="btn btn--primary" type="submit">Add room</button>
          </form>

          <form onSubmit={submitBed} className="stacked-form">
            <h4>Add bed</h4>
            <label>Ward (to find rooms)
              <select onChange={(e) => loadRoomsForBedForm(e.target.value)}>
                <option value="">Select ward…</option>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label>Room
              <select value={bedForm.roomId} onChange={(e) => setBedForm({ ...bedForm, roomId: e.target.value })} required>
                <option value="">Select room…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
              </select>
            </label>
            <label>Bed number
              <input value={bedForm.bedNumber} onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })} required />
            </label>
            <button className="btn btn--primary" type="submit">Add bed</button>
          </form>
        </div>
      </div>
    </div>
  );
}
