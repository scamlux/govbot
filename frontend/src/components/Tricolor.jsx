/** Thin flag-colour line at the very top of the page. Decorative; the only national accent. */
export default function Tricolor({ className = "" }) {
  return <div className={`tricolor ${className}`.trim()} aria-hidden="true" />;
}
