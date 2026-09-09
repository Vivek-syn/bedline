import BedCard from './BedCard';

// This component takes a LIST of beds and renders one BedCard
// per bed. The `.map()` here is plain JavaScript — React just
// expects an array of elements back, and `.map()` is the
// idiomatic way to produce one.
//
// The `key={bed.id}` prop is special to React: when it re-renders
// a list, it uses `key` to figure out which items changed, were
// added, or were removed, instead of re-building the whole list
// from scratch. Always use a stable, unique id as the key —
// never the array index if the list can reorder.

export default function RoomGrid({ beds, onAssign, onStatusChange }) {
  if (beds.length === 0) {
    return <p className="empty-state">No beds match this view.</p>;
  }

  return (
    <div className="room-grid">
      {beds.map((bed) => (
        <BedCard key={bed.id} bed={bed} onAssign={onAssign} onStatusChange={onStatusChange} />
      ))}
    </div>
  );
}
