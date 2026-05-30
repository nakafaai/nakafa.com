import { PostHog } from "@posthog/convex";
import { components } from "@repo/backend/convex/_generated/api";

/**
 * Official PostHog Convex component client for backend product analytics.
 */
export const posthog = new PostHog(components.posthog);
