import StatusBadge from './StatusBadge';

// Props in React are just function arguments, passed as one
// object. Here the parent (RoomGrid) passes down a `bed` object
// and two OPTIONAL functions: `onAssign` and `onStatusChange`.
// This component doesn't care WHO calls it or WHY — it just
// renders one bed and calls back up when a button is clicked.
// This pattern ("lift state up, pass callbacks down") is the
// core of how React components talk to each other.

export default function BedCard({ bed, onAssign, onStatusChange }) {
  return (
    <div className={`bed-card bed-card--${bed.status}`}>
      <div className="bed-card__top">
        <span className="bed-card__number">{bed.bed_number}</span>
        <StatusBadge status={bed.status} />
      </div>
      <p className="bed-card__meta">
        {bed.ward_name} · Room {bed.room_number}
      </p>

      <div className="bed-card__actions">
        {/* Only render the "Assign" button if the parent gave us
            an onAssign function AND the bed is actually free. */}
        {onAssign && bed.status === 'vacant' && (
          <button className="btn btn--small" onClick={() => onAssign(bed)}>
            Assign patient
          </button>
        )}

        {onStatusChange && (
          <select
            className="bed-card__select"
            value={bed.status}
            onChange={(e) => onStatusChange(bed.id, e.target.value)}
          >
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Maintenance</option>
          </select>
        )}
      </div>
    </div>
  );
}
