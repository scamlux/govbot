/**
 * Monochrome line icons (24px grid, 1.75 stroke, currentColor) for the "Civic Studio"
 * look. Replaces coloured emoji on landing/role/step cards. Decorative: aria-hidden.
 */
const PATHS = {
  // roles
  citizen: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14.5 10h4M14.5 13.5h3" />
    </>
  ),
  resident: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5V14h4v5.5" />
    </>
  ),
  tourist: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  // how it works
  chat: (
    <>
      <path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
      <path d="M5 16.5a3 3 0 0 1 3-3h11M9 8h6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
    </>
  ),
  // categories (backend slugs)
  "identity-documents": (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8.5 16.5h7" />
    </>
  ),
  business: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3 13h18" />
    </>
  ),
  taxes: (
    <>
      <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z" />
      <path d="m9.5 14.5 5-5M9.8 9.8h.01M14.2 14.2h.01" />
    </>
  ),
  healthcare: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  "visa-migration": (
    <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z" />
  ),
  transport: (
    <>
      <path d="M5 16.5V11l2-5h10l2 5v5.5H5z" />
      <path d="M5 11h14M7.5 16.5v2.5M16.5 16.5v2.5M8 14h.01M16 14h.01" />
    </>
  ),
  residence: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
};

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

export default function Icon({ name, size = 24, className = "" }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}

/** Category glyph: line icon for known slugs, the backend emoji for unknown ones. */
export function CategoryIcon({ slug, fallback, size = 26 }) {
  if (hasIcon(slug)) return <Icon name={slug} size={size} />;
  return <span aria-hidden="true">{fallback}</span>;
}
