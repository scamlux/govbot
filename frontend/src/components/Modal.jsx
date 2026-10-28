import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog (R1).
 *
 * - focus moves into the dialog on open and returns to the opener on close;
 * - Tab / Shift+Tab are trapped inside the dialog;
 * - Escape closes; a click (not a drag that started inside) on the backdrop closes;
 * - the title is wired up via aria-labelledby.
 */
export default function Modal({ title, onClose, children, footer, wide = false, initialFocus }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const titleId = useId();
  const pressStartedOnBackdrop = useRef(false);
  // Always call the latest onClose (callers often pass inline closures).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    const first =
      (initialFocus && dialog?.querySelector(initialFocus)) ||
      dialog?.querySelector(FOCUSABLE) ||
      dialog;
    first?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const nodes = [...dialog.querySelectorAll(FOCUSABLE)].filter(
        (n) => !n.closest("[hidden], [inert]")
      );
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (opener && typeof opener.focus === "function") opener.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portal to <body>: pages animate their root with a transform, which would otherwise
  // trap this fixed overlay inside the page's stacking context (and under its content).
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressStartedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={wide ? "modal modal-wide" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h3 id={titleId} className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
