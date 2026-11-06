// #10 — a logged-out visitor's "Ask AI" question survives the trip through
// /login or /register (router state can be lost on re-render or a reload).
const KEY = "govbot.pendingQuestion";

export function savePendingQuestion(text) {
  const value = (text || "").trim();
  if (!value) return;
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    /* storage blocked — router state still carries the question */
  }
}

export function peekPendingQuestion() {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

/** Read and clear the saved question (consumed once by the chat input). */
export function takePendingQuestion() {
  const value = peekPendingQuestion();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return value;
}

/** Where to send a visitor who wants to ask `question`: chat, or login with a notice. */
export function askAiTarget({ canChat, question }) {
  if (canChat) return { to: "/chat", state: { prefill: question } };
  savePendingQuestion(question);
  return { to: "/login", state: { from: { pathname: "/chat" }, prefill: question } };
}
