import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import i18n from "../i18n";

const mockConfig = { guest_chat: false, loaded: true };
const mockAuth = { user: null };
vi.mock("../config/ConfigContext", () => ({ useConfig: () => mockConfig }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => mockAuth }));
vi.mock("../api/endpoints", () => ({
  scenariosApi: { categories: () => Promise.resolve({ data: [{ slug: "a", scenario_count: 3 }] }) },
}));

import Landing from "./Landing";
import About from "./About";
import Guide from "./Guide";
import InstallCard from "../components/InstallCard";

const FREE = /3 ta savol — ro'yxatdan o'tmasdan, bepul/;
const FREE_CLOSING = /Birinchi uch savol — bepul va ro'yxatsiz/;
const FREE_GUIDE = /Birinchi uch savol — ro'yxatsiz/;

function renderAt(node) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

beforeEach(async () => {
  await act(() => i18n.changeLanguage("uz"));
  mockConfig.guest_chat = false;
  mockAuth.user = null;
});
afterEach(cleanup);

describe("Landing (direction D)", () => {
  it("hides the free-questions line everywhere when guest chat is off", () => {
    renderAt(<Landing />);
    expect(screen.queryByText(FREE)).toBeNull();
    expect(screen.queryByText(FREE_CLOSING)).toBeNull();
  });

  it("shows the free-questions line (hero and closing) when guest chat is on", () => {
    mockConfig.guest_chat = true;
    renderAt(<Landing />);
    expect(screen.getByText(FREE)).toBeInTheDocument();
    expect(screen.getByText(FREE_CLOSING)).toBeInTheDocument();
  });

  it("does not advertise free questions to a signed-in user even with guest chat on", () => {
    mockConfig.guest_chat = true;
    mockAuth.user = { email: "a@b.c" };
    renderAt(<Landing />);
    expect(screen.queryByText(FREE)).toBeNull();
  });

  it("renders the H1, six audience cards and all fourteen regions, with no pricing", () => {
    renderAt(<Landing />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Har bir savolga — aniq yo'l.");
    const everyone = screen.getByRole("heading", { name: /Hamma uchun/ }).closest("section");
    expect(everyone.querySelectorAll("a.lp-card")).toHaveLength(6);
    const regions = screen.getByRole("heading", { name: /Qoraqalpog'istondan/ }).closest("section");
    expect(regions.querySelectorAll("li")).toHaveLength(14);
    expect(screen.queryByText(/Bepul boshlang|so'm/)).toBeNull();
  });

  it("sends a guest's typed question to login with the question preserved", () => {
    let location;
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={<Probe onState={(s) => (location = s)} />}
          />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("Savolingiz"), { target: { value: "Pasport?" } });
    fireEvent.click(screen.getByRole("button", { name: /So'rash/ }));
    expect(location.prefill).toBe("Pasport?");
    expect(sessionStorage.getItem("govbot.pendingQuestion")).toBe("Pasport?");
  });
});

import { useLocation } from "react-router-dom";
function Probe({ onState }) {
  onState(useLocation().state);
  return null;
}

describe("About and Guide pages", () => {
  it("About renders its H1, the Hozir badge on Web and a CTA to /guide", () => {
    renderAt(<About />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Davlat bilan muloqot");
    expect(screen.getByText("Hozir")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yo'riqnomani ochish" })).toHaveAttribute("href", "/guide");
  });

  it("Guide renders its H1 and six steps; the free-questions sentence needs guest chat", () => {
    renderAt(<Guide />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("olti qadamda");
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText(FREE_GUIDE)).toBeNull();
    cleanup();
    mockConfig.guest_chat = true;
    renderAt(<Guide />);
    expect(document.body.textContent).toMatch(FREE_GUIDE);
  });
});

describe("InstallCard", () => {
  const originalUa = navigator.userAgent;
  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", { value: originalUa, configurable: true });
  });

  it("shows the Share -> Add to Home Screen instruction on iOS", async () => {
    await act(() => i18n.changeLanguage("en"));
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });
    render(<InstallCard />);
    expect(screen.getByRole("heading", { name: "Install app" })).toBeInTheDocument();
    expect(screen.getByText(/Share.*Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("offers an Install button once beforeinstallprompt has been captured", async () => {
    await act(() => i18n.changeLanguage("en"));
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    render(<InstallCard />);
    await act(async () => {
      window.dispatchEvent(event);
    });
    fireEvent.click(screen.getByRole("button", { name: /Install$/ }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the app is already installed (standalone)", async () => {
    await act(() => i18n.changeLanguage("en"));
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { container } = render(<InstallCard />);
    expect(container).toBeEmptyDOMElement();
    delete window.matchMedia;
  });
});
