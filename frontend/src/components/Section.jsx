import { useId } from "react";

const TONES = { day: "paper", night: "dark" };

/**
 * Skyline-style "sheet": a full-width block whose top corners are rounded (36px) and which
 * overlaps the previous block. `tone` = paper | paper2 | dark | night. The header is
 * centred: eyebrow (short line + label), H2, subtitle.
 */
export default function Section({
  eyebrow,
  title,
  subtitle,
  tone = "paper",
  id,
  className = "",
  children,
}) {
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  const t = TONES[tone] || tone;
  return (
    <section
      id={id}
      className={`st-section st-tone-${t} ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div className="st-container st-section-body">
        {(eyebrow || title || subtitle) && (
          <header className="st-section-head">
            {eyebrow && <p className="st-eyebrow">{eyebrow}</p>}
            {title && <h2 id={titleId}>{title}</h2>}
            {subtitle && <p className="st-section-sub">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
