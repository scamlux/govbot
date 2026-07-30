import api, { API_BASE_URL, tokenStore, refreshAccessToken } from "./client";

// ---- Auth ----
export const authApi = {
  register: ({ email, password, full_name, preferred_language }) =>
    api.post("/auth/register/", { email, password, full_name, preferred_language }),
  login: ({ email, password }) => api.post("/auth/login/", { email, password }),
  me: () => api.get("/auth/me/"),
  updateMe: (patch) => api.patch("/auth/me/", patch),
};

// ---- Scenarios (public) ----
export const scenariosApi = {
  categories: (lang) => api.get("/scenarios/categories/", { params: { lang } }),
  list: (lang, { category, search } = {}) =>
    api.get("/scenarios/", { params: { lang, category, search } }),
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
  // Analytics + feedback (A3 / C1 / C2)
  feedback: (rating) => api.get("/admin/feedback/", { params: { rating } }),
  analyticsQuestions: (days) =>
    api.get("/admin/analytics/questions/", { params: { days } }),
  analyticsGaps: (days) => api.get("/admin/analytics/gaps/", { params: { days } }),
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
 * Stream an assistant reply via Server-Sent Events using fetch (axios can't stream
 * bodies in the browser). Calls callbacks as events arrive.
 *
 * @returns {Promise<{assistantMessageId:number, content:string}>}
 */
export async function streamMessage(
  conversationId,
  content,
  language,
  { onDelta, onMeta, onSources } = {}
) {
  const doFetch = (token) =>
    fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages/stream/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, language }),
      }
    );

  let resp = await doFetch(tokenStore.getAccess());

  // The stream bypasses the axios interceptor, so handle an expired access token
  // here: refresh once and retry (mirrors client.js). A failed refresh throws and
  // dispatches `govbot:logout`, forcing re-login instead of a silent dead chat.
  if (resp.status === 401 && tokenStore.getRefresh()) {
    const access = await refreshAccessToken();
    resp = await doFetch(access);
  }

  if (!resp.ok || !resp.body) {
    throw new Error(`Stream failed with status ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = { assistantMessageId: null, content: "", sources: [] };

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
        onMeta?.(payload);
      } else if (event === "sources") {
        // B1 — grounding citations arrive just before `done`.
        result.sources = payload.sources || [];
        onSources?.(result.sources);
      } else if (event === "done") {
        result = {
          assistantMessageId: payload.assistant_message_id,
          content: payload.content,
          sources: result.sources,
        };
      } else if (payload.delta !== undefined) {
        result.content += payload.delta;
        onDelta?.(payload.delta);
      }
    }
  }
  return result;
}
