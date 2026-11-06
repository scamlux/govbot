import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import i18n from "../i18n";
import MessageBubble from "../components/MessageBubble";

const updateProfile = vi.fn().mockResolvedValue({});
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "a@b.c", full_name: "Old", preferred_language: "uz" },
    updateProfile,
    logout: vi.fn(),
  }),
}));

import { ThemeProvider } from "../theme/ThemeContext";
import Profile from "./Profile";

beforeEach(async () => {
  await i18n.changeLanguage("uz");
  updateProfile.mockClear();
});
afterEach(cleanup);

describe("error / degraded replies (#1)", () => {
  it("renders an error as a notice with a retry button and no rating", () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <MessageBubble role="assistant" kind="error" content="x" messageId={5} onFeedback={() => {}} onRetry={onRetry} />
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText(/👍|yoqdi|foydali/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("treats model=fallback as a degraded notice without sources chips or feedback", () => {
    render(
      <MemoryRouter>
        <MessageBubble role="assistant" model="fallback" content="Katalog javobi" messageId={7} onFeedback={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Katalog javobi");
    expect(screen.queryByRole("button", { name: /Qayta urinish/ })).toBeNull();
    expect(document.querySelector(".msg-feedback")).toBeNull();
  });
});

describe("Profile save (#12)", () => {
  it("sends one PATCH with the changed name and language", async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Profile />
        </ThemeProvider>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByDisplayValue("Old"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "RU" }));
    expect(updateProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Saqlash|Сохранить|Save/ }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith({ full_name: "New Name", preferred_language: "ru" });
  });
});
