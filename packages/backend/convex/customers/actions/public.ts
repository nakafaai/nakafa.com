/**
 * Billing route retained for browser clients opened before the Confect rollout.
 * Migration owner: codex/confect. Remove after the successor is promoted and
 * production logs show no predecessor calls for one continuous hour.
 */
// biome-ignore lint/performance/noBarrelFile: Preserve the deployed billing route during the documented observation window.
export {
  generateCheckoutLink,
  generateCustomerPortalUrl,
} from "@repo/backend/convex/customers/actions/sessions";
