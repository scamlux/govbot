import { useId } from "react";

/**
 * Skyline-style landing section: a dotted uppercase eyebrow over a large left-aligned H2,
 * with an optional quiet link (`action`) on the right of the heading row.
 */
export default function Section({ eyebrow, title, action, id, className = "", children }) {
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  return (
    <section id={id} className={`sky-sec ${className}`.trim()} aria-labelledby={titleId}>
      <div className="st-container">
        {(eyebrow || title) && (
          <header className="sky-sec-head">
            <div>
              {eyebrow && <p className="sky-eyebrow sky-eyebrow-left">{eyebrow}</p>}
              {title && <h2 id={titleId} className="sky-sec-title">{title}</h2>}
            </div>
            {action}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
