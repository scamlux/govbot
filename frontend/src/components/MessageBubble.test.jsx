import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import i18n from "../i18n";
import MessageBubble from "./MessageBubble";

// MessageBubble may render a react-router <Link> for scenario source chips, so
// every render is wrapped in a router. Assertions target the "uz" locale (the
// app default), so pin the shared i18n singleton before each test.
function renderBubble(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  cleanup();
});

describe("MessageBubble", () => {
  it("renders a user message as plain text under the 'you' author label", () => {
    renderBubble(<MessageBubble role="user" content="Salom bot" />);

    expect(screen.getByText("Siz")).toBeInTheDocument();
    expect(screen.getByText("Salom bot")).toBeInTheDocument();
  });

  it("renders an assistant message with the GovBot label and a typing cursor while pending", () => {
    const { container } = renderBubble(
      <MessageBubble role="assistant" content="Javob matni" pending />
    );

    expect(screen.getByText("GovBot")).toBeInTheDocument();
    expect(screen.getByText("Javob matni")).toBeInTheDocument();
    // The blinking cursor only appears while the stream is still open.
    expect(container.querySelector(".cursor-blink")).toBeInTheDocument();
  });

  it("renders a web source chip with an external link and the live-search badge", () => {
    renderBubble(
      <MessageBubble
        role="assistant"
        content="Answer"
        sources={[{ type: "web", title: "Gov portal", source_url: "https://e.gov.uz" }]}
      />
    );

    expect(screen.getByText("Manbalar:")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Gov portal" });
    expect(link).toHaveAttribute("href", "https://e.gov.uz");
    // "web" sources get the live-search badge; scenario/kb sources do not.
    expect(screen.getByText("jonli qidiruv")).toBeInTheDocument();
  });

  it("calls onFeedback with (messageId, 'up', '') when the thumbs-up is clicked", () => {
    const onFeedback = vi.fn();
    renderBubble(
      <MessageBubble role="assistant" content="Answer" messageId={42} onFeedback={onFeedback} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Foydali" }));

    expect(onFeedback).toHaveBeenCalledWith(42, "up", "");
  });
});
