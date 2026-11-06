import { beforeEach, describe, expect, it } from "vitest";
import { askAiTarget, peekPendingQuestion, takePendingQuestion } from "./pendingQuestion";

beforeEach(() => sessionStorage.clear());

describe("askAiTarget (#10)", () => {
  it("goes straight to chat with the prefill when chat is available", () => {
    const target = askAiTarget({ canChat: true, question: "Viza kerakmi?" });
    expect(target).toEqual({ to: "/chat", state: { prefill: "Viza kerakmi?" } });
    expect(peekPendingQuestion()).toBe("");
  });

  it("sends logged-out visitors to /login and keeps the question", () => {
    const target = askAiTarget({ canChat: false, question: "Viza kerakmi?" });
    expect(target.to).toBe("/login");
    expect(target.state.prefill).toBe("Viza kerakmi?");
    expect(peekPendingQuestion()).toBe("Viza kerakmi?");
  });

  it("takePendingQuestion returns the saved question once", () => {
    askAiTarget({ canChat: false, question: "abc" });
    expect(takePendingQuestion()).toBe("abc");
    expect(takePendingQuestion()).toBe("");
  });
});
