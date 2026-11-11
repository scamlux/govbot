import { API_BASE, DEFAULT_LANG } from "../config";
import { ApiError, parseErrorResponse } from "./errors";
import { refreshAccessToken } from "./refresh";
import { tokenStore } from "./tokens";

let currentLang: string = DEFAULT_LANG;

/** Set by the i18n layer so every request carries `Accept-Language`. */
export function setApiLanguage(lang: string): void {
  currentLang = lang;
}
export const getApiLanguage = (): string => currentLang;

export type Params = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  params?: Params;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the Authorization header and the refresh-on-401 retry (login, register, public reads). */
  anonymous?: boolean;
}

export function buildUrl(path: string, params?: Params): string {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${url}?${query}` : url;
}

export function buildHeaders(access: string | null, hasBody: boolean): Record<string, string> {
  return {
    Accept: "application/json",
    "Accept-Language": currentLang,
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

async function send(path: string, options: RequestOptions, access: string | null): Promise<Response> {
  try {
    return await fetch(buildUrl(path, options.params), {
      method: options.method ?? "GET",
      headers: buildHeaders(access, options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", "Network request failed");
  }
}

/** Typed JSON request. On 401 with a token: refresh once (single-flight), then retry once. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const access = options.anonymous ? null : tokenStore.getAccess();
  let response = await send(path, options, access);

  if (response.status === 401 && !options.anonymous && access) {
    const fresh = await refreshAccessToken();
    response = await send(path, options, fresh);
  }

  if (!response.ok) throw await parseErrorResponse(response);
  if (response.status === 204 || response.status === 205) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, params?: Params, extra: Partial<RequestOptions> = {}) =>
    request<T>(path, { ...extra, method: "GET", params }),
  post: <T>(path: string, body?: unknown, extra: Partial<RequestOptions> = {}) =>
    request<T>(path, { ...extra, method: "POST", body: body ?? {} }),
  patch: <T>(path: string, body: unknown, extra: Partial<RequestOptions> = {}) =>
    request<T>(path, { ...extra, method: "PATCH", body }),
  delete: <T>(path: string, extra: Partial<RequestOptions> = {}) =>
    request<T>(path, { ...extra, method: "DELETE" }),
};
