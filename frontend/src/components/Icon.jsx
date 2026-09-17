// Inline SVG icons keyed by the `icon` string each module
// declares in its backend manifest. Inline rather than an icon
// package so a new module needs no bundle change, and unknown
// names fall back to a neutral shape instead of crashing.

const PATHS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  bed: 'M3 7v11M3 12h18v6M21 18v-5a3 3 0 0 0-3-3h-7M7 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clipboard: 'M9 3h6v3H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h4',
  'arrow-right': 'M4 12h14M13 6l6 6-6 6',
  layout: 'M3 4h18v16H3zM3 10h18M10 10v10',
  'file-text': 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 12h6M9 16h4',
  receipt: 'M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3zM9 8h6M9 12h6',
  heart: 'M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20z',
  shield: 'M12 3l8 3v6c0 4.5-3.3 8.2-8 9-4.7-.8-8-4.5-8-9V6zM9 12l2 2 4-4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 20v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  square: 'M4 4h16v16H4z',
};

export default function Icon({ name, size = 18 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name] || PATHS.square} />
    </svg>
  );
}
