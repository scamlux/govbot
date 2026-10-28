import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";

const DEBOUNCE_MS = 300;

/**
 * R4 — global search palette (Ctrl/⌘+K): type to find catalog topics, or send the
 * query straight to the AI chat as a prefill. Implements the ARIA combobox pattern
 * (listbox + aria-activedescendant) so it works with a keyboard and screen readers.
 */
export default function CommandPalette({ open, onClose }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
  const listId = useId();
  const inputRef = useRef(null);
  const openerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    setQuery("");
    setResults([]);
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => openerRef.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(() => {
      scenariosApi
        .list(i18n.language, { search: q })
        .then(({ data }) => {
          if (!alive) return;
          const rows = Array.isArray(data) ? data : data?.results || [];
          setResults(rows.slice(0, 8));
          setActive(0);
        })
        .catch(() => alive && setResults([]));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, open, i18n.language]);

  if (!open) return null;

  const q = query.trim();
  // Last option is always "ask the AI" when there is a query.
  const options = [
    ...results.map((r) => ({ kind: "scenario", id: r.slug, label: r.title, hint: r.excerpt })),
    ...(q ? [{ kind: "ask", id: "__ask__", label: t("palette.ask", { q }) }] : []),
  ];

  const choose = (option) => {
    if (!option) return;
    onClose();
    if (option.kind === "scenario") {
      navigate(`/scenarios/${option.id}`);
      return;
    }
    const canChat = user || guestChat;
    navigate(canChat ? "/chat" : "/login", {
      state: canChat ? { prefill: q } : { from: { pathname: "/chat" }, prefill: q },
    });
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Tab") {
      // Single focusable element: keep focus inside the dialog.
      e.preventDefault();
    }
  };

  const optionId = (i) => `${listId}-opt-${i}`;

  return createPortal(
    <div
      className="palette-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={t("palette.title")}>
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={options.length ? optionId(active) : undefined}
          aria-autocomplete="list"
          placeholder={t("palette.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul id={listId} role="listbox" className="palette-list" aria-label={t("palette.title")}>
          {options.map((o, i) => (
            <li
              key={o.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className="palette-item"
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              <span>{o.kind === "ask" ? `💬 ${o.label}` : o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </li>
          ))}
        </ul>
        {q && results.length === 0 && <p className="palette-empty">{t("palette.empty")}</p>}
        <p className="palette-hint">{t("palette.hint")}</p>
      </div>
    </div>,
    document.body
  );
}
