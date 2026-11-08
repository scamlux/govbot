import { useId } from "react";

/**
 * Centred page section of the "Samarqand x Paxta" look: big H2, optional lead paragraph.
 * `band` puts the section on a full-width white strip (regions, pipeline).
 */
export default function Section({ id, title, lead, band = false, className = "", children }) {
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  const classes = ["lp-sec", band ? "lp-band" : "", className].filter(Boolean).join(" ");
  return (
    <section id={id} className={classes} aria-labelledby={titleId}>
      <div className="lp-wrap">
        {title && (
          <header className="lp-sec-head">
            <h2 id={titleId} className="lp-h2">{title}</h2>
            {lead && <p className="lp-lead lp-lead-sm">{lead}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
