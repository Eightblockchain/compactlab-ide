/**
 * Paid plans / Stripe Upgrade UI.
 *
 * Off for community v1. Keep checkout/portal code; re-enable later with
 * NEXT_PUBLIC_ENABLE_BILLING=1 (playground) and COMPACTLAB_ENABLE_BILLING=true (API)
 * plus STRIPE_* env vars.
 */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BILLING === "1";
