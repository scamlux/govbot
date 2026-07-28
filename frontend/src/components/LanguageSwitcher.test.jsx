import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import i18n from "../i18n";

// The switcher only needs auth to persist a logged-in user's preference; with a
// null user it stays purely client-side, so stub the context away from network.
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: null, updatePreferredLanguage: vi.fn() }),
}));

import LanguageSwitcher from "./LanguageSwitcher";

beforeEach(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  cleanup();
});

describe("LanguageSwitcher", () => {
  it("renders one button per supported language with the default (UZ) pressed", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("button", { name: "UZ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "RU" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "false");
  });

  it("moves the active state to the locale that is clicked", async () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "RU" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "RU" })).toHaveAttribute("aria-pressed", "true")
    );
    expect(i18n.language).toBe("ru");
    expect(screen.getByRole("button", { name: "UZ" })).toHaveAttribute("aria-pressed", "false");
  });
});
