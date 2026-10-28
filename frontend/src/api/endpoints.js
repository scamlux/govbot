import api, { API_BASE_URL, tokenStore, refreshAccessToken } from "./client";

// ---- Auth ----
export const authApi = {
  register: ({ email, password, full_name, preferred_language }) =>
    api.post("/auth/register/", { email, password, full_name, preferred_language }),
  login: ({ email, password }) => api.post("/auth/login/", { email, password }),
  me: () => api.get("/auth/me/"),
  updateMe: (patch) => api.patch("/auth/me/", patch),
  // F2 — revoke the refresh token server-side.
  // The refresh token rides in the httpOnly cookie; `refresh` is only for a legacy token.
  logout: (refresh) => api.post("/auth/logout/", refresh ? { refresh } : {}),
  // F3 — self-service privacy.
  deleteAccount: (password) => api.post("/auth/me/delete/", { password }),
  exportData: () => api.get("/auth/me/export/"),
};

// ---- Public feature flags ----
export const configApi = {
  get: () => api.get("/config/"),
};

// ---- Scenarios (public) ----
export const scenariosApi = {
  categories: (lang) => api.get("/scenarios/categories/", { params: { lang } }),
  list: (lang, { category, search, audience } = {}) =>
    api.get("/scenarios/", { params: { lang, category, search, audience } }),
  detail: (slug, lang) => api.get(`/scenarios/${slug}/`, { params: { lang } }),
};

// ---- Admin (staff only) ----
export const adminApi = {
  users: () => api.get("/admin/users/"),
  // Categories
  categories: () => api.get("/admin/categories/"),
  createCategory: (payload) => api.post("/admin/categories/", payload),
  updateCategory: (id, payload) => api.patch(`/admin/categories/${id}/`, payload),
  deleteCategory: (id) => api.delete(`/admin/categories/${id}/`),
  // Scenarios
  scenarios: () => api.get("/admin/scenarios/"),
  createScenario: (payload) => api.post("/admin/scenarios/", payload),
  updateScenario: (id, payload) => api.patch(`/admin/scenarios/${id}/`, payload),
  deleteScenario: (id) => api.delete(`/admin/scenarios/${id}/`),
  // E2 — revision history + rollback
  scenarioRevisions: (id) => api.get(`/admin/scenarios/${id}/revisions/`),
  restoreScenarioRevision: (id, revisionId) =>
    api.post(`/admin/scenarios/${id}/revisions/${revisionId}/restore/`),
  // E4 — stale scenarios
  staleScenarios: () => api.get("/admin/scenarios/stale/"),
  // Analytics + feedback (A3 / C1 / C2)
  feedback: (rating) => api.get("/admin/feedback/", { params: { rating } }),
  analyticsQuestions: (days) =>
    api.get("/admin/analytics/questions/", { params: { days } }),
  analyticsGaps: (days) => api.get("/admin/analytics/gaps/", { params: { days } }),
  // C3 monitoring — conversations viewer, usage stats, system health
  updateUser: (id, patch) => api.patch(`/admin/users/${id}/`, patch),
  deleteUser: (id) => api.delete(`/admin/users/${id}/`),
  conversations: (page) => api.get("/admin/conversations/", { params: { page } }),
  conversation: (id) => api.get(`/admin/conversations/${id}/`),
  deleteConversation: (id) => api.delete(`/admin/conversations/${id}/`),
  analyticsUsage: (days) => api.get("/admin/analytics/usage/", { params: { days } }),
  health: () => api.get("/admin/health/"),
  // E3 — knowledge base sources
  kbSources: () => api.get("/admin/kb/sources/"),
  createKbSource: (payload) => api.post("/admin/kb/sources/", payload),
  uploadKbFile: (formData) =>
    api.post("/admin/kb/sources/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  reindexKbSource: (id) => api.post(`/admin/kb/sources/${id}/reindex/`),
  deleteKbSource: (id) => api.delete(`/admin/kb/sources/${id}/`),
};

// ---- Chat ----
export const chatApi = {
  conversations: () => api.get("/conversations/"),
  createConversation: (language) => api.post("/conversations/", { language }),
  conversation: (id) => api.get(`/conversations/${id}/`),
  deleteConversation: (id) => api.delete(`/conversations/${id}/`),
  sendMessage: (id, content, language) =>
    api.post(`/conversations/${id}/messages/`, { content, language }),
  // A2 — rate an assistant reply (idempotent upsert).
  feedback: (messageId, rating, reason) =>
    api.post(`/messages/${messageId}/feedback/`, { rating, reason }),
};

/**
 * R4/R5 — up to 3 catalog questions related to the user's message, shown as
 * chips after an assistant reply. Goes through the shared axios instance, so it
 * inherits the same auth pattern as every other call (JWT via the request
 * interceptor + single-flight 401-refresh + replay via the response interceptor).
 *
 * @returns {Promise<Array<{slug:string, title:string}>>} empty array when nothing related.
 */
export async function fetchRelated(message, lang) {
  const res = await api.get("/chat/related/", { params: { message, lang } });
  return res.data?.related_questions ?? [];
}

/**
 * Parse a Server-Sent Events body produced by the chat stream endpoints, invoking
 * callbacks as frames arrive. Shared by the signed-in and guest streams.
 */
async function readSseStream(resp, { onDelta, onMeta, onSources }) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = { assistantMessageId: null, content: "", sources: [], language: null };

  // Parse the SSE stream frame by frame (frames separated by a blank line).
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "message";
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine);
      if (event === "meta") {
        if (payload.language) result.language = payload.language;
        onMeta?.(payload);
      } else if (event === "sources") {
        // B1 — grounding citations arrive just before `done`.
        result.sources = payload.sources || [];
        onSources?.(result.sources);
      } else if (event === "done") {
        result = {
          ...result,
          assistantMessageId: payload.assistant_message_id,
          content: payload.content,
        };
      } else if (payload.delta !== undefined) {
        result.content += payload.delta;
        onDelta?.(payload.delta);
      }
    }
  }
  return result;
}

/**
 * Stream an assistant reply via Server-Sent Events using fetch (axios can't stream
 * bodies in the browser). Calls callbacks as events arrive.
 *
 * `signal` (AbortSignal) lets the UI stop a reply mid-stream (R5); `plain` asks for
 * the simple-language style.
 *
 * @returns {Promise<{assistantMessageId:number, content:string, sources:Array, language:string}>}
 */
export async function streamMessage(
  conversationId,
  content,
  language,
  { onDelta, onMeta, onSources, signal, plain = false } = {}
) {
  const doFetch = (token) =>
    fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/stream/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Cookie": "1",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, language, plain }),
        signal,
      }
    );

  let resp = await doFetch(tokenStore.getAccess());

  // The stream bypasses the axios interceptor, so handle an expired access token
  // here: refresh once and retry (mirrors client.js). A failed refresh throws and
  // dispatches `govbot:logout`, forcing re-login instead of a silent dead chat.
  if (resp.status === 401) {
    const access = await refreshAccessToken();
    resp = await doFetch(access);
  }

  if (!resp.ok || !resp.body) {
    const error = new Error(`Stream failed with status ${resp.status}`);
    error.status = resp.status;
    throw error;
  }
  return readSseStream(resp, { onDelta, onMeta, onSources });
}

/**
 * B1 — stateless guest turn. The caller keeps the thread and sends the recent
 * history with each question; nothing is stored server-side.
 */
export async function streamGuestMessage(
  content,
  language,
  { history = [], onDelta, onMeta, onSources, signal, plain = false } = {}
) {
  const resp = await fetch(`${API_BASE_URL}/chat/guest/stream/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Cookie": "1" },
    body: JSON.stringify({ content, language, plain, history }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const error = new Error(`Guest stream failed with status ${resp.status}`);
    error.status = resp.status;
    throw error;
  }
  return readSseStream(resp, { onDelta, onMeta, onSources });
}
