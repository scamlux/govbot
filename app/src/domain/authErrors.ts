import { isApiError } from "../api/errors";

export type AuthMode = "login" | "register";

/** Map a thrown auth error to a localization key. */
export function authErrorKey(error: unknown, mode: AuthMode): string {
  if (isApiError(error)) {
    if (error.isNetwork) return "m.auth.network";
    if (mode === "login" && (error.status === 400 || error.status === 401)) return "auth.invalidCredentials";
  }
  return mode === "login" ? "auth.loginFailed" : "auth.registerFailed";
}
