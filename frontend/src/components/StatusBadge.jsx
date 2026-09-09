// A small, reusable "presentational" component. It takes one
// prop (`status`) and just renders a colored pill for it. Note
// how it has NO state, NO API calls — it just turns data into
// UI. This is the simplest, most common kind of React component,
// and you'll write a LOT of these.

const COLORS = {
  vacant: '#1a7a4c',
  occupied: '#b3492a',
  reserved: '#a67c00',
  maintenance: '#5b5f66',
  pending: '#a67c00',
  admitted: '#1a7a4c',
  discharged: '#5b5f66',
};

export default function StatusBadge({ status }) {
  const color = COLORS[status] || '#5b5f66';
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}55` }}
    >
      {status}
    </span>
  );
}
