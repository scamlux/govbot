import api, { API_BASE_URL, tokenStore } from "./client";

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
};

// ---- Chat ----
export const chatApi = {
  conversations: () => api.get("/conversations/"),
  createConversation: (language) => api.post("/conversations/", { language }),
  conversation: (id) => api.get(`/conversations/${id}/`),
  deleteConversation: (id) => api.delete(`/conversations/${id}/`),
  sendMessage: (id, content, language) =>
    api.post(`/conversations/${id}/messages/`, { content, language }),
};

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
  { onDelta, onMeta } = {}
) {
  const resp = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages/stream/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenStore.getAccess()}`,
      },
      body: JSON.stringify({ content, language }),
    }
  );

  if (!resp.ok || !resp.body) {
    throw new Error(`Stream failed with status ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = { assistantMessageId: null, content: "" };

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
      } else if (event === "done") {
        result = {
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
