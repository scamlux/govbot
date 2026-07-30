import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../i18n";
import RelatedQuestions from "./RelatedQuestions";

// Assertions target the app-default "uz" locale; pin the shared i18n singleton.
beforeEach(async () => {
  await i18n.changeLanguage("uz");
});
afterEach(() => {
  cleanup();
});

describe("RelatedQuestions", () => {
  const items = [
    { slug: "passport", title: "Pasportni yangilash?" },
    { slug: "biz", title: "Biznesni ro'yxatdan o'tkazish?" },
  ];

  it("renders the title label and a chip per item when the list is non-empty", () => {
    render(<RelatedQuestions items={items} onPick={() => {}} />);
    expect(screen.getByText("O'xshash savollar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasportni yangilash?" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Biznesni ro'yxatdan o'tkazish?" })
    ).toBeInTheDocument();
  });

  it("calls onPick with the chip's title when a chip is clicked", () => {
    const onPick = vi.fn();
    render(<RelatedQuestions items={items} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Pasportni yangilash?" }));
    expect(onPick).toHaveBeenCalledWith("Pasportni yangilash?");
  });

  it("renders nothing when the list is empty", () => {
    const { container } = render(<RelatedQuestions items={[]} onPick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("O'xshash savollar")).not.toBeInTheDocument();
  });

  it("caps the rendered chips at 3", () => {
    const many = [
      { slug: "a", title: "A?" },
      { slug: "b", title: "B?" },
      { slug: "c", title: "C?" },
      { slug: "d", title: "D?" },
    ];
    render(<RelatedQuestions items={many} onPick={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
