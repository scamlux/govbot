import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Modal from "./Modal";

/**
 * R6 — accessible replacement for window.confirm().
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: t("chat.deleteConfirm"), danger: true }))) return;
 *
 * Unlike the native dialog it is translated, styled, keyboard-trappable and doesn't
 * block the JS thread (so streaming replies keep rendering behind it).
 */
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setRequest(typeof options === "string" ? { message: options } : options);
    });
  }, []);

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal
          title={request.title || t("admin.confirmTitle")}
          onClose={() => settle(false)}
          initialFocus=".confirm-cancel"
          footer={
            <>
              <button type="button" className="btn btn-ghost confirm-cancel" onClick={() => settle(false)}>
                {request.cancelLabel || t("common.cancel")}
              </button>
              <button
                type="button"
                className={request.danger ? "btn btn-danger" : "btn btn-primary"}
                onClick={() => settle(true)}
              >
                {request.confirmLabel || (request.danger ? t("common.delete") : t("common.confirm"))}
              </button>
            </>
          }
        >
          <p className="confirm-message">{request.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  // Outside the provider (e.g. isolated component tests) fall back to the native dialog.
  return ctx || ((options) => Promise.resolve(window.confirm(options?.message ?? options)));
}
