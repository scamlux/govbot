import { answeredInNote, chatReducer, initialChatState, splitBlocks, type ChatState } from "../src/domain/chatReducer";
import type { ChatMessage } from "../src/api/types";
import { emptyStreamResult } from "../src/api/sse";

const server = (id: number, role: "user" | "assistant", content: string): ChatMessage => ({
  id,
  role,
  content,
  model: null,
  tokens: null,
  sources: null,
  feedback: null,
  created_at: "2026-11-01T00:00:00Z",
});

const sent = (): ChatState => chatReducer(initialChatState, { type: "send", content: "Passport?", seq: 1 });

describe("chat reducer", () => {
  it("send appends a user bubble and a streaming assistant placeholder", () => {
    const state = sent();
    expect(state.streaming).toBe(true);
    expect(state.bubbles.map((b) => [b.role, b.content, b.streaming])).toEqual([
      ["user", "Passport?", false],
      ["assistant", "", true],
    ]);
    expect(state.lastQuestion).toBe("Passport?");
  });

  it("accumulates deltas immutably on the trailing assistant bubble", () => {
    const a = sent();
    const b = chatReducer(a, { type: "delta", text: "Step " });
    const c = chatReducer(b, { type: "delta", text: "one" });
    expect(c.bubbles[1].content).toBe("Step one");
    expect(a.bubbles[1].content).toBe("");
    expect(b.bubbles[1].content).toBe("Step ");
  });

  it("done is authoritative: replaces content, adopts id/sources/language and stops streaming", () => {
    let state = chatReducer(sent(), { type: "delta", text: "partial" });
    state = chatReducer(state, {
      type: "done",
      result: { ...emptyStreamResult(), assistantMessageId: 42, content: "Final answer", sources: [{ slug: "passport", title: "Passport", source_url: "https://my.gov.uz" }], language: "ru", degraded: false },
    });
    const last = state.bubbles[1];
    expect(last).toMatchObject({ id: 42, key: "m42", content: "Final answer", language: "ru", streaming: false });
    expect(last.sources).toHaveLength(1);
    expect(state.streaming).toBe(false);
  });

  it("flags degraded mode from status frames and from the final result", () => {
    expect(chatReducer(sent(), { type: "degraded" }).degraded).toBe(true);
    const done = chatReducer(sent(), { type: "done", result: { ...emptyStreamResult(), content: "x", degraded: true } });
    expect(done.degraded).toBe(true);
  });

  it("stop keeps the partial reply but ends streaming", () => {
    const state = chatReducer(chatReducer(sent(), { type: "delta", text: "half" }), { type: "stop" });
    expect(state.streaming).toBe(false);
    expect(state.bubbles[1]).toMatchObject({ content: "half", streaming: false });
  });

  it("fail drops an empty placeholder but keeps partial text, and records the error", () => {
    const empty = chatReducer(sent(), { type: "fail", message: "boom" });
    expect(empty.bubbles).toHaveLength(1);
    expect(empty.error).toBe("boom");
    const partial = chatReducer(chatReducer(sent(), { type: "delta", text: "some" }), { type: "fail", message: "boom" });
    expect(partial.bubbles).toHaveLength(2);
    expect(partial.bubbles[1].streaming).toBe(false);
  });

  it("load ignores a stale server snapshot during streaming or when shorter than local state", () => {
    const streaming = chatReducer(initialChatState, { type: "load", messages: [server(1, "user", "hi")] });
    expect(streaming.bubbles).toHaveLength(1);
    const mid = sent();
    expect(chatReducer(mid, { type: "load", messages: [] })).toBe(mid);
    const done = chatReducer(mid, { type: "done", result: { ...emptyStreamResult(), content: "ok" } });
    expect(chatReducer(done, { type: "load", messages: [] })).toBe(done);
  });

  it("feedback updates the matching message only", () => {
    let state = chatReducer(initialChatState, { type: "load", messages: [server(1, "user", "q"), server(2, "assistant", "a")] });
    state = chatReducer(state, { type: "feedback", id: 2, feedback: { rating: "down", reason: "wrong" } });
    expect(state.bubbles[1].feedback?.rating).toBe("down");
    expect(state.bubbles[0].feedback).toBeNull();
  });

  it("answeredInNote only reports a language that differs from the UI language", () => {
    expect(answeredInNote("ru", "uz")).toBe("ru");
    expect(answeredInNote("uz", "uz")).toBeNull();
    expect(answeredInNote(null, "uz")).toBeNull();
  });

  it("splitBlocks separates blank-line delimited blocks", () => {
    expect(splitBlocks("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
    expect(splitBlocks("")).toEqual([]);
  });
});
