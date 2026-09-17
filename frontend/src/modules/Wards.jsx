import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { Notice, Spinner, Empty, Field } from '../components/ui';

export default function Wards() {
  const { can } = useAuth();
  const load = useCallback(() => api.get('/wards'), []);
  const { data: wards, loading, error, reload } = useModuleData(load);

  const [rooms, setRooms] = useState({});
  const [wardDraft, setWardDraft] = useState({ name: '', floor: '', type: '' });
  const [roomDraft, setRoomDraft] = useState({ wardId: '', roomNumber: '', capacity: 1 });
  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(null);

  async function showRooms(ward) {
    if (rooms[ward.id]) {
      setRooms(({ [ward.id]: _drop, ...rest }) => rest);
      return;
    }
    try {
      const list = await api.get(`/wards/${ward.id}/rooms`);
      setRooms((current) => ({ ...current, [ward.id]: list }));
    } catch (err) {
      setProblem(err);
    }
  }

  async function addWard(event) {
    event.preventDefault();
    try {
      await api.post('/wards', {
        name: wardDraft.name,
        floor: wardDraft.floor === '' ? undefined : Number(wardDraft.floor),
        type: wardDraft.type || undefined,
      });
      setMessage(`Ward “${wardDraft.name}” added.`);
      setWardDraft({ name: '', floor: '', type: '' });
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  async function addRoom(event) {
    event.preventDefault();
    try {
      await api.post(`/wards/${roomDraft.wardId}/rooms`, {
        roomNumber: roomDraft.roomNumber,
        capacity: Number(roomDraft.capacity) || 1,
      });
      setMessage(`Room ${roomDraft.roomNumber} added.`);
      setRoomDraft({ wardId: '', roomNumber: '', capacity: 1 });
      setRooms({});
      await reload();
    } catch (err) {
      setProblem(err);
    }
  }

  if (loading) return <Spinner label="Loading layout" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Wards and rooms</h1>
          <p className="page__sub">The physical layout everything else hangs off.</p>
        </div>
      </header>

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem.message}</Notice>}

      {can('ward.manage') && (
        <div className="split">
          <form className="editor" onSubmit={addWard}>
            <h2>Add a ward</h2>
            <Field label="Name"><input value={wardDraft.name} onChange={(e) => setWardDraft({ ...wardDraft, name: e.target.value })} required /></Field>
            <Field label="Floor"><input type="number" value={wardDraft.floor} onChange={(e) => setWardDraft({ ...wardDraft, floor: e.target.value })} /></Field>
            <Field label="Type" hint="ICU, General, Maternity…"><input value={wardDraft.type} onChange={(e) => setWardDraft({ ...wardDraft, type: e.target.value })} /></Field>
            <button type="submit" className="btn btn--primary">Add ward</button>
          </form>

          <form className="editor" onSubmit={addRoom}>
            <h2>Add a room</h2>
            <Field label="Ward">
              <select value={roomDraft.wardId} onChange={(e) => setRoomDraft({ ...roomDraft, wardId: e.target.value })} required>
                <option value="">Choose a ward…</option>
                {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
              </select>
            </Field>
            <Field label="Room number"><input value={roomDraft.roomNumber} onChange={(e) => setRoomDraft({ ...roomDraft, roomNumber: e.target.value })} required /></Field>
            <Field label="Capacity" hint="How many beds this room can hold.">
              <input type="number" min="1" value={roomDraft.capacity} onChange={(e) => setRoomDraft({ ...roomDraft, capacity: e.target.value })} />
            </Field>
            <button type="submit" className="btn btn--primary">Add room</button>
          </form>
        </div>
      )}

      <h2>Layout</h2>
      {wards.length === 0 ? <Empty title="No wards yet" /> : (
        <table className="table">
          <thead><tr><th>Ward</th><th>Floor</th><th>Type</th><th>Rooms</th><th>Beds</th><th /></tr></thead>
          <tbody>
            {wards.map((ward) => (
              <>
                <tr key={ward.id}>
                  <td><span className="table__strong">{ward.name}</span></td>
                  <td>{ward.floor ?? '—'}</td>
                  <td>{ward.type || '—'}</td>
                  <td>{ward.room_count}</td>
                  <td>{ward.bed_count}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => showRooms(ward)}>
                      {rooms[ward.id] ? 'Hide rooms' : 'Show rooms'}
                    </button>
                  </td>
                </tr>
                {rooms[ward.id] && (
                  <tr key={`${ward.id}-rooms`} className="table__row--nested">
                    <td colSpan={6}>
                      {rooms[ward.id].length === 0 ? 'No rooms in this ward yet.' : (
                        <ul className="chiplist">
                          {rooms[ward.id].map((room) => (
                            <li key={room.id} className="chip">
                              <strong>Room {room.room_number}</strong>
                              <span>id {room.id} · {room.bed_count}/{room.capacity} beds</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
