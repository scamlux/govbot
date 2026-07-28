import { afterEach, describe, expect, it, vi } from "vitest";

const { getRefresh, refreshAccessToken } = vi.hoisted(() => ({
  getRefresh: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("./client", () => ({
  default: {},
  API_BASE_URL: "http://t/api",
  tokenStore: { getAccess: () => "tok", getRefresh },
  refreshAccessToken,
}));

import { streamMessage } from "./endpoints";

/** Build a Response-like object whose body streams the given strings as separate reads. */
function sseResponse(chunks) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("streamMessage", () => {
  it("parses SSE frames split across reads and assembles the result", async () => {
    // The frame separator "\n\n" of the first delta arrives in the NEXT read —
    // exercises the internal buffer, not just whole-frame parsing.
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'event: meta\ndata: {"user_message_id": 7}\n\n',
        'data: {"delta": "Hel',
        'lo"}\n\ndata: {"delta": ", world"}\n\n',
        'event: sources\ndata: {"sources": [{"type": "kb", "title": "Doc"}]}\n\n',
        'event: done\ndata: {"assistant_message_id": 42, "content": "Hello, world"}\n\n',
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const onDelta = vi.fn();
    const onMeta = vi.fn();
    const onSources = vi.fn();
    const result = await streamMessage(3, "hi", "en", { onDelta, onMeta, onSources });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://t/api/conversations/3/messages/stream/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
    expect(onMeta).toHaveBeenCalledWith({ user_message_id: 7 });
    expect(onDelta.mock.calls.map(([d]) => d)).toEqual(["Hello", ", world"]);
    expect(onSources).toHaveBeenCalledWith([{ type: "kb", title: "Doc" }]);
    expect(result).toEqual({
      assistantMessageId: 42,
      content: "Hello, world",
      sources: [{ type: "kb", title: "Doc" }],
    });
  });

  it("refreshes the access token on 401 and retries once", async () => {
    getRefresh.mockReturnValue("r");
    refreshAccessToken.mockResolvedValue("fresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, body: null })
      .mockResolvedValueOnce(
        sseResponse(['event: done\ndata: {"assistant_message_id": 1, "content": "ok"}\n\n'])
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamMessage(3, "hi", "en");

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh");
    expect(result).toEqual({ assistantMessageId: 1, content: "ok", sources: [] });
  });
});
