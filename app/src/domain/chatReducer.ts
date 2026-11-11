import type { ChatMessage, MessageFeedback, Source } from "../api/types";
import type { StreamResult } from "../api/sse";

export interface Bubble {
  /** Stable React key: server id once known, else a local key. */
  key: string;
  /** Server message id, null while only local. */
  id: number | null;
  role: "user" | "assistant";
  content: string;
  sources: readonly Source[];
  feedback: MessageFeedback | null;
  /** Reply language reported by the server (for the "answered in" note). */
  language: string | null;
  /** True while the assistant bubble is still receiving tokens. */
  streaming: boolean;
}

export interface ChatState {
  bubbles: readonly Bubble[];
  streaming: boolean;
  error: string | null;
  degraded: boolean;
  /** Question that produced the last (possibly failed) turn, for "retry". */
  lastQuestion: string | null;
}

export const initialChatState: ChatState = { bubbles: [], streaming: false, error: null, degraded: false, lastQuestion: null };

export type ChatAction =
  | { type: "load"; messages: readonly ChatMessage[] }
  | { type: "send"; content: string; seq: number }
  | { type: "delta"; text: string }
  | { type: "sources"; sources: readonly Source[] }
  | { type: "meta"; language: string | null }
  | { type: "degraded" }
  | { type: "done"; result: StreamResult }
  | { type: "stop" }
  | { type: "fail"; message: string }
  | { type: "feedback"; id: number; feedback: MessageFeedback | null };

const fromServer = (m: ChatMessage): Bubble => ({
  key: `m${m.id}`,
  id: m.id,
  role: m.role,
  content: m.content,
  sources: m.sources ?? [],
  feedback: m.feedback,
  language: null,
  streaming: false,
});

/** Apply `change` to the trailing assistant bubble only (immutably). */
function patchLast(state: ChatState, change: (b: Bubble) => Bubble): ChatState {
  const last = state.bubbles[state.bubbles.length - 1];
  if (!last || last.role !== "assistant") return state;
  return { ...state, bubbles: [...state.bubbles.slice(0, -1), change(last)] };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "load":
      // Never clobber an in-flight turn, or a longer local transcript, with a stale server snapshot.
      return state.streaming || state.bubbles.length > action.messages.length ? state : { ...state, bubbles: action.messages.map(fromServer) };
    case "send": {
      const user: Bubble = { key: `u${action.seq}`, id: null, role: "user", content: action.content, sources: [], feedback: null, language: null, streaming: false };
      const assistant: Bubble = { key: `a${action.seq}`, id: null, role: "assistant", content: "", sources: [], feedback: null, language: null, streaming: true };
      return { ...state, bubbles: [...state.bubbles, user, assistant], streaming: true, error: null, degraded: false, lastQuestion: action.content };
    }
    case "delta":
      return patchLast(state, (b) => ({ ...b, content: b.content + action.text }));
    case "sources":
      return patchLast(state, (b) => ({ ...b, sources: action.sources }));
    case "meta":
      return patchLast(state, (b) => ({ ...b, language: action.language }));
    case "degraded":
      return { ...state, degraded: true };
    case "done":
      return {
        ...patchLast(state, (b) => ({
          ...b,
          id: action.result.assistantMessageId ?? b.id,
          key: action.result.assistantMessageId ? `m${action.result.assistantMessageId}` : b.key,
          // `content` in the done frame is authoritative (backend may post-process).
          content: action.result.content || b.content,
          sources: action.result.sources.length ? action.result.sources : b.sources,
          language: action.result.language ?? b.language,
          streaming: false,
        })),
        streaming: false,
        degraded: state.degraded || action.result.degraded,
      };
    case "stop":
      return {
        ...patchLast(state, (b) => ({ ...b, streaming: false })),
        streaming: false,
      };
    case "fail": {
      // Drop an empty assistant placeholder; keep partial text if some arrived.
      const last = state.bubbles[state.bubbles.length - 1];
      const dropLast = last?.role === "assistant" && !last.content;
      return {
        ...state,
        bubbles: dropLast ? state.bubbles.slice(0, -1) : state.bubbles.map((b) => (b.streaming ? { ...b, streaming: false } : b)),
        streaming: false,
        error: action.message,
      };
    }
    case "feedback":
      return { ...state, bubbles: state.bubbles.map((b) => (b.id === action.id ? { ...b, feedback: action.feedback } : b)) };
  }
}

/** Language label for the "answered in ..." note, or null when it matches the UI language. */
export function answeredInNote(replyLanguage: string | null, uiLanguage: string): string | null {
  if (!replyLanguage || replyLanguage === uiLanguage) return null;
  return replyLanguage;
}

/** Split streaming markdown into blocks so each new block can animate in (rise 120ms). */
export function splitBlocks(content: string): string[] {
  return content.split(/\n{2,}/).filter((part) => part.length > 0);
}
