import type { Source } from "./types";

export interface StreamResult {
  assistantMessageId: number | null;
  content: string;
  sources: Source[];
  language: string | null;
  degraded: boolean;
  degradedReason: string | null;
}

export interface StreamHandlers {
  onDelta?: (delta: string) => void;
  onMeta?: (meta: Record<string, unknown>) => void;
  onSources?: (sources: Source[]) => void;
  onStatus?: (status: Record<string, unknown>) => void;
  /** Reserved: the backend does not emit `error` frames today. */
  onError?: (payload: Record<string, unknown>) => void;
}

export const emptyStreamResult = (): StreamResult => ({
  assistantMessageId: null,
  content: "",
  sources: [],
  language: null,
  degraded: false,
  degradedReason: null,
});

/**
 * Incremental parser for the chat SSE format; behaviour mirrors the web's `readSseStream`:
 *   `event: meta`    -> {user_message_id?, language?, guest?}
 *   `event: sources` -> {sources: [...]} (just before done)
 *   `event: status`  -> {degraded: true, reason}
 *   `event: done`    -> {assistant_message_id, content}  (content is authoritative)
 *   default frame    -> {delta: "..."}  (appended to content)
 * Frames are separated by a blank line; `data:` lines of one frame are concatenated.
 * Feed decoded text with `push`; read the running result via `result`.
 */
export function createSseParser(handlers: StreamHandlers = {}) {
  let buffer = "";
  let result = emptyStreamResult();

  function handleFrame(frame: string): void {
    let event = "message";
    let dataLine = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (!dataLine) return;

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(dataLine);
      if (!parsed || typeof parsed !== "object") return;
      payload = parsed as Record<string, unknown>;
    } catch {
      return; // one malformed frame must not kill the whole reply
    }

    if (event === "meta") {
      if (typeof payload.language === "string") result = { ...result, language: payload.language };
      handlers.onMeta?.(payload);
    } else if (event === "sources") {
      const sources = Array.isArray(payload.sources) ? (payload.sources as Source[]) : [];
      result = { ...result, sources };
      handlers.onSources?.(sources);
    } else if (event === "status") {
      if (payload.degraded) {
        result = {
          ...result,
          degraded: true,
          degradedReason: typeof payload.reason === "string" ? payload.reason : null,
        };
      }
      handlers.onStatus?.(payload);
    } else if (event === "done") {
      result = {
        ...result,
        assistantMessageId:
          typeof payload.assistant_message_id === "number" ? payload.assistant_message_id : null,
        content: typeof payload.content === "string" ? payload.content : result.content,
      };
    } else if (event === "error") {
      handlers.onError?.(payload);
    } else if (typeof payload.delta === "string") {
      result = { ...result, content: result.content + payload.delta };
      handlers.onDelta?.(payload.delta);
    }
  }

  return {
    push(text: string): void {
      buffer += text.replace(/\r\n/g, "\n");
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleFrame(frame);
        sep = buffer.indexOf("\n\n");
      }
    },
    /** Flush a trailing frame that was not blank-line terminated. */
    end(): StreamResult {
      if (buffer.trim()) handleFrame(buffer);
      buffer = "";
      return result;
    },
    get result(): StreamResult {
      return result;
    },
  };
}
