import { API_BASE } from "../config";
import { ApiError, parseErrorResponse } from "./errors";
import { emitSessionExpired, tokenStore } from "./tokens";

let inFlight: Promise<string> | null = null;

async function postRefresh(): Promise<string> {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) throw new ApiError(401, null, "No refresh token");

  let response: Response;
  try {
    // No `X-Auth-Cookie`: the backend then returns the rotated refresh token in the body.
    response = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    throw new ApiError(0, "network", "Network request failed");
  }
  if (!response.ok) throw await parseErrorResponse(response);

  const data = (await response.json()) as { access?: string; refresh?: string };
  if (!data.access) throw new ApiError(401, null, "Refresh returned no access token");
  if (data.refresh) await tokenStore.setRefresh(data.refresh);
  tokenStore.setAccess(data.access);
  return data.access;
}

/**
 * Single-flight access-token refresh shared by REST calls and the SSE stream: concurrent
 * callers await the same request. A rejected refresh (4xx) wipes the session and signals
 * expiry (unless `silent`, used by the boot-time probe); a network failure keeps the
 * tokens so the user stays signed in while offline.
 */
export function refreshAccessToken({ silent = false }: { silent?: boolean } = {}): Promise<string> {
  if (!inFlight) {
    inFlight = postRefresh()
      .catch(async (error: unknown) => {
        const isRejection = error instanceof ApiError && error.status !== 0 && error.status < 500;
        if (isRejection) {
          await tokenStore.clear();
          if (!silent) emitSessionExpired();
        }
        throw error;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
