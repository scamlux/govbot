/** Error thrown for any non-2xx API response (and for transport failures with status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: string;
  readonly body: unknown;

  constructor(status: number, code: string | null, detail: string, body: unknown = null) {
    super(detail || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.body = body;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** 402 `{code: "plan_limit", detail, plan, limit}` - drives the future paywall. */
export class PlanLimitError extends ApiError {
  readonly plan: string | null;
  readonly limit: number | null;

  constructor(detail: string, body: Record<string, unknown>) {
    super(402, "plan_limit", detail, body);
    this.name = "PlanLimitError";
    this.plan = typeof body.plan === "string" ? body.plan : null;
    this.limit = typeof body.limit === "number" ? body.limit : null;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
export const isPlanLimitError = (error: unknown): error is PlanLimitError =>
  error instanceof PlanLimitError;

/** First human-readable string in a DRF error body (`detail`, or the first field error). */
function extractDetail(body: unknown): string {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) return body.map(extractDetail).find(Boolean) ?? "";
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      const found = extractDetail(value);
      if (found) return found;
    }
  }
  return "";
}

/** Build the right error from a failed response body (already JSON-parsed when possible). */
export function errorFromResponse(status: number, body: unknown): ApiError {
  const record = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const detail = extractDetail(body);
  const code = typeof record.code === "string" ? record.code : null;
  if (status === 402 && code === "plan_limit") return new PlanLimitError(detail, record);
  return new ApiError(status, code, detail, body);
}

export async function parseErrorResponse(response: {
  status: number;
  text: () => Promise<string>;
}): Promise<ApiError> {
  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return errorFromResponse(response.status, body);
}
