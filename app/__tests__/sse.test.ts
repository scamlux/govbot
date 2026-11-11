import { createSseParser } from "../src/api/sse";

const frame = (event: string | null, payload: unknown) =>
  `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(payload)}\n\n`;

describe("createSseParser", () => {
  it("accumulates deltas and finishes with the authoritative done content", () => {
    const onDelta = jest.fn();
    const parser = createSseParser({ onDelta });
    parser.push(frame("meta", { user_message_id: 7, language: "ru" }));
    parser.push(frame(null, { delta: "Salom" }));
    parser.push(frame(null, { delta: ", dunyo" }));
    parser.push(frame("done", { assistant_message_id: 42, content: "Salom, dunyo!" }));

    const result = parser.end();
    expect(onDelta.mock.calls.map((c) => c[0])).toEqual(["Salom", ", dunyo"]);
    expect(result).toMatchObject({ assistantMessageId: 42, content: "Salom, dunyo!", language: "ru" });
  });

  it("reassembles frames split across arbitrary chunk boundaries", () => {
    const parser = createSseParser();
    const whole = frame(null, { delta: "abc" }) + frame("done", { assistant_message_id: 1, content: "abc" });
    for (const ch of whole) parser.push(ch);
    expect(parser.result.content).toBe("abc");
    expect(parser.result.assistantMessageId).toBe(1);
  });

  it("captures sources and the degraded status flag", () => {
    const onSources = jest.fn();
    const onStatus = jest.fn();
    const parser = createSseParser({ onSources, onStatus });
    const sources = [{ slug: "passport", title: "Passport", source_url: "https://my.gov.uz" }];
    parser.push(frame("sources", { sources }));
    parser.push(frame("status", { degraded: true, reason: "llm_unavailable" }));

    expect(parser.result.sources).toEqual(sources);
    expect(parser.result).toMatchObject({ degraded: true, degradedReason: "llm_unavailable" });
    expect(onSources).toHaveBeenCalledWith(sources);
    expect(onStatus).toHaveBeenCalledTimes(1);
  });

  it("ignores a non-degraded status and malformed frames without aborting", () => {
    const parser = createSseParser();
    parser.push(frame("status", { degraded: false }));
    parser.push("data: {not json}\n\n");
    parser.push(frame(null, { delta: "ok" }));
    expect(parser.result.degraded).toBe(false);
    expect(parser.result.content).toBe("ok");
  });

  it("handles CRLF framing and flushes an unterminated trailing frame on end()", () => {
    const parser = createSseParser();
    parser.push('data: {"delta":"a"}\r\n\r\n');
    parser.push('event: done\r\ndata: {"assistant_message_id":3,"content":"a"}');
    expect(parser.result.content).toBe("a");
    expect(parser.end().assistantMessageId).toBe(3);
  });

  it("routes error frames to onError", () => {
    const onError = jest.fn();
    const parser = createSseParser({ onError });
    parser.push(frame("error", { detail: "boom" }));
    expect(onError).toHaveBeenCalledWith({ detail: "boom" });
  });
});
