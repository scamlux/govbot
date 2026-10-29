import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { refresh, me } = vi.hoisted(() => ({ refresh: vi.fn(), me: vi.fn() }));

vi.mock("../api/client", () => ({
  tokenStore: { getAccess: () => null, set: vi.fn(), clear: vi.fn() },
  refreshAccessToken: refresh,
}));
vi.mock("../api/endpoints", () => ({
  authApi: { me, logout: vi.fn(() => Promise.resolve()), login: vi.fn(), register: vi.fn(), updateMe: vi.fn() },
}));

import { AuthProvider, useAuth, SESSION_HINT_KEY } from "./AuthContext";

function Probe() {
  const { loading, user } = useAuth();
  return <p>{loading ? "loading" : user ? `user:${user.email}` : "guest"}</p>;
}

beforeEach(() => {
  localStorage.clear();
  refresh.mockReset();
  me.mockReset();
});

describe("AuthProvider bootstrap", () => {
  it("skips the silent refresh for visitors who never signed in", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
    expect(me).not.toHaveBeenCalled();
  });

  it("refreshes silently when the session hint exists", async () => {
    localStorage.setItem(SESSION_HINT_KEY, "1");
    refresh.mockResolvedValue("A");
    me.mockResolvedValue({ data: { email: "a@b.uz" } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("user:a@b.uz")).toBeInTheDocument());
    expect(refresh).toHaveBeenCalledWith({ silent: true });
  });

  it("drops the hint when the server rejects the refresh", async () => {
    localStorage.setItem(SESSION_HINT_KEY, "1");
    refresh.mockRejectedValue({ response: { status: 401 } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument());
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
  });
});
