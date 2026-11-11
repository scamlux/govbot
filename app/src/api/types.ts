import type { Lang } from "../config";

export interface User {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string | null;
  preferred_language: Lang;
  is_staff: boolean;
  created_at: string;
}

export interface AuthResponse {
  access: string;
  refresh?: string;
  user: User;
}

export type Audience = "citizen" | "resident" | "tourist";

export interface AppConfig {
  guest_chat: boolean;
  chat_mode: string;
  ai_mode: "live" | "mock" | "catalog_only" | "degraded";
  telegram_bot: boolean;
  billing_enabled: boolean;
}

export interface Category {
  slug: string;
  icon: string;
  name: string;
  description: string;
  order: number;
  scenario_count: number;
}

export interface ScenarioSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  order: number;
  updated_at: string;
  verified_at: string | null;
  source_url: string;
  audience: Audience[];
}

export interface ScenarioDetail {
  slug: string;
  title: string;
  /** Markdown. */
  body: string;
  source_url: string;
  category: Category;
  tags: string[];
  updated_at: string;
  verified_at: string | null;
  checklist: string[];
  audience: Audience[];
}

export interface ScenarioFilters {
  category?: string;
  search?: string;
  audience?: Audience;
}

export interface Source {
  slug: string;
  title: string;
  source_url: string;
  origin?: string;
}

export type FeedbackRating = "up" | "down";

export interface MessageFeedback {
  rating: FeedbackRating;
  reason: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  tokens: number | null;
  sources: Source[] | null;
  feedback: MessageFeedback | null;
  created_at: string;
}

export interface ConversationSummary {
  id: number;
  title: string;
  language: Lang;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail {
  id: number;
  title: string;
  language: Lang;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/** Non-streaming `POST /conversations/{id}/messages/` reply. */
export interface SendMessageResponse {
  user_message?: ChatMessage;
  assistant_message?: ChatMessage;
  sources?: Source[];
  [key: string]: unknown;
}

export interface RelatedQuestion {
  slug: string;
  title: string;
}

export interface Plan {
  code: "free" | "plus" | "business" | string;
  name: string;
  price_uzs: number | null;
  for_sale: boolean;
  period_days: number;
  daily_question_limit: number | null;
  features: string[];
}

export interface BillingMe {
  plan: Plan | null;
  used_today: number;
  limit: number | null;
  unlimited: boolean;
  subscription_end: string | null;
}

export type PaymentProvider = "payme" | "click";
