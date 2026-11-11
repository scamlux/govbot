import type { Plan } from "../api/types";

export type PaywallMode = "plans" | "limit-only";

/**
 * The paywall only offers purchases when billing is enabled server-side; otherwise (e.g. a 402
 * arrives while billing is off) it shows limit information only.
 */
export function paywallMode(billingEnabled: boolean | undefined): PaywallMode {
  return billingEnabled === true ? "plans" : "limit-only";
}

/** Reachable from Profile only when billing is enabled; always reachable on a 402. */
export function canOpenPaywall(billingEnabled: boolean | undefined, hitLimit: boolean): boolean {
  return hitLimit || billingEnabled === true;
}

/** Plans that can be bought now. */
export const purchasablePlans = (plans: readonly Plan[]): Plan[] => plans.filter((p) => p.for_sale && p.price_uzs !== null && p.price_uzs > 0);

export function formatPrice(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Checkout URL from either response shape. */
export function checkoutUrl(data: { url?: string; checkout_url?: string }): string | null {
  return data.url || data.checkout_url || null;
}
