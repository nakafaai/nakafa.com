import { PostHog } from "@posthog/convex";
import { components } from "@repo/backend/convex/_generated/api";

// Convex runs outside Next rewrites, so this must be an absolute ingest or proxy origin.
const posthogHost =
  process.env.POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

/**
 * Official PostHog Convex component client for backend product analytics.
 */
export const posthog = new PostHog(components.posthog, {
  host: posthogHost,
});
