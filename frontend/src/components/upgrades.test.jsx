import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import "../i18n";
import i18n from "../i18n";
import Modal from "./Modal";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";
import HelpContacts, { OFFICIAL_LINES } from "./HelpContacts";
import { AiDisclaimer, AiOnboarding } from "./AiNotice";
import MessageBubble from "./MessageBubble";
import { buildIcs } from "../utils/ics";
import { toSpeakable } from "../hooks/useSpeechOutput";

beforeEach(async () => {
  await act(() => i18n.changeLanguage("en"));
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// R1 — accessible modal
// ---------------------------------------------------------------------------
describe("Modal", () => {
  it("is labelled by its title, focuses inside and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Hello" onClose={onClose}>
        <button type="button">inside</button>
      </Modal>
    );
    const dialog = screen.getByRole("dialog", { name: "Hello" });
    expect(dialog).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("traps Tab inside the dialog", () => {
    render(
      <Modal title="Trap" onClose={() => {}} footer={<button type="button">last</button>}>
        <button type="button">first-body</button>
      </Modal>
    );
    const last = screen.getByText("last");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // Wraps to the first focusable element (the close button in the header).
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });
});

// ---------------------------------------------------------------------------
// R6 — confirm dialog replaces window.confirm
// ---------------------------------------------------------------------------
describe("useConfirm", () => {
  function Harness({ onResult }) {
    const confirm = useConfirm();
    return (
      <button type="button" onClick={async () => onResult(await confirm({ message: "Sure?", danger: true }))}>
        ask
      </button>
    );
  }

  it("resolves true on confirm and false on cancel", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Harness onResult={onResult} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText("ask"));
    expect(screen.getByText("Sure?")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("Delete")));
    expect(onResult).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByText("ask"));
    await act(async () => fireEvent.click(screen.getByText("Cancel")));
    expect(onResult).toHaveBeenLastCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// C6 — official contact lines
// ---------------------------------------------------------------------------
describe("HelpContacts", () => {
  it("renders tel: links for the verified numbers", () => {
    render(<HelpContacts />);
    for (const line of OFFICIAL_LINES) {
      expect(document.querySelector(`a[href="tel:${line.number}"]`)).toBeTruthy();
    }
    expect(OFFICIAL_LINES.map((l) => l.number)).toEqual(["112", "1173", "1242"]);
  });
});

// ---------------------------------------------------------------------------
// A1 — disclaimer + one-time onboarding
// ---------------------------------------------------------------------------
describe("AiNotice", () => {
  it("shows the disclaimer text", () => {
    render(<AiDisclaimer />);
    expect(screen.getByRole("note").textContent).toMatch(/not an official body/);
  });

  it("shows onboarding once and remembers dismissal", () => {
    const { unmount } = render(<AiOnboarding />);
    fireEvent.click(screen.getByText("I understand"));
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    render(<AiOnboarding />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A2 / A6 / C6 — message bubble trust signals
// ---------------------------------------------------------------------------
describe("MessageBubble trust signals", () => {
  const renderBubble = (props) =>
    render(
      <MemoryRouter>
        <MessageBubble role="assistant" content="Answer" {...props} />
      </MemoryRouter>
    );

  it("labels catalog sources with their origin", () => {
    renderBubble({ sources: [{ type: "scenario", slug: "visa", title: "Visa" }] });
    expect(screen.getByText("GovBot catalog")).toBeTruthy();
  });

  it("warns when a real answer has no grounding", () => {
    renderBubble({ messageId: 5, sources: [] });
    expect(screen.getByText(/No verified catalog material/)).toBeTruthy();
  });

  it("does not warn for demo/catalog-only replies", () => {
    renderBubble({ messageId: 5, sources: [], model: "mock" });
    expect(screen.queryByText(/No verified catalog material/)).toBeNull();
  });

  it("shows official contacts after a thumbs-down", () => {
    renderBubble({ messageId: 7, sources: [], onFeedback: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /Not helpful|Didn't help/i }));
    // The reason form may open first; submitting it (or the rating itself) reveals help.
    const submit = screen.queryByRole("button", { name: /send|submit/i });
    if (submit) fireEvent.click(submit);
    expect(document.querySelector('a[href="tel:1242"]')).toBeTruthy();
  });

  it("notes the reply language when it differs from the UI", () => {
    renderBubble({ language: "en", uiLanguage: "uz", langNames: { en: "English" } });
    expect(screen.getByText("Answered in English")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// C4 — .ics reminder / B4 — speakable text
// ---------------------------------------------------------------------------
describe("utilities", () => {
  it("builds an all-day RFC 5545 event on the chosen date", () => {
    const ics = buildIcs({
      title: "GovBot: Visa; renew",
      date: "2026-11-05",
      description: "line1\nline2",
      now: new Date("2026-10-28T10:00:00Z"),
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105");
    expect(ics).toContain("DTEND;VALUE=DATE:20261106");
    expect(ics).toContain("SUMMARY:GovBot: Visa\\; renew");
    expect(ics).toContain("DESCRIPTION:line1\\nline2");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });

  it("strips markdown before speaking", () => {
    expect(toSpeakable("**Bold** and [link](https://x) `code`")).toBe("Bold and link code");
  });
});
