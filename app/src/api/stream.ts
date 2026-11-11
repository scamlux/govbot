import { fetch as streamingFetch } from "expo/fetch";

import type { Lang } from "../config";
import { ApiError, parseErrorResponse } from "./errors";
import { buildHeaders, buildUrl } from "./http";
import { refreshAccessToken } from "./refresh";
import { createSseParser, type StreamHandlers, type StreamResult } from "./sse";
import { tokenStore } from "./tokens";

export interface StreamOptions extends StreamHandlers {
  plain?: boolean;
  /** Abort to implement the "stop" button. */
  signal?: AbortSignal;
}

export interface GuestTurn {
  role: "user" | "assistant";
  content: string;
}

type StreamResponse = Awaited<ReturnType<typeof streamingFetch>>;

async function post(
  path: string,
  body: unknown,
  access: string | null,
  signal?: AbortSignal,
): Promise<StreamResponse> {
  try {
    return await streamingFetch(buildUrl(path), {
      method: "POST",
      headers: { ...buildHeaders(access, true), Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiError(0, "network", "Network request failed");
  }
}

async function consume(response: StreamResponse, handlers: StreamHandlers): Promise<StreamResult> {
  if (!response.ok) throw await parseErrorResponse(response);
  if (!response.body) throw new ApiError(response.status, "no_stream", "Response has no body");

  const parser = createSseParser(handlers);
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }
  return parser.end();
}

/** Signed-in streamed turn. Refreshes the access token once on 401, like the REST client. */
export async function streamMessage(
  conversationId: number,
  content: string,
  language: Lang,
  { plain = false, signal, ...handlers }: StreamOptions = {},
): Promise<StreamResult> {
  const path = `/conversations/${conversationId}/messages/stream/`;
  const body = { content, language, plain };

  let response = await post(path, body, tokenStore.getAccess(), signal);
  if (response.status === 401) {
    const fresh = await refreshAccessToken();
    response = await post(path, body, fresh, signal);
  }
  return consume(response, handlers);
}

/** Stateless guest turn (only when `/config/` reports `guest_chat`); history is client-held. */
export async function streamGuestMessage(
  content: string,
  language: Lang,
  { plain = false, signal, history = [], ...handlers }: StreamOptions & { history?: GuestTurn[] } = {},
): Promise<StreamResult> {
  const response = await post("/chat/guest/stream/", { content, language, plain, history }, null, signal);
  return consume(response, handlers);
}
