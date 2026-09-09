import StatusBadge from './StatusBadge';
import { canSupersede } from '../utils/permissions';

// One table, reused by Doctor/Nurse/Admin dashboards, each
// passing different `actorRole` and callback props. This avoids
// three near-identical copies of the same table markup.
//
// `onDeassign` / `onRecords` are optional — if a parent doesn't
// pass one, that button simply doesn't render (same pattern as
// BedCard's onAssign/onStatusChange).
export default function ActiveAdmissionsTable({ admissions, actorRole, onDeassign, onRecords }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Patient</th><th>Ward</th><th>Room</th><th>Bed</th>
          <th>Assigned by</th><th>Dues</th><th></th>
        </tr>
      </thead>
      <tbody>
        {admissions.map((a) => {
          // UI hint only — the server re-checks this for real.
          const locked = !canSupersede(actorRole, a.assigned_by_role);
          return (
            <tr key={a.id}>
              <td>{a.patient_name}</td>
              <td>{a.ward_name}</td>
              <td>{a.room_number}</td>
              <td>{a.bed_number}</td>
              <td><StatusBadge status={a.assigned_by_role} /></td>
              <td><StatusBadge status={a.dues_cleared ? 'admitted' : 'pending'} /></td>
              <td className="table-actions">
                {onRecords && (
                  <button className="btn btn--small btn--ghost" onClick={() => onRecords(a.patient_id)}>
                    Records
                  </button>
                )}
                {onDeassign && (
                  <button
                    className="btn btn--small"
                    disabled={locked}
                    title={locked ? `Locked by a ${a.assigned_by_role} — you can't override this.` : ''}
                    onClick={() => onDeassign(a.id)}
                  >
                    De-assign
                  </button>
                )}
              </td>
            </tr>
          );
        })}
        {admissions.length === 0 && (
          <tr><td colSpan={7} className="empty-state">No active admissions.</td></tr>
        )}
      </tbody>
    </table>
  );
}
