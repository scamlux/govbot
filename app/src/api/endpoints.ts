import type { Lang } from "../config";
import { http } from "./http";
import { tokenStore } from "./tokens";
import type {
  AppConfig,
  AuthResponse,
  BillingMe,
  Category,
  ConversationDetail,
  ConversationSummary,
  FeedbackRating,
  MessageFeedback,
  PaymentProvider,
  Plan,
  RelatedQuestion,
  ScenarioDetail,
  ScenarioFilters,
  ScenarioSummary,
  SendMessageResponse,
  User,
} from "./types";

export const authApi = {
  register: (input: {
    email: string;
    password: string;
    full_name?: string;
    preferred_language?: Lang;
  }) => http.post<AuthResponse>("/auth/register/", input, { anonymous: true }),
  login: (input: { email: string; password: string }) =>
    http.post<AuthResponse>("/auth/login/", input, { anonymous: true }),
  me: () => http.get<User>("/auth/me/"),
  updateMe: (patch: Partial<Pick<User, "full_name" | "preferred_language">>) =>
    http.patch<User>("/auth/me/", patch),
  /** Revokes the refresh token server-side. Always 205. */
  logout: async (): Promise<void> => {
    const refresh = await tokenStore.getRefresh();
    if (!refresh) return;
    await http.post<void>("/auth/logout/", { refresh }, { anonymous: true });
  },
  deleteAccount: (password: string) => http.post<void>("/auth/me/delete/", { password }),
  exportData: () => http.get<Record<string, unknown>>("/auth/me/export/"),
};

export const configApi = {
  get: () => http.get<AppConfig>("/config/", undefined, { anonymous: true }),
};

export const scenariosApi = {
  categories: (lang: Lang) =>
    http.get<Category[]>("/scenarios/categories/", { lang }, { anonymous: true }),
  list: (lang: Lang, { category, search, audience }: ScenarioFilters = {}) =>
    http.get<ScenarioSummary[]>("/scenarios/", { lang, category, search, audience }, { anonymous: true }),
  detail: (slug: string, lang: Lang) =>
    http.get<ScenarioDetail>(`/scenarios/${slug}/`, { lang }, { anonymous: true }),
};

export const chatApi = {
  conversations: () => http.get<ConversationSummary[]>("/conversations/"),
  createConversation: (language: Lang) =>
    http.post<ConversationSummary>("/conversations/", { language }),
  conversation: (id: number) => http.get<ConversationDetail>(`/conversations/${id}/`),
  deleteConversation: (id: number) => http.delete<void>(`/conversations/${id}/`),
  sendMessage: (id: number, content: string, language: Lang, plain = false) =>
    http.post<SendMessageResponse>(`/conversations/${id}/messages/`, { content, language, plain }),
  feedback: (messageId: number, rating: FeedbackRating, reason?: string) =>
    http.post<MessageFeedback>(`/messages/${messageId}/feedback/`, { rating, reason }),
  /** Up to 3 catalog questions related to a message (chips after a reply). */
  related: async (message: string, lang: Lang, exclude?: string): Promise<RelatedQuestion[]> => {
    const data = await http.get<{ related_questions?: RelatedQuestion[] }>("/chat/related/", {
      message,
      lang,
      exclude,
    });
    return data.related_questions ?? [];
  },
};

export const billingApi = {
  plans: (lang: Lang) =>
    http.get<{ plans: Plan[] }>("/billing/plans/", { lang }, { anonymous: true }),
  me: (lang?: Lang) => http.get<BillingMe>("/billing/me/", { lang }),
  checkout: (input: { plan: string; provider: PaymentProvider; lang?: Lang }) =>
    http.post<{ url?: string; checkout_url?: string }>("/billing/checkout/", input),
};
