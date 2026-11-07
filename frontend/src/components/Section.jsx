import { useId } from "react";

/**
 * Clean landing section: optional centred header (H2 + one-line subtitle).
 * `tint` adds the subtle #f6f8fb background where grouping helps.
 */
export default function Section({ title, subtitle, tint = false, id, className = "", children }) {
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  return (
    <section
      id={id}
      className={`sec${tint ? " sec-tint" : ""} ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div className="st-container">
        {(title || subtitle) && (
          <header className="sec-head">
            {title && <h2 id={titleId}>{title}</h2>}
            {subtitle && <p className="sec-sub">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
