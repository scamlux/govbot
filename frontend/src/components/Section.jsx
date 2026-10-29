import { useId } from "react";

/**
 * "Civic Studio" section: a full-width 1px rule with a centred mono eyebrow sitting on
 * it, then a centred H2 + subtitle and the content. `tone` switches day / night.
 */
export default function Section({
  eyebrow,
  title,
  subtitle,
  tone = "day",
  id,
  className = "",
  children,
}) {
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  return (
    <section
      id={id}
      className={`st-section st-${tone} ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div className="st-rule">
        {eyebrow && <span className="st-eyebrow">{eyebrow}</span>}
      </div>
      <div className="st-container st-section-body">
        {(title || subtitle) && (
          <header className="st-section-head">
            {title && <h2 id={titleId}>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
