/**
 * Decorative "Samarqand" ornament (gold + turquoise line work). All aria-hidden: never carries
 * meaning, so it is hidden in low-vision mode (civic.css).
 */

/** 8-point-star (girih) frieze strip under the header. */
export function GirihFrieze() {
  return (
    <div className="lp-frieze" aria-hidden="true">
      <svg width="100%" height="40" focusable="false">
        <defs>
          <pattern id="lp-girih" width="40" height="40" patternUnits="userSpaceOnUse">
            <polygon points="11,11 29,11 29,29 11,29" fill="none" stroke="#B8913F" strokeOpacity="0.5" strokeWidth="1.1" />
            <polygon points="20,7.3 32.7,20 20,32.7 7.3,20" fill="none" stroke="#0A6E78" strokeOpacity="0.38" strokeWidth="1.1" />
          </pattern>
        </defs>
        <rect width="100%" height="40" fill="url(#lp-girih)" />
      </svg>
    </div>
  );
}

/** Thin gold arch (iwan) behind the hero. */
export function HeroArch() {
  return (
    <svg className="lp-arch" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
      <path d="M70 640 L70 330 C70 170 290 52 500 6 C710 52 930 170 930 330 L930 640" fill="#FFFFFF" stroke="#C9A55A" strokeWidth="1.4" />
      <path d="M104 640 L104 338 C104 196 310 86 500 44 C690 86 896 196 896 338 L896 640" fill="none" stroke="#0A6E78" strokeOpacity="0.28" strokeWidth="1" />
    </svg>
  );
}

/** Small arch + star for the closing block. */
export function ClosingArch() {
  return (
    <svg className="lp-orn" width="120" height="110" viewBox="0 0 70 64" aria-hidden="true" focusable="false">
      <path d="M6 64 L6 34 C6 18 22 8 35 2 C48 8 64 18 64 34 L64 64" fill="#FFFFFF" stroke="#C9A55A" strokeWidth="1.6" />
      <polygon points="29,30 41,30 41,42 29,42" fill="none" stroke="#0A6E78" strokeWidth="1.4" />
      <polygon points="35,27.5 43.5,36 35,44.5 26.5,36" fill="none" stroke="#B8913F" strokeWidth="1.4" />
    </svg>
  );
}
